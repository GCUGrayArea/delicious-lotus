/**
 * useWebSocket Hook
 * React hook for WebSocket connection management with auto-reconnection and polling fallback
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketManager } from '@/utils/ad-generator/websocket';
import type {
  ConnectionStatus,
  ConnectionState,
  EventHandler,
  WebSocketConfig,
} from '@/types/ad-generator/websocket';

/**
 * Hook options
 */
export interface UseWebSocketOptions {
  /** WebSocket endpoint path (e.g., '/ws/generations/abc123') */
  endpoint: string;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Callback when connection is established */
  onConnect?: () => void;
  /** Callback when connection is lost */
  onDisconnect?: () => void;
  /** Callback when connection error occurs */
  onError?: (error: Error) => void;
  /** Enable automatic polling fallback (default: true) */
  enablePollingFallback?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  /** WebSocket configuration overrides */
  config?: Partial<WebSocketConfig>;
}

/**
 * Hook return value
 */
export interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionState: ConnectionState;

  // Connection control
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Event management
  subscribe: <T>(eventType: string, handler: EventHandler<T>) => void;
  unsubscribe: (eventType: string, handler?: EventHandler) => void;
  emit: (event: string, data: any) => void;

  // Fallback polling
  enablePolling: () => void;
  disablePolling: () => void;
  isPolling: boolean;
}

/**
 * Initial connection state
 */
const initialConnectionState: ConnectionState = {
  status: 'disconnected',
  reconnectAttempts: 0,
};

/**
 * React hook for WebSocket connections
 * Provides connection management, event subscription, and automatic polling fallback
 *
 * @example
 * ```typescript
 * const { isConnected, subscribe, disconnect } = useWebSocket({
 *   endpoint: `/ws/generations/${generationId}`,
 *   autoConnect: true,
 *   onConnect: () => console.log('Connected'),
 * });
 *
 * useEffect(() => {
 *   subscribe<ProgressEvent['data']>('progress', (data) => {
 *     console.log('Progress:', data.percentage);
 *   });
 *
 *   return () => disconnect();
 * }, [subscribe, disconnect]);
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    endpoint,
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
    enablePollingFallback = true,
    config,
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isPolling, setIsPolling] = useState(false);

  // Refs
  const wsManager = useRef<WebSocketManager | null>(null);
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const enablePollingRef = useRef<() => void>(() => {});
  const disablePollingRef = useRef<() => void>(() => {});

  // Initialize WebSocket manager
  useEffect(() => {
    // In development, use the backend URL directly for WebSocket connections
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

    wsManager.current = new WebSocketManager({ ...defaultConfig, ...config });

    // Listen for status changes
    wsManager.current.onStatusChange((status) => {
      if (isMounted.current) {
        setConnectionStatus(status);
      }
    });

    // Auto-connect if enabled
    if (autoConnect) {
      wsManager.current.connect(endpoint).catch((error) => {
        console.error('[useWebSocket] Connection error:', error);
        if (onError) {
          onError(error);
        }
      });
    }

    // Cleanup on unmount
    return () => {
      isMounted.current = false;
      if (wsManager.current) {
        wsManager.current.disconnect();
      }
      if (pollingTimer.current) {
        clearInterval(pollingTimer.current);
      }
    };
  }, [endpoint, autoConnect, config, onError]);

  // Handle connection lifecycle callbacks
  useEffect(() => {
    if (connectionStatus === 'connected' && onConnect) {
      onConnect();
    } else if (connectionStatus === 'disconnected' && onDisconnect) {
      onDisconnect();
    } else if (connectionStatus === 'error') {
      const state = wsManager.current?.getConnectionState();
      if (state?.lastError && onError) {
        onError(state.lastError);
      }
    }
  }, [connectionStatus, onConnect, onDisconnect, onError]);

  // Auto-fallback to polling on connection failure
  useEffect(() => {
    if (enablePollingFallback && connectionStatus === 'error') {
      console.log('[useWebSocket] Connection failed, enabling polling fallback');
      enablePollingRef.current();
    } else if (connectionStatus === 'connected' && isPolling) {
      console.log('[useWebSocket] Connection restored, disabling polling');
      disablePollingRef.current();
    }
  }, [connectionStatus, enablePollingFallback, isPolling]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!wsManager.current) {
      return;
    }

    wsManager.current.connect(endpoint).catch((error) => {
      console.error('[useWebSocket] Connect error:', error);
      if (onError) {
        onError(error);
      }
    });
  }, [endpoint, onError]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (!wsManager.current) {
      return;
    }

    wsManager.current.disconnect();
  }, []);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  /**
   * Subscribe to WebSocket event
   */
  const subscribe = useCallback(<T,>(eventType: string, handler: EventHandler<T>) => {
    if (!wsManager.current) {
      return;
    }

    wsManager.current.subscribe<T>(eventType, handler);
  }, []);

  /**
   * Unsubscribe from WebSocket event
   */
  const unsubscribe = useCallback((eventType: string, handler?: EventHandler) => {
    if (!wsManager.current) {
      return;
    }

    wsManager.current.unsubscribe(eventType, handler);
  }, []);

  /**
   * Send event to server
   */
  const emit = useCallback((event: string, data: any) => {
    if (!wsManager.current) {
      return;
    }

    wsManager.current.send(event, data);
  }, []);

  /**
   * Enable polling fallback
   * Note: Actual polling implementation should be done by the consumer
   * using the generationService.getStatus() or compositionService.getStatus()
   */
  const enablePolling = useCallback(() => {
    if (isPolling) {
      return;
    }

    console.log('[useWebSocket] Polling enabled');
    setIsPolling(true);

    // The actual polling logic should be implemented by the consumer
    // This just sets the flag to indicate polling is active
  }, [isPolling]);

  /**
   * Disable polling fallback
   */
  const disablePolling = useCallback(() => {
    if (!isPolling) {
      return;
    }

    console.log('[useWebSocket] Polling disabled');

    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }

    setIsPolling(false);
  }, [isPolling]);

  // Update refs after callbacks are defined
  useEffect(() => {
    enablePollingRef.current = enablePolling;
    disablePollingRef.current = disablePolling;
  }, [enablePolling, disablePolling]);

  return {
    // Connection state
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    connectionState: wsManager.current?.getConnectionState() ?? initialConnectionState,

    // Connection control
    connect,
    disconnect,
    reconnect,

    // Event management
    subscribe,
    unsubscribe,
    emit,

    // Fallback polling
    enablePolling,
    disablePolling,
    isPolling,
  };
}
