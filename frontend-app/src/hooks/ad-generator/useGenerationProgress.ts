/**
 * useGenerationProgress Hook
 * Manages generation progress with WebSocket real-time updates and polling fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { getGeneration, cancelGeneration } from '@/services/ad-generator/services/generation';
import type {
  GenerationStatus,
  ClipInfo,
  GenerationProgress,
} from '@/services/ad-generator/types';
import type {
  ProgressEvent,
  ClipCompletedEvent,
  StatusChangeEvent,
  CompletedEvent,
  ErrorEvent,
} from '@/types/ad-generator/websocket';

/**
 * Hook options
 */
export interface UseGenerationProgressOptions {
  /** Generation ID to track */
  generationId: string;
  /** Auto-start tracking on mount (default: true) */
  autoStart?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  /** Callback when generation completes */
  onComplete?: (data: CompletedEvent['data']) => void;
  /** Callback when error occurs */
  onError?: (error: ErrorEvent['data']) => void;
  /** Callback when status changes */
  onStatusChange?: (oldStatus: GenerationStatus, newStatus: GenerationStatus) => void;
}

/**
 * Hook return value
 */
export interface UseGenerationProgressReturn {
  // Generation state
  status: GenerationStatus;
  progress: GenerationProgress | null;
  clips: ClipInfo[];
  error: string | null;
  isLoading: boolean;

  // Real-time connection state
  isConnected: boolean;
  isPolling: boolean;

  // Progress metadata
  currentStep: string;
  estimatedTimeRemaining: number | null;

