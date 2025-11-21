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

      // Dirty state
      setDirty: (isDirty) =>
        set((state) => {
          state.isDirty = isDirty
        }),

      // Save operations
      saveProject: async () => {
        const { metadata, settings, isDirty, isSaving } = get()

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
            // Include other settings as needed by backend
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
            aspect_ratio: string
            timebase_fps: number
            created_at: string
            updated_at: string
            composition: {
              id: string
              composition_config: {
                aspect_ratio: string
                timebase_fps: number
                tracks?: unknown[]
                clips?: unknown[]
              }
            }
          }>(`/projects/${projectId}`)

          // Map backend response to store state
          const loadedMetadata: ProjectMetadata = {
            id: response.id,
            name: response.name,
            description: response.description || '',
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

          set((state) => {
            state.metadata = loadedMetadata
            state.settings = loadedSettings
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
      addProject: (metadata, settings) => {
        const projectId = generateUUID()
        const now = new Date()

        const newProject: ProjectMetadata = {
          ...metadata,
          id: projectId,
          createdAt: now,
          updatedAt: now,
          version: 1,
        }

        set((state) => {
          state.projects.set(projectId, newProject)
        })

        return projectId
      },

      removeProject: (projectId) =>
        set((state) => {
          state.projects.delete(projectId)

          // Clear current project if it was deleted
          if (state.currentProjectId === projectId) {
            state.currentProjectId = undefined
          }
        }),

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
          storage: createIndexedDBStorage(STORE_NAMES.PROJECT) as ReturnType<typeof createIndexedDBStorage>,
          // Serialize/deserialize dates properly
          serialize: (state) => {
            return JSON.stringify({
              state: {
                ...state.state,
                metadata: {
                  ...state.state.metadata,
                  createdAt: state.state.metadata.createdAt.toISOString(),
                  updatedAt: state.state.metadata.updatedAt.toISOString(),
                },
                lastSaved: state.state.lastSaved?.toISOString(),
                projects: Array.from(state.state.projects.entries()).map(([id, project]) => ({
                  id,
                  project: {
                    ...project,
                    createdAt: project.createdAt.toISOString(),
                    updatedAt: project.updatedAt.toISOString(),
                  },
                })),
              },
              version: state.version,
            })
          },
          deserialize: (str: string) => {
            const parsed = JSON.parse(str)
            const projectsArray = parsed.state.projects || []
            const projectsMap = new Map(
              projectsArray.map((entry: { id: string; project: ProjectMetadata & { createdAt: string; updatedAt: string } }) => [
                entry.id,
                {
                  ...entry.project,
                  createdAt: new Date(entry.project.createdAt),
                  updatedAt: new Date(entry.project.updatedAt),
                },
              ])
            )

            return {
              state: {
                ...parsed.state,
                metadata: {
                  ...parsed.state.metadata,
                  createdAt: new Date(parsed.state.metadata.createdAt),
                  updatedAt: new Date(parsed.state.metadata.updatedAt),
                },
                lastSaved: parsed.state.lastSaved ? new Date(parsed.state.lastSaved) : undefined,
                projects: projectsMap,
              },
              version: parsed.version,
            }
          },
        }
      ),
      { name: 'ProjectStore' }
    )
  )

  return store
}

// Export type for the store instance
export type ProjectStoreInstance = ReturnType<typeof createProjectStore>
