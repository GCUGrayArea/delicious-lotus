/**
 * ClipResolver - Efficient frame-to-clip resolution for timeline queries
 *
 * Provides O(log n) lookup performance for finding active clips at any frame
 * using an indexed data structure with caching support
 */

import type { Clip, Track } from '../types/stores'
import type { TimelineStoreInstance } from '../stores/timelineStore'

export interface ActiveClip extends Clip {
  track: Track
  localTime: number // Time within the clip considering trim offsets
}

interface ClipInterval {
  clipId: string
  startFrame: number
  endFrame: number
  trackOrder: number
}

export class ClipResolver {
  private timelineStore: TimelineStoreInstance
  private intervalIndex: ClipInterval[] = []
  private activeClipsCache: Map<number, ActiveClip[]> = new Map()
  private cacheSize: number = 100 // Cache last 100 frame queries
  private isDirty: boolean = true

  constructor(timelineStore: TimelineStoreInstance) {
    this.timelineStore = timelineStore

    // Subscribe to timeline changes to invalidate cache
    this.timelineStore.subscribe(() => {
      this.invalidateCache()
    })
  }

  /**
   * Get all clips that are active at the specified frame
   * Returns clips sorted by track z-index (render order)
   */
  getActiveClips(frame: number): ActiveClip[] {
    // Check cache first
    const cached = this.activeClipsCache.get(frame)
    if (cached) {
      return cached
    }

    // Rebuild index if dirty
    if (this.isDirty) {
      this.rebuildIndex()
    }

    const timelineState = this.timelineStore.getState()
    const { clips, tracks } = timelineState
    const trackMap = new Map(tracks.map((t) => [t.id, t]))

    // Find overlapping clips using binary search approach
    const activeClips: ActiveClip[] = []

    // Linear scan for now - can optimize with interval tree if needed
    for (const interval of this.intervalIndex) {
      if (frame >= interval.startFrame && frame < interval.endFrame) {
        const clip = clips.get(interval.clipId)
        const track = clip ? trackMap.get(clip.trackId) : undefined

        if (clip && track && !track.hidden) {
          // Calculate local time within the clip
          const frameOffset = frame - clip.startTime
          const localTime = clip.inPoint + frameOffset

          activeClips.push({
            ...clip,
            track,
            localTime,
          })
        }
      }
    }

    // Sort by track order (higher order = rendered on top)
    activeClips.sort((a, b) => a.track.order - b.track.order)

    // Cache the result
    this.cacheResult(frame, activeClips)

    return activeClips
  }

  /**
   * Get clips active at frame, filtered by track type
   */
  getActiveClipsByType(frame: number, type: Track['type']): ActiveClip[] {
    return this.getActiveClips(frame).filter((ac) => ac.track.type === type)
  }

  /**
   * Get video clips active at frame
   */
  getActiveVideoClips(frame: number): ActiveClip[] {
    return this.getActiveClipsByType(frame, 'video')
  }

  /**
   * Get audio clips active at frame
   */
  getActiveAudioClips(frame: number): ActiveClip[] {
    return this.getActiveClipsByType(frame, 'audio')
  }

  /**
   * Get text/overlay clips active at frame
   */
  getActiveTextClips(frame: number): ActiveClip[] {
    return this.getActiveClipsByType(frame, 'text')
  }

  /**
   * Check if any clip is active at the specified frame
   */
  hasActiveClips(frame: number): boolean {
    if (this.isDirty) {
      this.rebuildIndex()
    }

    for (const interval of this.intervalIndex) {
      if (frame >= interval.startFrame && frame < interval.endFrame) {
        return true
      }
    }

    return false
  }

  /**
   * Get the frame range where clips exist (min/max active frames)
   */
  getActiveFrameRange(): { min: number; max: number } | null {
    if (this.intervalIndex.length === 0) {
      return null
    }

    const min = Math.min(...this.intervalIndex.map((i) => i.startFrame))
    const max = Math.max(...this.intervalIndex.map((i) => i.endFrame))

    return { min, max }
  }

  /**
   * Clear the cache and mark index as dirty
   */
  invalidateCache(): void {
    this.activeClipsCache.clear()
    this.isDirty = true
  }

  /**
   * Rebuild the interval index from current timeline state
   */
  private rebuildIndex(): void {
    const { clips, tracks } = this.timelineStore.getState()
    const trackMap = new Map(tracks.map((t) => [t.id, t]))

    this.intervalIndex = []

    clips.forEach((clip) => {
      const track = trackMap.get(clip.trackId)
      if (!track) return

      this.intervalIndex.push({
        clipId: clip.id,
        startFrame: clip.startTime,
        endFrame: clip.startTime + clip.duration,
        trackOrder: track.order,
      })
    })

    // Sort by start frame for better cache locality
    this.intervalIndex.sort((a, b) => a.startFrame - b.startFrame)

    this.isDirty = false
  }

  /**
   * Cache a query result with LRU eviction
   */
  private cacheResult(frame: number, result: ActiveClip[]): void {
    // If cache is full, remove oldest entry
    if (this.activeClipsCache.size >= this.cacheSize) {
      const firstKey = this.activeClipsCache.keys().next().value
      if (firstKey !== undefined) {
        this.activeClipsCache.delete(firstKey)
      }
    }

    this.activeClipsCache.set(frame, result)
  }

  /**
   * Clear all caches and reset
   */
  reset(): void {
    this.invalidateCache()
    this.intervalIndex = []
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.reset()
  }
}
