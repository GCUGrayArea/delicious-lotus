/**
 * WebSocket Manager
 * Socket.io client configuration and connection manager with auto-reconnection
 */

import { io, Socket } from 'socket.io-client';
import type {
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  EventHandler,
} from '@/types/ad-generator/websocket';
import { MessageQueue } from './messageQueue';

/**
 * Generate a simple UUID v4
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * WebSocket connection manager with auto-reconnection and message queuing
 */
export class WebSocketManager {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: MessageQueue;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private statusChangeCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 300000, // 5 minutes
      enablePollingFallback: true,
      ...config,
    };

    this.connectionState = {
      status: 'disconnected',
      reconnectAttempts: 0,
    };

    this.messageQueue = new MessageQueue({
      maxSize: 100,
      maxRetries: 3,
      maxAge: 3600000, // 1 hour
    });
  }

  /**
   * Connect to WebSocket endpoint
   * @param endpoint - WebSocket endpoint path (e.g., '/ws/generations/abc123')
   */
  async connect(endpoint: string): Promise<void> {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.updateStatus('connecting');

    try {
      // Derive generation_id from endpoint if present (e.g., '/ws/generations/{id}')
      let generationId: string | undefined;
      const match = endpoint.match(/\/generations\/([^/]+)/);
      if (match && match[1]) {
        generationId = match[1];
      }

      // Create Socket.io connection
      // Always use the Socket.io path; pass generation_id via query so the
      // backend can validate and subscribe the connection.
      const options: {
        path: string;
        transports: string[];
        reconnection: boolean;
        timeout: number | undefined;
        withCredentials: boolean;
        extraHeaders: Record<string, string>;
        query?: Record<string, string>;
      } = {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: false, // We handle reconnection manually
        timeout: this.config.timeout,
        withCredentials: true,
        extraHeaders: {
          'X-Request-ID': generateUUID(),
        },
      };

      if (generationId) {
        options.query = { generation_id: generationId };
      }

      this.socket = io(this.config.url, options);

      // Set up event listeners
      this.setupEventListeners();

      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.connectionState.lastError = error as Error;
      this.updateStatus('error');
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();

    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    this.updateStatus('disconnected');
  }

  /**
   * Subscribe to WebSocket event
   * @param eventType - Event type to listen for
   * @param handler - Event handler function
   */
  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler as EventHandler);

    // Register with socket if connected
    if (this.socket?.connected) {
      this.socket.on(eventType, handler);
    }
  }

  /**
   * Unsubscribe from WebSocket event
   * @param eventType - Event type
   * @param handler - Optional specific handler to remove (removes all if not provided)
   */
  unsubscribe(eventType: string, handler?: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      return;
    }

    if (handler) {
      // Remove specific handler
      this.eventHandlers.get(eventType)!.delete(handler);
      if (this.socket) {
        this.socket.off(eventType, handler);
      }
    } else {
      // Remove all handlers for event type
      const handlers = this.eventHandlers.get(eventType);
      if (handlers && this.socket) {
        handlers.forEach((h) => this.socket!.off(eventType, h));
      }
      this.eventHandlers.delete(eventType);
    }
  }

  /**
   * Send message to server
   * @param event - Event name
   * @param data - Event data
   */
  send(event: string, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      // Queue message if offline
      console.log('[WebSocket] Offline - queueing message:', event);
      this.messageQueue.enqueue(event, data);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Register callback for status changes
   * @param callback - Function to call when status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusChangeCallbacks.add(callback);
  }

  /**
   * Remove status change callback
   * @param callback - Callback to remove
   */
  offStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusChangeCallbacks.delete(callback);
  }

  /**
   * Set up Socket.io event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) {
      return;
    }

    // Connection events
    this.socket.on('connect', () => this.handleConnect());
    this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
    this.socket.on('connect_error', (error) => this.handleConnectionError(error));
    this.socket.on('error', (error) => this.handleError(error));

    // Heartbeat events
    this.socket.on('pong', () => {
      // Reset heartbeat timer on pong
      this.startHeartbeat();
    });

    // Register all subscribed event handlers
    this.eventHandlers.forEach((handlers, eventType) => {
      handlers.forEach((handler) => {
        this.socket!.on(eventType, handler);
      });
    });
  }

  /**
   * Handle successful connection
   */
  private handleConnect(): void {
    console.log('[WebSocket] Connected');
    this.connectionState.connectedAt = new Date();
    this.connectionState.reconnectAttempts = 0;
    this.connectionState.lastError = undefined;
    this.updateStatus('connected');

    // Process queued messages
    this.processMessageQueue();

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle disconnection
   * @param reason - Disconnection reason
   */
  private handleDisconnect(reason: string): void {
    console.log('[WebSocket] Disconnected:', reason);
    this.connectionState.disconnectedAt = new Date();
    this.updateStatus('disconnected');

    // Clear heartbeat
    this.clearHeartbeatTimer();

    // Attempt reconnection if not a manual disconnect
    if (reason !== 'io client disconnect') {
      this.handleReconnect();
    }
  }

  /**
   * Handle connection error
   * @param error - Error object
   */
  private handleConnectionError(error: Error): void {
    console.error('[WebSocket] Connection error:', error);
    this.connectionState.lastError = error;
    this.updateStatus('error');
    this.handleReconnect();
  }

  /**
   * Handle general error
   * @param error - Error object
   */
  private handleError(error: Error): void {
    console.error('[WebSocket] Error:', error);
    this.connectionState.lastError = error;

    // Notify error handlers
    const handlers = this.eventHandlers.get('error');
    if (handlers) {
      handlers.forEach((handler) => {
        handler({
          code: 'WEBSOCKET_ERROR',
          message: error.message,
          recoverable: true,
        });
      });
    }
  }

  /**
   * Handle reconnection with exponential backoff
   * Implements: 1s, 2s, 4s, 8s, 16s (max)
   */
  private handleReconnect(): void {
    this.clearReconnectTimer();

    const maxAttempts = this.config.reconnectionAttempts ?? 5;

    if (this.connectionState.reconnectAttempts >= maxAttempts) {
      console.log('[WebSocket] Max reconnection attempts reached');
      this.updateStatus('error');
      return;
    }

    this.connectionState.reconnectAttempts++;

    // Calculate delay with exponential backoff (capped at 16s)
    const baseDelay = this.config.reconnectionDelay ?? 1000;
    const exponent = Math.min(this.connectionState.reconnectAttempts - 1, 4);
    const delay = baseDelay * Math.pow(2, exponent);

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.connectionState.reconnectAttempts}/${maxAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    console.log(`[WebSocket] Processing ${this.messageQueue.size()} queued messages`);

    while (this.messageQueue.size() > 0) {
      const message = this.messageQueue.peek();
      if (!message) {
        break;
      }

      try {
        this.send(message.event, message.data);
        this.messageQueue.dequeue();
      } catch (error) {
        console.error('[WebSocket] Failed to send queued message:', error);

        // Increment retries
        if (!this.messageQueue.incrementRetries(message.id)) {
          // Max retries exceeded, remove message
          console.warn('[WebSocket] Message exceeded max retries, removing:', message.id);
          this.messageQueue.dequeue();
        } else {
          // Stop processing queue on error
          break;
        }
      }
    }

    // Clean up failed messages
    this.messageQueue.removeFailedMessages();
  }

  /**
   * Start heartbeat ping/pong
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimer();

    const heartbeatInterval = 30000; // 30 seconds

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, heartbeatInterval);
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Update connection status and notify callbacks
   * @param status - New connection status
   */
  private updateStatus(status: ConnectionStatus): void {
    const oldStatus = this.connectionState.status;
    if (oldStatus !== status) {
      this.connectionState.status = status;
      console.log(`[WebSocket] Status changed: ${oldStatus} -> ${status}`);

      // Notify callbacks
      this.statusChangeCallbacks.forEach((callback) => {
        try {
          callback(status);
        } catch (error) {
          console.error('[WebSocket] Error in status change callback:', error);
        }
      });
    }
  }
}

/**
 * Factory function to create WebSocket connection
 * @param endpoint - WebSocket endpoint path
 * @param config - Optional configuration overrides
 * @returns WebSocketManager instance
 */
export function createWebSocketConnection(
  endpoint: string,
  config?: Partial<WebSocketConfig>
): WebSocketManager {
  // In development, use the backend URL directly for WebSocket connections
  // The Vite proxy handles HTTP requests but WebSocket connections work better
  // when connecting directly to the backend
  const getWebSocketUrl = () => {
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    // In development, connect directly to backend (port 8000)
    // In production, use the same origin (will be proxied by nginx/reverse proxy)
    if (import.meta.env.DEV) {
      return 'http://localhost:8000';
    }
    return window.location.origin;
  };

  const defaultConfig: WebSocketConfig = {
    url: getWebSocketUrl(),
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 300000, // 5 minutes
    enablePollingFallback: true,
  };

  const manager = new WebSocketManager({ ...defaultConfig, ...config });
  manager.connect(endpoint);
  return manager;
}
