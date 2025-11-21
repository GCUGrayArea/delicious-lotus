/**
 * WebSocket Type Definitions
 * TypeScript interfaces for all WebSocket event types and connection state
 */

import type { GenerationStatus, CompositionStatus } from '@/services/ad-generator/types';

// ============================================================================
// Connection States
// ============================================================================

/**
 * WebSocket connection status
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket event types from API specification Section D
 */
export type WebSocketEventType =
  | 'progress'
  | 'clip_completed'
  | 'status_change'
  | 'completed'
  | 'error'
  | 'encoding_progress';

// ============================================================================
// Generation Progress Events
// ============================================================================

/**
 * Generation progress event - step updates with percentage
 */
export interface ProgressEvent {
  type: 'progress';
  data: {
    step: string;
    clip_number: number;
    total_clips: number;
    percentage: number;
    message: string;
  };
}

/**
 * Clip completed event - individual clip completion notification
 */
export interface ClipCompletedEvent {
  type: 'clip_completed';
  data: {
    clip_id: string;
    thumbnail_url: string;
    duration: number;
  };
}

/**
 * Status change event - generation status transitions
 */
export interface StatusChangeEvent {
  type: 'status_change';
  data: {
    old_status: GenerationStatus | CompositionStatus;
    new_status: GenerationStatus | CompositionStatus;
    message: string;
  };
}

/**
 * Completion event - final video ready notification
 */
export interface CompletedEvent {
  type: 'completed';
  data: {
    video_url: string;
    thumbnail_url: string;
    duration: number;
  };
}

/**
 * Error event - error notifications
 */
export interface ErrorEvent {
  type: 'error';
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================================
// Composition Progress Events
// ============================================================================

/**
 * Encoding progress event - frame-level progress updates
 */
export interface EncodingProgressEvent {
  type: 'encoding_progress';
  data: {
    percentage: number;
    frames_processed: number;
    total_frames: number;
    estimated_remaining: number;
  };
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type for all WebSocket events
 */
export type WebSocketEvent =
  | ProgressEvent
  | ClipCompletedEvent
  | StatusChangeEvent
  | CompletedEvent
  | ErrorEvent
  | EncodingProgressEvent;

/**
 * Generic event handler type
 */
export type EventHandler<T = unknown> = (data: T) => void;

// ============================================================================
// Configuration
// ============================================================================

/**
 * WebSocket configuration options
 */
export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  /** Maximum reconnection attempts (default: 5) */
  reconnectionAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectionDelay?: number;
  /** Connection timeout in ms (default: 300000 / 5 minutes) */
  timeout?: number;
  /** Enable automatic fallback to polling (default: true) */
  enablePollingFallback?: boolean;
}

// ============================================================================
// Connection State
// ============================================================================

/**
 * WebSocket connection state tracking
 */
export interface ConnectionState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Timestamp when connection was established */
  connectedAt?: Date;
  /** Timestamp when connection was lost */
  disconnectedAt?: Date;
  /** Number of reconnection attempts made */
  reconnectAttempts: number;
  /** Last error encountered */
  lastError?: Error;
}
