import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { WebSocketService } from '../services/WebSocketService'
import { useWebSocketStore } from './StoreContext'
import type { WebSocketMessage, JobUpdateMessage } from '../types/websocket'

interface WebSocketContextValue {
  service: WebSocketService | null
}

const WebSocketContext = createContext<WebSocketContextValue>({ service: null })

interface WebSocketProviderProps {
  children: ReactNode
  url?: string
  autoConnect?: boolean
  authToken?: string
}

/**
 * WebSocketProvider - Manages WebSocket connection and message routing
 *
 * Initializes the WebSocket service, connects to the server, and routes
 * incoming messages to the appropriate store handlers.
 */
export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
  authToken,
}: WebSocketProviderProps) {
  const serviceRef = useRef<WebSocketService | null>(null)
  const webSocketStore = useWebSocketStore()

  // Handle incoming WebSocket messages - defined before useEffect to avoid hoisting issues
  const handleMessage = useCallback((message: WebSocketMessage) => {
    // Route job update messages to the store
    // Backend sends messages with "type" field, not "event"
    const eventType = message.event || ('type' in message ? message.type : '') || ''
    if (eventType.startsWith('job.') || ('type' in message && message.type === 'status_update') || ('job_id' in message && message.job_id)) {
      webSocketStore.handleJobUpdate(message as JobUpdateMessage)
    }

    // Add additional message routing here as needed
    // Example: if (message.event === 'notification') { ... }
  }, [webSocketStore])

  useEffect(() => {
    // Determine WebSocket URL
    // Default to local WebSocket endpoint for job updates
    const defaultWsUrl = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL.replace('http', 'ws')}/api/v1/ws/jobs`
      : 'ws://localhost:8000/api/v1/ws/jobs'

    const wsUrl = url || import.meta.env.VITE_WEBSOCKET_URL || defaultWsUrl

    if (!wsUrl) {
      console.warn('WebSocket URL not provided, WebSocket will not connect')
      return
    }

    console.log(`[WebSocket] Connecting to: ${wsUrl}`)

    // Initialize WebSocket service
    try {
      serviceRef.current = WebSocketService.getInstance({
        url: wsUrl,
        authToken,
        heartbeatInterval: 90000, // 90 seconds - allows long-running video generation
        pongTimeout: 10000, // 10 seconds - more generous timeout
        reconnectInitialDelay: 1000,
        reconnectMaxDelay: 30000,
        reconnectBackoffMultiplier: 1.5,
        maxReconnectAttempts: 10,
      })

      // Set up message handler
      serviceRef.current.on('message', handleMessage)

      // Set up connection status handler
      serviceRef.current.on('connection', (status) => {
        webSocketStore.updateConnectionStatus(status)
        webSocketStore.updateConnectionMetrics(serviceRef.current!.getMetrics())
      })

      // Set up error handler
      serviceRef.current.on('error', (error) => {
        console.error('[WebSocket] Error:', error)
      })

      // Auto-connect if enabled
      if (autoConnect) {
        serviceRef.current.connect()
      }
    } catch (error) {
      console.error('[WebSocket] Failed to initialize:', error)
    }

    // Cleanup on unmount
    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect()
        WebSocketService.resetInstance()
      }
    }
  }, [url, authToken, autoConnect, handleMessage])

  return (
    <WebSocketContext.Provider value={{ service: serviceRef.current }}>
      {children}
    </WebSocketContext.Provider>
  )
}

/**
 * Hook to access the WebSocket service directly
 * Use this for sending messages or getting service status
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return context.service
}

/**
 * Hook to get WebSocket connection status
 * Convenience hook that reads from the store
 */
export function useWebSocketStatus() {
  const connectionStatus = useWebSocketStore((state) => state.connectionStatus)
  const isConnected = useWebSocketStore((state) => state.isConnected)
  const metrics = useWebSocketStore((state) => state.connectionMetrics)

  return { connectionStatus, isConnected, metrics }
}

/**
 * Hook to access active jobs
 * Returns all jobs currently being tracked
 */
export function useActiveJobs() {
  const jobs = useWebSocketStore((state) => state.jobs)
  const activeJobIds = useWebSocketStore((state) => state.activeJobIds)

  const activeJobs = activeJobIds
    .map((id) => jobs.get(id))
    .filter((job) => job !== undefined)

  return activeJobs
}

/**
 * Hook to get a specific job by ID
 */
export function useJob(jobId: string) {
  const job = useWebSocketStore((state) => state.jobs.get(jobId))
  return job
}