  // Actions
  cancel: () => Promise<void>;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Default progress state
 */
const DEFAULT_PROGRESS: GenerationProgress = {
  current_step: 'Initializing...',
  steps_completed: 0,
  total_steps: 5,
  percentage: 0,
};

/**
 * Hook for tracking generation progress with real-time updates
 *
 * @example
 * ```typescript
 * const { status, progress, clips, cancel } = useGenerationProgress({
 *   generationId: 'abc123',
 *   onComplete: (data) => navigate(`/preview/${data.video_url}`),
 * });
 * ```
 */
export function useGenerationProgress(
  options: UseGenerationProgressOptions
): UseGenerationProgressReturn {
  const {
    generationId,
    autoStart = true,
    pollingInterval = 5000,
    onComplete,
    onError,
    onStatusChange,
  } = options;

  // State
  const [status, setStatus] = useState<GenerationStatus>('queued');
  const [progress, setProgress] = useState<GenerationProgress | null>(DEFAULT_PROGRESS);
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [isPollingActive, setIsPollingActive] = useState(false);

  // Refs
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const previousStatus = useRef<GenerationStatus>('queued');
  const stopPollingRef = useRef<() => void>(() => {});

  // WebSocket connection
  const {
    isConnected,
    isPolling: wsIsPolling,
    subscribe,
    disconnect: wsDisconnect,
  } = useWebSocket({
    endpoint: `/ws/generations/${generationId}`,
    autoConnect: autoStart,
    enablePollingFallback: true,
    onError: (err) => {
      console.error('[useGenerationProgress] WebSocket error:', err);
      // Don't set error state for connection issues - we'll fallback to polling
    },
  });

  /**
   * Fetch generation status from API
   */
  const fetchStatus = useCallback(async () => {
    try {
      console.log(`[INFO] Fetching generation status for ${generationId}...`);
      const response = await getGeneration(generationId);

      if (!isMounted.current) return;
      
      console.log(`[INFO] Status: ${response.status}, Progress: ${response.progress?.percentage?.toFixed(1) || 0}%`);

      // Update state
      setStatus(response.status);
      setProgress(response.progress);
      setClips(response.clips_generated || []);
      setIsLoading(false);
      setError(null);

      // Check for status change
      if (previousStatus.current !== response.status) {
        if (onStatusChange) {
          onStatusChange(previousStatus.current, response.status);
        }
        previousStatus.current = response.status;
      }

      // Handle completion
      if (response.status === 'completed') {
        stopPollingRef.current();
        // Note: onComplete will be called via WebSocket event or we can call it here
      }

      // Handle failure
      if (response.status === 'failed' || response.status === 'cancelled') {
        stopPollingRef.current();
        if (response.status === 'failed') {
          setError('Generation failed. Please try again.');
        }
      }

      return response;
    } catch (err) {
      console.error('[useGenerationProgress] Fetch error:', err);
      if (isMounted.current) {
        setError('Failed to fetch generation status');
        setIsLoading(false);
      }
    }
  }, [generationId, onStatusChange]);

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(() => {
    if (pollingTimer.current) return;

    console.log('[useGenerationProgress] Starting polling fallback');
    setIsPollingActive(true);
    pollingTimer.current = setInterval(() => {
      fetchStatus();
    }, pollingInterval);

    // Fetch immediately
    fetchStatus();
  }, [fetchStatus, pollingInterval]);

  /**
   * Stop polling fallback
   */
  const stopPolling = useCallback(() => {
    if (pollingTimer.current) {
      console.log('[useGenerationProgress] Stopping polling');
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
      setIsPollingActive(false);
    }
  }, []);

  // Update ref after stopPolling is defined - use useEffect to avoid setting ref during render
  useEffect(() => {
    stopPollingRef.current = stopPolling;
  }, [stopPolling]);

  /**
   * Handle progress event from WebSocket
   */
  const handleProgress = useCallback((data: ProgressEvent['data']) => {
    console.log(`[PROGRESS] Step: ${data.step}, ${data.percentage.toFixed(1)}% complete`);
    if (data.clip_number && data.total_clips) {
      console.log(`[PROGRESS] Clip ${data.clip_number}/${data.total_clips} - ${data.message || ''}`);
    } else if (data.message) {
      console.log(`[PROGRESS] ${data.message}`);
    }

    setProgress(() => ({
      current_step: data.step,
      steps_completed: Math.floor((data.percentage / 100) * 5),
      total_steps: 5,
      percentage: data.percentage,
      current_clip: data.clip_number,
      total_clips: data.total_clips,
    }));

    // Extract estimated time from message if available
    const timeMatch = data.message.match(/(\d+)\s*(min|sec)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1], 10);
      const unit = timeMatch[2].toLowerCase();
      setEstimatedTimeRemaining(unit === 'min' ? value * 60 : value);
    }
  }, []);

  /**
   * Handle clip completed event from WebSocket
   */
  const handleClipCompleted = useCallback((data: ClipCompletedEvent['data']) => {
    console.log(`[OK] Clip completed: ${data.clip_id} (${data.duration.toFixed(1)}s)`);
    if (data.thumbnail_url) {
      console.log(`[INFO] Thumbnail URL: ${data.thumbnail_url}`);
    }

    setClips((prev) => [
      ...prev,
      {
        clip_id: data.clip_id,
        thumbnail_url: data.thumbnail_url,
        duration: data.duration,
        status: 'completed',
      },
    ]);
  }, []);

  /**
   * Handle status change event from WebSocket
   */
  const handleStatusChange = useCallback(
    (data: StatusChangeEvent['data']) => {
      console.log(`[STATUS] Changed from ${data.old_status} to ${data.new_status}`);

      const newStatus = data.new_status as GenerationStatus;
      setStatus(newStatus);

      if (onStatusChange) {
        onStatusChange(data.old_status as GenerationStatus, newStatus);
      }

      // Stop polling on terminal states
      if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
        stopPolling();
      }
    },
    [onStatusChange, stopPolling]
  );

  /**
   * Handle completed event from WebSocket
   */
  const handleCompleted = useCallback(
    (data: CompletedEvent['data']) => {
      console.log('[SUCCESS] Generation completed!');
      if (data.video_url) {
        console.log(`[INFO] Video URL: ${data.video_url}`);
      }

      setStatus('completed');
      stopPolling();

      if (onComplete) {
        onComplete(data);
      }
    },
    [onComplete, stopPolling]
  );

  /**
   * Handle error event from WebSocket
   */
  const handleError = useCallback(
    (data: ErrorEvent['data']) => {
      console.error(`[ERROR] Generation error: ${data.message}`);
      if (data.recoverable) {
        console.log('[INFO] Error is recoverable, continuing...');
      } else {
        console.error('[ERROR] Fatal error, generation stopped');
      }

      setError(data.message);

      if (onError) {
        onError(data);
      }

      if (!data.recoverable) {
        setStatus('failed');
        stopPolling();
      }
    },
    [onError, stopPolling]
  );

  /**
   * Subscribe to WebSocket events
   */
  useEffect(() => {
    subscribe<ProgressEvent['data']>('progress', handleProgress);
    subscribe<ClipCompletedEvent['data']>('clip_completed', handleClipCompleted);
    subscribe<StatusChangeEvent['data']>('status_change', handleStatusChange);
    subscribe<CompletedEvent['data']>('completed', handleCompleted);
    subscribe<ErrorEvent['data']>('error', handleError);

    return () => {
      // Cleanup is handled by useWebSocket
    };
  }, [
    subscribe,
    handleProgress,
    handleClipCompleted,
    handleStatusChange,
    handleCompleted,
    handleError,
  ]);

  /**
   * Start polling if WebSocket is not connected
   */
  useEffect(() => {
    if (autoStart && !isConnected && wsIsPolling) {
      startPolling();
    } else if (isConnected && pollingTimer.current) {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [autoStart, isConnected, wsIsPolling, startPolling, stopPolling]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    if (autoStart) {
      fetchStatus();
    }

    return () => {
      isMounted.current = false;
      stopPolling();
      wsDisconnect();
    };
  }, [autoStart, fetchStatus, stopPolling, wsDisconnect]);

  /**
   * Cancel generation
   */
  const cancel = useCallback(async () => {
    try {
      await cancelGeneration(generationId);
      setStatus('cancelled');
      stopPolling();
    } catch (err) {
      console.error('[useGenerationProgress] Cancel error:', err);
      setError('Failed to cancel generation');
      throw err;
    }
  }, [generationId, stopPolling]);

  /**
   * Retry connection/fetching
   */
  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  /**
   * Manually refresh status
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  return {
    // Generation state
    status,
    progress,
    clips,
    error,
    isLoading,

    // Real-time connection state
    isConnected,
    isPolling: wsIsPolling || isPollingActive,

    // Progress metadata
    currentStep: progress?.current_step || 'Initializing...',
    estimatedTimeRemaining,

    // Actions
    cancel,
    retry,
    refresh,
  };
}
