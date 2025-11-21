/**
 * WebSocketService - Singleton service for managing WebSocket connections
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong mechanism for connection health
 * - Message queuing for offline scenarios
 * - Event-based message handling
 * - Connection metrics and monitoring
 */

import type {
  WebSocketConfig,
  WebSocketMessage,
  ConnectionStatus,
  ConnectionMetrics,
  MessageHandler,
  ConnectionHandler,
  ErrorHandler,
  QueuedMessage,
  PingMessage,
  PongMessage,
} from '../types/websocket'
import { generateUUID } from '../utils/uuid'

type EventType = 'message' | 'connection' | 'error'
type Callback = MessageHandler | ConnectionHandler | ErrorHandler

export class WebSocketService {
  private static instance: WebSocketService | null = null

  private ws: WebSocket | null = null
  private config: Required<WebSocketConfig>
  private connectionStatus: ConnectionStatus = 'disconnected'
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private pongTimer: NodeJS.Timeout | null = null
  private currentReconnectDelay: number
  private reconnectAttempts: number = 0

  // Event listeners
  private eventListeners: Map<EventType, Set<Callback>> = new Map([
    ['message', new Set()],
    ['connection', new Set()],
    ['error', new Set()],
  ])

  // Message queue for offline scenarios
  private messageQueue: QueuedMessage[] = []
  private maxQueueSize: number = 100

  // Connection metrics
  private metrics: ConnectionMetrics = {
    status: 'disconnected',
    reconnectAttempts: 0,
    messagesReceived: 0,
    messagesSent: 0,
  }

  // Last ping timestamp for latency calculation
  private lastPingTimestamp: number = 0

  private constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      pongTimeout: config.pongTimeout ?? 5000,
      reconnectInitialDelay: config.reconnectInitialDelay ?? 1000,
      reconnectMaxDelay: config.reconnectMaxDelay ?? 30000,
      reconnectBackoffMultiplier: config.reconnectBackoffMultiplier ?? 1.5,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      authToken: config.authToken ?? '',
    }
    this.currentReconnectDelay = this.config.reconnectInitialDelay
  }

  /**
   * Get singleton instance of WebSocketService
   */
  public static getInstance(config?: WebSocketConfig): WebSocketService {
    if (!WebSocketService.instance && config) {
      WebSocketService.instance = new WebSocketService(config)
    }
    if (!WebSocketService.instance) {
      throw new Error('WebSocketService must be initialized with config first')
    }
    return WebSocketService.instance
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (WebSocketService.instance) {
      WebSocketService.instance.disconnect()
      WebSocketService.instance = null
    }
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.warn('WebSocket is already connected or connecting')
      return
    }

    this.updateConnectionStatus('connecting')

    try {
      // Build URL with auth token if provided
      const url = this.config.authToken
        ? `${this.config.url}?token=${this.config.authToken}`
        : this.config.url

      this.ws = new WebSocket(url)

      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onerror = this.handleError.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
    } catch (error) {
      this.handleError(error as Event)
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.stopHeartbeat()
    this.clearReconnectTimer()

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect')
      }

      this.ws = null
    }

    this.updateConnectionStatus('disconnected')
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectInitialDelay
  }

  /**
   * Send message to WebSocket server
   */
  public send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message))
        this.metrics.messagesSent++
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        this.queueMessage(message)
      }
    } else {
      this.queueMessage(message)
    }
  }

  /**
   * Add event listener
   */
  public on(event: 'message', callback: MessageHandler): void
  public on(event: 'connection', callback: ConnectionHandler): void
  public on(event: 'error', callback: ErrorHandler): void
  public on(event: EventType, callback: Callback): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.add(callback)
    }
  }

  /**
   * Remove event listener
   */
  public off(event: EventType, callback: Callback): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Get current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Get connection metrics
   */
  public getMetrics(): ConnectionMetrics {
    return { ...this.metrics }
  }

  /**
   * Update authentication token
   */
  public updateAuthToken(token: string): void {
    this.config.authToken = token
    // Reconnect with new token if currently connected
    if (this.connectionStatus === 'connected') {
      this.disconnect()
      this.connect()
    }
  }

  // ============================================================================
  // Private Methods - Connection Handlers
  // ============================================================================

  private handleOpen(): void {
    console.log('WebSocket connected')
    this.updateConnectionStatus('connected')
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectInitialDelay
    this.startHeartbeat()
    this.flushMessageQueue()
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      this.metrics.messagesReceived++
      this.metrics.lastMessageTime = new Date()

      // Handle pong responses for latency calculation
      if (message.event === 'pong') {
        this.handlePongMessage(message as PongMessage)
        return
      }

      // Emit message to all listeners
      this.emit('message', message)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event)
    const error = new Error('WebSocket connection error')
    this.emit('error', error)
    this.updateConnectionStatus('error')
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed:', event.code, event.reason)
    this.stopHeartbeat()

    // Don't reconnect if it was a clean close
    if (event.code === 1000) {
      this.updateConnectionStatus('disconnected')
      return
    }

    // Attempt reconnection
    this.handleConnectionLost()
  }

  // ============================================================================
  // Private Methods - Reconnection Logic
  // ============================================================================

  private handleConnectionLost(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.updateConnectionStatus('error')
      this.emit('error', new Error('Failed to reconnect after maximum attempts'))
      return
    }

    this.reconnectAttempts++
    this.metrics.reconnectAttempts = this.reconnectAttempts
    this.updateConnectionStatus('reconnecting')

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${this.currentReconnectDelay}ms`
    )

    this.reconnectTimer = setTimeout(() => {
      this.connect()
      // Increase delay for next attempt with exponential backoff
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * this.config.reconnectBackoffMultiplier,
        this.config.reconnectMaxDelay
      )
    }, this.currentReconnectDelay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ============================================================================
  // Private Methods - Heartbeat Mechanism
  // ============================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      this.sendPing()
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
  }

  private sendPing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastPingTimestamp = Date.now()
      const pingMessage: PingMessage = {
        event: 'ping',
        timestamp: new Date().toISOString(),
      }
      this.send(pingMessage)

      // Set timeout for pong response
      this.pongTimer = setTimeout(() => {
        console.error('Pong timeout - connection appears dead')
        this.handleConnectionLost()
      }, this.config.pongTimeout)
    }
  }

  private handlePongMessage(_message: PongMessage): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }

    // Calculate latency
    const latency = Date.now() - this.lastPingTimestamp
    this.metrics.latency = latency
  }

  // ============================================================================
  // Private Methods - Message Queue
  // ============================================================================

  private queueMessage(message: unknown): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message (FIFO)
      this.messageQueue.shift()
      console.warn('Message queue full, oldest message removed')
    }

    const queuedMessage: QueuedMessage = {
      id: generateUUID(),
      message,
      timestamp: new Date(),
      priority: 'normal',
      retryCount: 0,
    }

    this.messageQueue.push(queuedMessage)
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return
    }

    console.log(`Flushing ${this.messageQueue.length} queued messages`)

    // Send all queued messages
    const messages = [...this.messageQueue]
    this.messageQueue = []

    messages.forEach((queuedMessage) => {
      this.send(queuedMessage.message)
    })
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status
    this.metrics.status = status
    this.emit('connection', status)
  }

  private emit(event: 'message', message: WebSocketMessage): void
  private emit(event: 'connection', status: ConnectionStatus): void
  private emit(event: 'error', error: Error): void
  private emit(event: EventType, data: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          ;(callback as (data: unknown) => void)(data)
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error)
        }
      })
    }
  }
}

// Export singleton instance getter
export const getWebSocketService = WebSocketService.getInstance
