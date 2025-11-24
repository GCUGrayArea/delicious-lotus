import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools } from 'zustand/middleware'
import { createIndexedDBStorage, STORE_NAMES } from '../lib/indexedDBStorage'
import type { ProjectStore, ProjectMetadata, ProjectSettings } from '../types/stores'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { debounce } from '../lib/debounce'
import { getWebSocketService } from '../services/WebSocketService'
import type { WebSocketMessage, JobUpdateMessage } from '../types/websocket'
import { generateUUID } from '../utils/uuid'

// Default project metadata
const defaultMetadata: ProjectMetadata = {
  id: `project-${Date.now()}`,
  name: 'Untitled Project',
  description: '',
  type: 'custom',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
}

// Default project settings
const defaultSettings: ProjectSettings = {
  fps: 30,
  resolution: { width: 1920, height: 1080 },
  aspectRatio: '16:9',
  duration: 0,
  audioSampleRate: 48000,
}

// Initial state
const initialState = {
  metadata: { ...defaultMetadata },
  settings: { ...defaultSettings },
  compositionConfig: {} as Record<string, any>,
  isDirty: false,
  lastSaved: undefined as Date | undefined,
  autosaveInterval: 2000, // 2 seconds (per task spec)
  isAutoSaveEnabled: true,
  isLoading: false,
  isSaving: false,
  isExporting: false,
  exportJobStatus: new Map<string, { status: string; progress?: number; error?: string }>(),
  projects: new Map<string, ProjectMetadata>(),
  currentProjectId: undefined as string | undefined,
}

