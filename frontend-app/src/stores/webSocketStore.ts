import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { WebSocketStore, JobState } from '../types/stores'
import type { ConnectionStatus, ConnectionMetrics, JobType } from '../types/websocket'
import { getWebSocketService } from '../services/WebSocketService'

// Initial connection metrics
const initialMetrics: ConnectionMetrics = {
  status: 'disconnected',
  reconnectAttempts: 0,
  messagesReceived: 0,
  messagesSent: 0,
}

// LocalStorage key for persisting active job IDs
const ACTIVE_JOBS_STORAGE_KEY = 'ai_active_job_ids'

// Helper functions for localStorage persistence
const persistActiveJobs = (jobIds: string[]) => {
  try {
    localStorage.setItem(ACTIVE_JOBS_STORAGE_KEY, JSON.stringify(jobIds))
  } catch (error) {
    console.error('Failed to persist active jobs to localStorage:', error)
  }
}

const loadPersistedJobs = (): string[] => {
  try {
    const stored = localStorage.getItem(ACTIVE_JOBS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load persisted jobs from localStorage:', error)
    return []
  }
}


// Initial state - restore persisted jobs
const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  connectionMetrics: { ...initialMetrics },
  jobs: new Map<string, JobState>(),
  activeJobIds: loadPersistedJobs(), // Restore persisted job IDs
  isConnected: false,
}

