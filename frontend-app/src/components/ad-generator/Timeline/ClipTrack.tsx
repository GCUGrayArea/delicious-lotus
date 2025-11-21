/**
 * ClipTrack Component
 * Displays and manages clips on the timeline with drag-and-drop support
 */

import React, { useState, useRef, useCallback } from 'react';
import type { TimelineClip, TransitionType } from '@/utils/ad-generator/timeline';
import { formatTime } from '@/utils/ad-generator/timeline';
import { TransitionPicker } from './TransitionPicker';
import styles from './ClipTrack.module.css';

export interface ClipTrackProps {
  /** Array of timeline clips */
  clips: TimelineClip[];
  /** Currently selected clip ID */
  selectedClipId: string | null;
  /** Pixels per second for zoom */
  pixelsPerSecond: number;
  /** Callback when clip is selected */
  onSelectClip: (clipId: string) => void;
  /** Callback when clips are reordered */
  onReorderClip: (fromIndex: number, toIndex: number) => void;
  /** Callback when clip is deleted */
  onDeleteClip: (clipId: string) => void;
  /** Callback when clip duration is trimmed */
  onTrimClip: (clipId: string, newDuration: number) => void;
  /** Callback when transition is changed */
  onSetTransition: (clipId: string, position: 'in' | 'out', transition: TransitionType) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual clip component
 */
interface ClipItemProps {
  clip: TimelineClip;
  isSelected: boolean;
  pixelsPerSecond: number;
  index: number;
  onSelect: () => void;
  onDelete: () => void;
  onTrim: (newDuration: number) => void;
  onSetTransition: (position: 'in' | 'out', transition: TransitionType) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const ClipItem: React.FC<ClipItemProps> = ({
  clip,
  isSelected,
  pixelsPerSecond,
  index,
  onSelect,
  onDelete,
  onTrim,
  onSetTransition,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimHandleActive, setTrimHandleActive] = useState<'start' | 'end' | null>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  const width = clip.duration * pixelsPerSecond;
  const left = clip.startTime * pixelsPerSecond;

  // Handle trim drag
  const handleTrimMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.stopPropagation();
    setIsTrimming(true);
    setTrimHandleActive(handle);

    const startX = e.clientX;
    const startDuration = clip.duration;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (handle === 'end') {
        const newDuration = Math.max(0.1, Math.min(startDuration + deltaTime, clip.originalDuration));
        onTrim(newDuration);
      }
      // Note: Start trim would require more complex logic with clip repositioning
    };

    const handleMouseUp = () => {
      setIsTrimming(false);
      setTrimHandleActive(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle keyboard delete
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div
      ref={clipRef}
      className={`${styles.clip} ${isSelected ? styles['clip--selected'] : ''} ${
        isTrimming ? styles['clip--trimming'] : ''
      }`}
      style={{ left: `${left}px`, width: `${width}px` }}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      role="button"
      tabIndex={0}
    >
      {/* Thumbnail */}
      <div className={styles.clip__thumbnail}>
        {clip.thumbnailUrl ? (
          <img src={clip.thumbnailUrl} alt={`Clip ${index + 1}`} className={styles.clip__image} />
        ) : (
          <div className={styles.clip__placeholder}>
            <svg
              className={styles.clip__placeholderIcon}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        )}
      </div>

      {/* Clip info */}
      <div className={styles.clip__info}>
        <div className={styles.clip__number}>Clip {index + 1}</div>
        <div className={styles.clip__duration}>{formatTime(clip.duration)}</div>
      </div>

      {/* Transition indicators */}
      {clip.transitionIn && index > 0 && (
        <div className={styles.clip__transitionIn}>
          <TransitionPicker
            currentTransition={clip.transitionIn}
            onSelect={(transition) => onSetTransition('in', transition)}
            position="in"
          />
        </div>
      )}

      {clip.transitionOut && (
        <div className={styles.clip__transitionOut}>
          <TransitionPicker
            currentTransition={clip.transitionOut}
            onSelect={(transition) => onSetTransition('out', transition)}
            position="out"
          />
        </div>
      )}

      {/* Trim handles */}
      {isSelected && (
        <>
          <div
            className={`${styles.clip__trimHandle} ${styles['clip__trimHandle--start']} ${
              trimHandleActive === 'start' ? styles['clip__trimHandle--active'] : ''
            }`}
            onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
            title="Drag to trim start"
          />
          <div
            className={`${styles.clip__trimHandle} ${styles['clip__trimHandle--end']} ${
              trimHandleActive === 'end' ? styles['clip__trimHandle--active'] : ''
            }`}
            onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
            title="Drag to trim end"
          />
        </>
      )}

      {/* Delete button (shown when selected) */}
      {isSelected && (
        <button
          className={styles.clip__deleteButton}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete clip (Del)"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};

/**
 * ClipTrack Component
 * Container for all clips with drag-and-drop reordering
 */
export const ClipTrack: React.FC<ClipTrackProps> = ({
  clips,
  selectedClipId,
  pixelsPerSecond,
  onSelectClip,
  onReorderClip,
  onDeleteClip,
  onTrimClip,
  onSetTransition,
  className = '',
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== toIndex) {
        onReorderClip(draggedIndex, toIndex);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, onReorderClip]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // Calculate total width
  const totalWidth = clips.reduce((max, clip) => Math.max(max, clip.endTime), 0) * pixelsPerSecond;

  return (
    <div className={`${styles.clipTrack} ${className}`}>
      <div
        className={styles.clipTrack__container}
        style={{ width: `${totalWidth}px`, minWidth: '100%' }}
        onDragEnd={handleDragEnd}
      >
        {clips.length === 0 ? (
          <div className={styles.clipTrack__empty}>
            <p>No clips in timeline</p>
            <p className={styles.clipTrack__emptyHint}>
              Clips will appear here when your video is generated
            </p>
          </div>
        ) : (
          clips.map((clip, index) => (
            <ClipItem
              key={clip.id}
              clip={clip}
              isSelected={clip.id === selectedClipId}
              pixelsPerSecond={pixelsPerSecond}
              index={index}
              onSelect={() => onSelectClip(clip.id)}
              onDelete={() => onDeleteClip(clip.id)}
              onTrim={(newDuration) => onTrimClip(clip.id, newDuration)}
              onSetTransition={(position, transition) =>
                onSetTransition(clip.id, position, transition)
              }
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>
    </div>
  );
};

ClipTrack.displayName = 'ClipTrack';