// Create the vanilla store with devtools, persist, and immer middleware
export const createProjectStore = () => {
  let autosaveTimer: NodeJS.Timeout | null = null
  let debouncedSave: ((...args: unknown[]) => void) | null = null

  // Create the base storage instance once
  const baseStorage = createIndexedDBStorage(STORE_NAMES.PROJECT)

  // Custom storage wrapper to handle Map/Date serialization
  const storageWrapper = {
    getItem: async (name: string) => {
       const str = await baseStorage.getItem(name);
       if (!str) return null;
       return {
          state: JSON.parse(str, (key, value) => {
             if (key === 'projects' && Array.isArray(value)) {
                 return new Map(value.map(([id, project]: [string, any]) => [id, {
                     ...project,
                     createdAt: new Date(project.createdAt),
                     updatedAt: new Date(project.updatedAt)
                 }]));
             }
             if (key === 'createdAt' || key === 'updatedAt' || key === 'lastSaved') {
                 return value ? new Date(value) : undefined;
             }
             if (key === 'exportJobStatus' && Array.isArray(value)) {
                 return new Map(value);
             }
             return value;
          }),
       }
    },
    setItem: async (name: string, newValue: any) => {
        const str = JSON.stringify(newValue.state, (key, value) => {
           if (value instanceof Map) {
               return Array.from(value.entries());
           }
           return value;
        });
        return baseStorage.setItem(name, str);
    },
    removeItem: baseStorage.removeItem
  }

  const store = createStore<ProjectStore>()(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,

          // Metadata operations
          updateMetadata: (updates) => {
            set((state) => {
              state.metadata = {
                ...state.metadata,
                ...updates,
                updatedAt: new Date(),
              }
              state.isDirty = true
            })

            // Trigger debounced autosave
            if (debouncedSave && get().isAutoSaveEnabled) {
              debouncedSave()
            }
          },

          updateSettings: (updates) => {
            set((state) => {
              state.settings = {
                ...state.settings,
                ...updates,
              }
              state.isDirty = true

              // Update metadata timestamp
              state.metadata.updatedAt = new Date()
            })

            // Trigger debounced autosave
            if (debouncedSave && get().isAutoSaveEnabled) {
              debouncedSave()
            }
          },

          updateCompositionConfig: (updates) => {
            set((state) => {
              state.compositionConfig = {
                ...state.compositionConfig,
                ...updates,
              }
              state.isDirty = true
              state.metadata.updatedAt = new Date()
            })

            // Trigger debounced autosave
            if (debouncedSave && get().isAutoSaveEnabled) {
              debouncedSave()
            }
          },

          // Dirty state
          setDirty: (isDirty) =>
            set((state) => {
              state.isDirty = isDirty
            }),

          // Save operations
          saveProject: async () => {
            const { metadata, settings, compositionConfig, isDirty, isSaving } = get()

            if (!isDirty) {
              console.log('Project is already saved')
              return
            }

            if (isSaving) {
              console.log('Save already in progress')
              return
            }

            try {
              set((state) => {
                state.isSaving = true
              })

              // Call backend API: PUT /api/v1/projects/{id}
              const response = await api.put<{ id: string; name: string; updated_at: string }>(`/projects/${metadata.id}`, {
                name: metadata.name,
                description: metadata.description,
                aspect_ratio: settings.aspectRatio,
                timebase_fps: settings.fps,
                composition: compositionConfig, // Pass full composition config
              })

              set((state) => {
                state.isDirty = false
                state.lastSaved = new Date()
                state.metadata.updatedAt = new Date(response.updated_at)
                state.isSaving = false
              })

              toast.success('Project saved successfully')
            } catch (error) {
              set((state) => {
                state.isSaving = false
              })
              console.error('Failed to save project:', error)
              toast.error('Failed to save project')
              throw error
            }
          },

          loadProject: async (projectId) => {
            try {
              set((state) => {
                state.isLoading = true
              })

              // Call backend API: GET /api/v1/projects/{id}
              const response = await api.get<{ 
                id: string
                name: string
                description?: string
                project_type: string
                aspect_ratio: string
                timebase_fps: number
                created_at: string
                updated_at: string
                composition: {
                  id: string
                  composition_config: Record<string, any>
                }
              }>(`/projects/${projectId}`)

              // Map backend response to store state
              const loadedMetadata: ProjectMetadata = {
                id: response.id,
                name: response.name,
                description: response.description || '',
                type: response.project_type as any, // Cast to ProjectType
                createdAt: new Date(response.created_at),
                updatedAt: new Date(response.updated_at),
                version: 1,
              }

              const loadedSettings: ProjectSettings = {
                fps: response.timebase_fps,
                resolution: response.aspect_ratio === '16:9' ? { width: 1920, height: 1080 } : { width: 1920, height: 1080 }, // TODO: Map aspect ratio to resolution
                aspectRatio: response.aspect_ratio as '16:9' | '9:16' | '1:1' | '4:3',
                duration: 0, // TODO: Calculate from composition
                audioSampleRate: 48000,
              }

              // Load flexible composition config
              const loadedConfig = response.composition?.composition_config || {}

              set((state) => {
                state.metadata = loadedMetadata
                state.settings = loadedSettings
                state.compositionConfig = loadedConfig
                state.isDirty = false
                state.lastSaved = new Date()
                state.currentProjectId = projectId
                state.isLoading = false
              })

              toast.success('Project loaded successfully')
            } catch (error) {
              set((state) => {
                state.isLoading = false
              })
              console.error('Failed to load project:', error)
              toast.error('Failed to load project')
              throw error
            }
          },

          exportProject: async () => {
            const { metadata, settings, currentProjectId } = get()

            try {
              set((state) => {
                state.isExporting = true
              })

              // Call backend API: POST /api/v1/compositions/
              // This creates an export job that will be processed asynchronously
              const response = await api.post<{ 
                id: string
                job_id: string
                status: string
                title: string
              }>('/compositions/', {
                title: `${metadata.name} - Export`,
                project_id: currentProjectId,
                composition_config: {
                  aspect_ratio: settings.aspectRatio,
                  timebase_fps: settings.fps,
                  // Add tracks, clips, transitions from timeline store when integrated
                  tracks: [],
                  clips: [],
                  transitions: [],
                },
                export_settings: {
                  format: 'mp4',
                  quality: 'high',
                  resolution: settings.resolution,
                },
              })

              // Track the export job
              set((state) => {
                state.exportJobStatus.set(response.job_id, {
                  status: 'queued',
                  progress: 0,
                })
              })

              toast.success('Export started', {
                description: 'Your project is being exported. You will be notified when it\'s ready.',
              })

              return response.job_id
            } catch (error) {
              set((state) => {
                state.isExporting = false
              })
              console.error('Failed to export project:', error)
              toast.error('Failed to start export')
              throw error
            }
          },

          // Autosave
          enableAutoSave: (enabled) =>
            set((state) => {
              state.isAutoSaveEnabled = enabled

              // Create debounced save function if not exists
              if (!debouncedSave && enabled) {
                debouncedSave = debounce(() => {
                  const state = get()
                  if (state.isDirty && state.isAutoSaveEnabled && !state.isSaving) {
                    state.saveProject().catch((error) => {
                      console.error('Autosave failed:', error)
                    })
                  }
                }, state.autosaveInterval)
              }
            }),

          setAutosaveInterval: (interval) =>
            set((state) => {
              state.autosaveInterval = interval

              // Recreate debounced save with new interval
              if (state.isAutoSaveEnabled) {
                debouncedSave = debounce(() => {
                  const state = get()
                  if (state.isDirty && state.isAutoSaveEnabled && !state.isSaving) {
                    state.saveProject().catch((error) => {
                      console.error('Autosave failed:', error)
                    })
                  }
                }, interval)
              }
            }),

          // Project collection operations
          fetchProjects: async (filters) => {
            try {
              set((state) => {
                state.isLoading = true
              })

              const params: Record<string, string> = {}
              if (filters?.type) {
                params.project_type = filters.type
              }
              // Add user_id parameter (TODO: Get from auth store when available)
              params.user_id = '00000000-0000-0000-0000-000000000001'

              const response = await api.get<{
                items: Array<{
                  id: string
                  name: string
                  description?: string
                  project_type: string
                  thumbnail_url?: string
                  created_at: string
                  updated_at: string
                }>
              }>('/projects/', { params })

              set((state) => {
                // Clear existing and set fresh data from backend
                state.projects.clear()
                response.items.forEach((item) => {
                  state.projects.set(item.id, {
                    id: item.id,
                    name: item.name,
                    description: item.description,
                    type: item.project_type as any,
                    thumbnailUrl: item.thumbnail_url,
                    createdAt: new Date(item.created_at),
                    updatedAt: new Date(item.updated_at),
                    version: 1,
                  })
                })
                state.isLoading = false
              })

              console.log(`Fetched ${response.items.length} projects from backend`)
            } catch (error) {
              set((state) => {
                state.isLoading = false
              })
              console.error('Failed to fetch projects:', error)
              toast.error('Failed to load projects from server')
              // Don't throw here, just log, so UI can handle empty state gracefully
            }
          },

          addProject: async (metadata, settings) => {
            try {
              set((state) => {
                state.isLoading = true
              })

              // Prepare request body
              const requestBody = {
                name: metadata.name,
                description: metadata.description,
                project_type: metadata.type,
                // Use provided owner or fallback to test user (TODO: Integrate with AuthStore)
                user_id: metadata.owner || '00000000-0000-0000-0000-000000000001',
                aspect_ratio: settings?.aspectRatio || '16:9',
                timebase_fps: settings?.fps || 30,
              }

              // Call backend API: POST /api/v1/projects/
              const response = await api.post<{
                id: string
                created_at: string
                updated_at: string
              }>('/projects/', requestBody)

              const newProject: ProjectMetadata = {
                ...metadata,
                id: response.id,
                createdAt: new Date(response.created_at),
                updatedAt: new Date(response.updated_at),
                version: 1,
              }

              set((state) => {
                state.projects.set(response.id, newProject)
                state.isLoading = false
              })

              return response.id
            } catch (error) {
              set((state) => {
                state.isLoading = false
              })
              console.error('Failed to create project:', error)
              toast.error('Failed to create project')
              throw error
            }
          },

          removeProject: async (projectId) => {
            try {
              // Call backend API: DELETE /api/v1/projects/{id}
              await api.delete(`/projects/${projectId}`)

              // Remove from local state after successful deletion
              set((state) => {
                state.projects.delete(projectId)

                // Clear current project if it was deleted
                if (state.currentProjectId === projectId) {
                  state.currentProjectId = undefined
                }
              })

              toast.success('Project deleted successfully')
            } catch (error) {
              console.error('Failed to delete project:', error)
              toast.error('Failed to delete project')
              throw error
            }
          },

          updateProject: (projectId, updates) =>
            set((state) => {
              const project = state.projects.get(projectId)
              if (project) {
                state.projects.set(projectId, {
                  ...project,
                  ...updates,
                  updatedAt: new Date(),
                })
              }
            }),

          getProjects: () => {
            const { projects } = get()
            return Array.from(projects.values()).sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
            )
          },

          getCurrentProject: () => {
            const { currentProjectId, projects } = get()
            return currentProjectId ? projects.get(currentProjectId) : undefined
          },

          setCurrentProject: (projectId) =>
            set((state) => {
              state.currentProjectId = projectId
              const project = state.projects.get(projectId)
              if (project) {
                state.metadata = { ...project }
              }
            }),

          // WebSocket integration
          initializeWebSocket: () => {
            try {
              const wsService = getWebSocketService()

              // Listen for export job updates
              const handleJobUpdate = (message: WebSocketMessage) => {
                if (message.event.startsWith('job.')) {
                  const jobMessage = message as JobUpdateMessage

                  // Only handle export job types
                  if (jobMessage.jobType === 'export') {
                    set((state) => {
                      state.exportJobStatus.set(jobMessage.jobId, {
                        status: jobMessage.status,
                        progress: jobMessage.progress,
                        error: jobMessage.error,
                      })

                      // Update isExporting flag
                      if (jobMessage.status === 'succeeded' || jobMessage.status === 'failed') {
                        state.isExporting = false

                        // Show notification
                        if (jobMessage.status === 'succeeded') {
                          toast.success('Export completed successfully!')
                        } else if (jobMessage.status === 'failed') {
                          toast.error('Export failed', {
                            description: jobMessage.error || 'Unknown error',
                          })
                        }
                      }
                    })
                  }
                }
              }

              wsService.on('message', handleJobUpdate)
            } catch (error) {
              console.error('Failed to initialize WebSocket for projectStore:', error)
            }
          },

          // Utility
          reset: () => {
            if (autosaveTimer) {
              clearInterval(autosaveTimer)
              autosaveTimer = null
            }
            debouncedSave = null
            set(initialState)
          },
        })),
        {
          name: 'project-store',
          partialize: (state) => ({
            metadata: state.metadata,
            settings: state.settings,
            compositionConfig: state.compositionConfig,
            isDirty: state.isDirty,
            lastSaved: state.lastSaved,
            autosaveInterval: state.autosaveInterval,
            isAutoSaveEnabled: state.isAutoSaveEnabled,
            projects: state.projects,
            currentProjectId: state.currentProjectId,
            exportJobStatus: state.exportJobStatus,
          }),
          storage: storageWrapper as any,
        }
      ),
      { name: 'ProjectStore' }
    )
  )

  return store
}

// Export type for the store instance
export type ProjectStoreInstance = ReturnType<typeof createProjectStore>