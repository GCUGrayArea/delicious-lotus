import { useState, useRef, useEffect } from 'react';
import { Timeline } from './Timeline';
import { formatTime } from '../../../utils/ad-generator/video';
import {
  PlayIcon,
  PauseIcon,
  VolumeOnIcon,
  VolumeOffIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  DownloadIcon,
} from './icons';
import styles from './VideoControls.module.css';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  playbackRate: number;
  buffered: TimeRanges | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onPlaybackRateChange: (rate: number) => void;
  showDownload?: boolean;
  onDownload?: () => void;
}

export function VideoControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isFullscreen,
  playbackRate,
  buffered,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onPlaybackRateChange,
  showDownload,
  onDownload,
}: VideoControlsProps) {
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showPlaybackMenu, setShowPlaybackMenu] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-hide controls after 3 seconds of inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) setShowControls(false);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current !== undefined) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  // Show controls when paused
  useEffect(() => {
    if (!isPlaying && !showControls) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowControls(true);
    }
    if (!isPlaying && hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
  }, [isPlaying, showControls]);

  return (
    <div
      className={`${styles.videoControls} ${showControls ? styles.videoControlsVisible : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Timeline scrubber */}
      <Timeline
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        onSeek={onSeek}
      />

      {/* Control buttons */}
      <div className={styles.videoControls__bar}>
        <div className={styles.videoControls__left}>
          {/* Play/Pause */}
          <button
            className={styles.videoControls__button}
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>

          {/* Volume control */}
          <div
            className={styles.videoControls__volume}
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              className={styles.videoControls__button}
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted ? <VolumeOffIcon size={20} /> : <VolumeOnIcon size={20} />}
            </button>

            {showVolumeSlider && (
              <div className={styles.videoControls__volumeSlider}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  aria-label="Volume"
                  className={styles.videoControls__volumeInput}
                />
              </div>
            )}
          </div>

          {/* Time display */}
          <span className={styles.videoControls__time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className={styles.videoControls__right}>
          {/* Playback speed */}
          <div className={styles.videoControls__speed}>
            <button
              className={styles.videoControls__button}
              onClick={() => setShowPlaybackMenu(!showPlaybackMenu)}
              aria-label="Playback speed"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            {showPlaybackMenu && (
              <div className={styles.videoControls__speedMenu}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    className={`${styles.videoControls__speedOption} ${
                      rate === playbackRate ? styles.videoControls__speedOptionActive : ''
                    }`}
                    onClick={() => {
                      onPlaybackRateChange(rate);
                      setShowPlaybackMenu(false);
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download button */}
          {showDownload && onDownload && (
            <button
              className={styles.videoControls__button}
              onClick={onDownload}
              aria-label="Download video"
              title="Download video"
            >
              <DownloadIcon size={20} />
            </button>
          )}

          {/* Fullscreen */}
          <button
            className={styles.videoControls__button}
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <FullscreenExitIcon size={20} /> : <FullscreenIcon size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