// Create the vanilla store with devtools and immer middleware
export const createWebSocketStore = () => {
  return createStore<WebSocketStore>()(
    devtools(
      immer((set) => ({
        ...initialState,

        // Connection management
        connect: () => {
          try {
            const wsService = getWebSocketService()
            wsService.connect()
          } catch (error) {
            console.error('Failed to connect WebSocket:', error)
          }
        },

        disconnect: () => {
          try {
            const wsService = getWebSocketService()
            wsService.disconnect()
            set((state) => {
              state.connectionStatus = 'disconnected'
              state.isConnected = false
            })
          } catch (error) {
            console.error('Failed to disconnect WebSocket:', error)
          }
        },

        updateConnectionStatus: (status) =>
          set((state) => {
            state.connectionStatus = status
            state.isConnected = status === 'connected'
            state.connectionMetrics.status = status
          }),

        updateConnectionMetrics: (metrics) =>
          set((state) => {
            state.connectionMetrics = { ...metrics }
            state.connectionStatus = metrics.status
            state.isConnected = metrics.status === 'connected'
          }),

        // Job management
        addJob: (job) =>
          set((state) => {
            state.jobs.set(job.id, job)
            if (job.status === 'running' || job.status === 'queued') {
              if (!state.activeJobIds.includes(job.id)) {
                state.activeJobIds.push(job.id)
                // Persist to localStorage for recovery
                persistActiveJobs(state.activeJobIds)
              }
            }
          }),

        updateJob: (jobId, updates) =>
          set((state) => {
            const job = state.jobs.get(jobId)
            if (job) {
              const updatedJob = { ...job, ...updates, updatedAt: new Date() }
              state.jobs.set(jobId, updatedJob)

              // Update active jobs list
              const isActive = updatedJob.status === 'running' || updatedJob.status === 'queued'
              const isInActiveList = state.activeJobIds.includes(jobId)

              if (isActive && !isInActiveList) {
                state.activeJobIds.push(jobId)
                // Persist when job becomes active
                persistActiveJobs(state.activeJobIds)
              } else if (!isActive && isInActiveList) {
                state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
                // Remove from persistence when job completes
                persistActiveJobs(state.activeJobIds)
              }
            }
          }),

        removeJob: (jobId) =>
          set((state) => {
            state.jobs.delete(jobId)
            state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
            // Remove from persistence
            persistActiveJobs(state.activeJobIds)
          }),

        handleJobUpdate: (message) => {
          // Log the full message to see what we're getting
          console.log('[WebSocket] Raw message:', message)

          // Backend sends snake_case (job_id), frontend uses camelCase (jobId)
          const jobId = message.jobId || message.job_id
          const jobType = (message.jobType || message.type || 'export') as JobType
          const compositionId = message.composition_id || message.compositionId

          // Map backend status values to frontend values
          const backendStatus = message.status as string
          let status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' = 'queued'
          if (backendStatus === 'in_progress') status = 'running'
          else if (backendStatus === 'completed') status = 'succeeded'
          else if (backendStatus === 'queued') status = 'queued'
          else if (backendStatus === 'failed') status = 'failed'
          else if (backendStatus === 'canceled' || backendStatus === 'cancelled') status = 'canceled'

          const progress = message.progress
          const msg = message.message
          const error = message.error
          let result = message.result

          // If the message includes output_url (backend sends this directly now), create result
          if (message.output_url && !result) {
            result = {
              downloadUrl: message.output_url,
              fileName: `composition_${compositionId}.mp4`,
              fileSize: 0,
              duration: 0,
              format: 'mp4',
            }
            console.log('[WebSocket] Created result from output_url in message:', result)
          }

          if (!jobId) {
            console.warn('Received job update without job_id:', message)
            return
          }

          console.log('[WebSocket] Parsed update:', { jobId, compositionId, status, backendStatus, message: msg })

          set((state) => {
            const existingJob = state.jobs.get(jobId)

            if (existingJob) {
              // Update existing job
              const updatedJob: JobState = {
                ...existingJob,
                status,
                progress,
                message: msg,
                error,
                result,
                updatedAt: new Date(),
              }
              state.jobs.set(jobId, updatedJob)

              // If job completed, fetch the full result from the API
              if (status === 'succeeded' && !result && compositionId) {
                console.log(`[WebSocket] Job succeeded, fetching composition ${compositionId}...`)

                // Retry fetching composition with exponential backoff
                // The database update happens in a callback after the WebSocket message
                const fetchWithRetry = async (retries = 5, delay = 500) => {
                  for (let i = 0; i < retries; i++) {
                    try {
                      // Wait before fetching (gives DB time to update)
                      if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, i)))
                      }

                      const res = await fetch(`/api/v1/compositions/${compositionId}`)
                      console.log(`[WebSocket] Fetch attempt ${i + 1}, response:`, res.status, res.statusText)

                      const data = await res.json()
                      console.log('[WebSocket] Fetched composition details:', data)

                      // Check if the composition is actually completed with an output URL
                      if (data.status === 'completed' && data.output_url) {
                        const fetchedResult = {
                          downloadUrl: data.output_url,
                          fileName: `composition_${compositionId}.${data.composition_config?.output?.format || 'mp4'}`,
                          fileSize: 0,
                          duration: 0,
                          format: data.composition_config?.output?.format || 'mp4',
                        }
                        console.log('[WebSocket] Created result:', fetchedResult)

                        // Update job with result
                        set(s => {
                          const job = s.jobs.get(jobId)
                          if (job) {
                            console.log('[WebSocket] Updating job with result')
                            s.jobs.set(jobId, { ...job, result: fetchedResult })
                          } else {
                            console.warn('[WebSocket] Job not found when trying to update result:', jobId)
                          }
                        })
                        return // Success!
                      } else if (i < retries - 1) {
                        console.log(`[WebSocket] Composition not ready yet (status: ${data.status}, has URL: ${!!data.output_url}), retrying...`)
                      } else {
                        console.warn('[WebSocket] Composition never became ready after retries:', data)
                      }
                    } catch (err) {
                      console.error(`[WebSocket] Fetch attempt ${i + 1} failed:`, err)
                      if (i === retries - 1) {
                        console.error('[WebSocket] All fetch attempts failed')
                      }
                    }
                  }
                }

                fetchWithRetry()
              } else if (status === 'succeeded') {
                console.log('[WebSocket] Job succeeded but not fetching:', {
                  hasResult: !!result,
                  hasCompositionId: !!compositionId,
                  compositionId
                })
              }
            } else {
              // Create new job entry
              const newJob: JobState = {
                id: jobId,
                type: jobType,
                status,
                progress,
                message: msg,
                error,
                result,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              state.jobs.set(jobId, newJob)

              // If job completed, fetch the full result from the API
              if (status === 'succeeded' && !result && compositionId) {
                console.log(`[WebSocket] New job succeeded, fetching composition ${compositionId}...`)

                // Retry fetching composition with exponential backoff
                // The database update happens in a callback after the WebSocket message
                const fetchWithRetry = async (retries = 5, delay = 500) => {
                  for (let i = 0; i < retries; i++) {
                    try {
                      // Wait before fetching (gives DB time to update)
                      if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, i)))
                      }

                      const res = await fetch(`/api/v1/compositions/${compositionId}`)
                      console.log(`[WebSocket] Fetch attempt ${i + 1}, response:`, res.status, res.statusText)

                      const data = await res.json()
                      console.log('[WebSocket] Fetched composition details:', data)

                      // Check if the composition is actually completed with an output URL
                      if (data.status === 'completed' && data.output_url) {
                        const fetchedResult = {
                          downloadUrl: data.output_url,
                          fileName: `composition_${compositionId}.${data.composition_config?.output?.format || 'mp4'}`,
                          fileSize: 0,
                          duration: 0,
                          format: data.composition_config?.output?.format || 'mp4',
                        }
                        console.log('[WebSocket] Created result:', fetchedResult)

                        // Update job with result
                        set(s => {
                          const job = s.jobs.get(jobId)
                          if (job) {
                            console.log('[WebSocket] Updating job with result')
                            s.jobs.set(jobId, { ...job, result: fetchedResult })
                          } else {
                            console.warn('[WebSocket] Job not found when trying to update result:', jobId)
                          }
                        })
                        return // Success!
                      } else if (i < retries - 1) {
                        console.log(`[WebSocket] Composition not ready yet (status: ${data.status}, has URL: ${!!data.output_url}), retrying...`)
                      } else {
                        console.warn('[WebSocket] Composition never became ready after retries:', data)
                      }
                    } catch (err) {
                      console.error(`[WebSocket] Fetch attempt ${i + 1} failed:`, err)
                      if (i === retries - 1) {
                        console.error('[WebSocket] All fetch attempts failed')
                      }
                    }
                  }
                }

                fetchWithRetry()
              } else if (status === 'succeeded') {
                console.log('[WebSocket] New job succeeded but not fetching:', {
                  hasResult: !!result,
                  hasCompositionId: !!compositionId,
                  compositionId
                })
              }
            }

            // Update active jobs list
            const job = state.jobs.get(jobId)
            if (job) {
              const isActive = job.status === 'running' || job.status === 'queued'
              const isInActiveList = state.activeJobIds.includes(jobId)

              if (isActive && !isInActiveList) {
                state.activeJobIds.push(jobId)
              } else if (!isActive && isInActiveList) {
                state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
              }

              // Persist changes to localStorage
              persistActiveJobs(state.activeJobIds)
            }
          })

          // Log job updates for debugging
          console.log(`[WebSocket] Job update: ${jobId} - ${status}`, {
            progress,
            message: msg,
            error,
          })
        },

        // Utility
        reset: () =>
          set((state) => {
            state.connectionStatus = 'disconnected'
            state.connectionMetrics = { ...initialMetrics }
            state.jobs.clear()
            state.activeJobIds = []
            state.isConnected = false
          }),
      })),
      { name: 'WebSocketStore' }
    )
  )
}
