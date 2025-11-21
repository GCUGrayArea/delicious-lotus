/**
 * TimelineEditor Component
 * Main timeline editor with clips, playback controls, and composition
 */

import React, { useState, useEffect } from 'react';
import { useTimeline } from '@/hooks/ad-generator/useTimeline';
import { TimeRuler } from './TimeRuler';
import { ClipTrack } from './ClipTrack';
import { Button } from '@/components/ad-generator/ui/Button';
import { Spinner } from '@/components/ad-generator/ui/Spinner';
import { createComposition } from '@/services/ad-generator/services/composition';
import { getGenerationAssets } from '@/services/ad-generator/services/generation';
import { timelineClipsToClipConfig, formatTime, ZOOM_LEVELS } from '@/utils/ad-generator/timeline';
import type { ClipInfo } from '@/services/ad-generator/types';
import styles from './TimelineEditor.module.css';

export interface TimelineEditorProps {
  /** Generation ID to load clips from */
  generationId: string;
  /** Initial clips (optional, will fetch if not provided) */
  initialClips?: ClipInfo[];
  /** Callback when composition is created */
  onCompositionCreated?: (compositionId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TimelineEditor Component
 * Complete timeline editor with playback controls and composition submission
 */
export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  generationId,
  initialClips,
  onCompositionCreated,
  className = '',
}) => {
  // Timeline state
  const {
    clips,
    selectedClipId,
    currentTime,
    totalDuration,
    isPlaying,
    zoomLevel,
    pixelsPerSecond,
    addClips,
    removeClip,
    reorderClip,
    trimClipDuration,
    selectClip,
    setClipTransition,
    play,
    pause,
    stop,
    seek,
    zoomIn,
    zoomOut,
    validate,
  } = useTimeline({ initialClips });

  // Loading state
  const [isLoadingClips, setIsLoadingClips] = useState(!initialClips);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Composition state
  const [isCreatingComposition, setIsCreatingComposition] = useState(false);
  const [compositionError, setCompositionError] = useState<string | null>(null);

  const loadClips = async () => {
    try {
      setIsLoadingClips(true);
      setLoadError(null);

      const response = await getGenerationAssets(generationId);

      if (response.assets.clips && response.assets.clips.length > 0) {
        addClips(response.assets.clips);
      } else {
        setLoadError('No clips found for this generation');
      }
    } catch (error) {
      console.error('Failed to load clips:', error);
      setLoadError('Failed to load clips. Please try again.');
    } finally {
      setIsLoadingClips(false);
    }
  };

  // Load clips from API if not provided
  useEffect(() => {
    if (!initialClips && generationId) {
      loadClips();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId, initialClips]);

  // Handle composition creation
  const handleCreateComposition = async () => {
    // Validate timeline
    const validation = validate();
    if (!validation.valid) {
      setCompositionError(`Timeline validation failed: ${validation.errors.join(', ')}`);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn('Timeline warnings:', validation.warnings);
    }

    try {
      setIsCreatingComposition(true);
      setCompositionError(null);

      // Convert timeline clips to API format
      const clipConfigs = timelineClipsToClipConfig(clips);

      // Create composition
      const response = await createComposition({
        generation_id: generationId,
        clips: clipConfigs,
        output: {
          quality: 'high',
        },
      });

      // Notify parent component
      if (onCompositionCreated) {
        onCompositionCreated(response.composition_id);
      }
    } catch (error) {
      console.error('Failed to create composition:', error);
      setCompositionError('Failed to create composition. Please try again.');
    } finally {
      setIsCreatingComposition(false);
    }
  };

  // Render loading state
  if (isLoadingClips) {
    return (
      <div className={`${styles.timelineEditor} ${className}`}>
        <div className={styles.timelineEditor__loading}>
          <Spinner size="lg" label="Loading clips..." />
        </div>
      </div>
    );
  }

  // Render error state
  if (loadError) {
    return (
      <div className={`${styles.timelineEditor} ${className}`}>
        <div className={styles.timelineEditor__error}>
          <p className={styles.timelineEditor__errorMessage}>{loadError}</p>
          <Button onClick={loadClips} variant="primary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.timelineEditor} ${className}`}>
      {/* Header with controls */}
      <div className={styles.timelineEditor__header}>
        <div className={styles.timelineEditor__info}>
          <h3 className={styles.timelineEditor__title}>Timeline Editor</h3>
          <div className={styles.timelineEditor__stats}>
            <span className={styles.timelineEditor__stat}>
              {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
            </span>
            <span className={styles.timelineEditor__stat}>
              Duration: {formatTime(totalDuration)}
            </span>
            <span className={styles.timelineEditor__stat}>
              Current: {formatTime(currentTime)}
            </span>
          </div>
        </div>

        <div className={styles.timelineEditor__actions}>
          {/* Zoom controls */}
          <div className={styles.timelineEditor__zoomControls}>
            <Button
              onClick={zoomOut}
              variant="secondary"
              size="sm"
              disabled={zoomLevel === 0}
              title="Zoom out"
            >
              −
            </Button>
            <span className={styles.timelineEditor__zoomLabel}>
              {ZOOM_LEVELS[zoomLevel].label}
            </span>
            <Button
              onClick={zoomIn}
              variant="secondary"
              size="sm"
              disabled={zoomLevel === ZOOM_LEVELS.length - 1}
              title="Zoom in"
            >
              +
            </Button>
          </div>

          {/* Playback controls */}
          <div className={styles.timelineEditor__playbackControls}>
            <Button
              onClick={stop}
              variant="secondary"
              size="sm"
              disabled={currentTime === 0}
              title="Stop"
            >
              ⏹
            </Button>
            <Button
              onClick={isPlaying ? pause : play}
              variant="primary"
              size="sm"
              disabled={clips.length === 0}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </Button>
          </div>

          {/* Composition button */}
          <Button
            onClick={handleCreateComposition}
            variant="primary"
            disabled={clips.length === 0 || isCreatingComposition}
            loading={isCreatingComposition}
            title="Create final composition"
          >
            {isCreatingComposition ? 'Creating...' : 'Create Composition'}
          </Button>
        </div>
      </div>

      {/* Error message */}
      {compositionError && (
        <div className={styles.timelineEditor__compositionError}>
          <p>{compositionError}</p>
          <button
            className={styles.timelineEditor__errorDismiss}
            onClick={() => setCompositionError(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {/* Timeline viewport */}
      <div className={styles.timelineEditor__viewport}>
        {/* Time ruler */}
        <TimeRuler
          duration={totalDuration}
          currentTime={currentTime}
          pixelsPerSecond={pixelsPerSecond}
          onSeek={seek}
        />

        {/* Clip track */}
        <ClipTrack
          clips={clips}
          selectedClipId={selectedClipId}
          pixelsPerSecond={pixelsPerSecond}
          onSelectClip={selectClip}
          onReorderClip={reorderClip}
          onDeleteClip={removeClip}
          onTrimClip={trimClipDuration}
          onSetTransition={setClipTransition}
        />
      </div>

      {/* Instructions */}
      {clips.length > 0 && (
        <div className={styles.timelineEditor__instructions}>
          <p>
            <strong>Tips:</strong> Drag clips to reorder • Click to select •
            Delete/Backspace to remove • Drag edges to trim •
            Click transition icons to change effects
          </p>
        </div>
      )}
    </div>
  );
};

TimelineEditor.displayName = 'TimelineEditor';
