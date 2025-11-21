import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatTime } from '../../../utils/ad-generator/video';
import styles from './Timeline.module.css';

interface TimelineProps {
  currentTime: number;
  duration: number;
  buffered: TimeRanges | null;
  onSeek: (time: number) => void;
}

export function Timeline({
  currentTime,
  duration,
  buffered,
  onSeek,
}: TimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const getTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration, position * duration));
  };

  const handleClick = (e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const time = getTimeFromPosition(e.clientX);
    setHoverTime(time);

    if (isDragging) {
      onSeek(time);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleWindowMouseMove = (e: MouseEvent) => {
        const time = getTimeFromPosition(e.clientX);
        onSeek(time);
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, duration]);

  // Calculate buffered percentage
  const bufferedPercentage = useMemo(() => {
    if (!buffered || !duration) return 0;
    try {
      const bufferedEnd = buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
      return (bufferedEnd / duration) * 100;
    } catch {
      return 0;
    }
  }, [buffered, duration]);

  const progressPercentage = (currentTime / duration) * 100 || 0;

  return (
    <div
      ref={timelineRef}
      className={styles.timeline}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverTime(null)}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
    >
      {/* Buffered indicator */}
      <div
        className={styles.timeline__buffered}
        style={{ width: `${bufferedPercentage}%` }}
      />

      {/* Progress indicator */}
      <div
        className={styles.timeline__progress}
        style={{ width: `${progressPercentage}%` }}
      />

      {/* Scrubber handle */}
      <div
        className={styles.timeline__handle}
        style={{ left: `${progressPercentage}%` }}
      />

      {/* Hover time preview */}
      {hoverTime !== null && (
        <div
          className={styles.timeline__preview}
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}
