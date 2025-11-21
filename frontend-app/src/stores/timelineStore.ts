import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import { temporal } from 'zundo'
import type { TimelineStore, Clip, Track } from '../types/stores'

// Helper to build a fresh initial state (prevents StrictMode double-init bugs)
const createInitialState = () => ({
  clips: new Map<string, Clip>(),
  tracks: [
    {
      id: `track-${Date.now()}`,
      type: 'video' as Track['type'],
      name: 'Track 1',
      height: 80,
      locked: false,
      hidden: false,
      muted: false,
      order: 0,
    },
  ] as Track[],
  playhead: 0,
  zoom: 1,
  selectedClipIds: [] as string[],
  duration: 0,
  fps: 30,
})

// Create the vanilla store with devtools, immer, and temporal middleware
export const createTimelineStore = () => {
  return createStore<TimelineStore>()(
    temporal(
      devtools(
        immer((set) => ({
        ...createInitialState(),

      // Clip operations
      addClip: (clip) =>
        set((state) => {
          state.clips.set(clip.id, clip)
          // Update duration if clip extends beyond current duration
          const clipEnd = clip.startTime + clip.duration
          if (clipEnd > state.duration) {
            state.duration = clipEnd
          }
        }),

      removeClip: (clipId) =>
        set((state) => {
          state.clips.delete(clipId)
          // Remove from selection if selected
          state.selectedClipIds = state.selectedClipIds.filter((id) => id !== clipId)
        }),

      updateClip: (clipId, updates) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            state.clips.set(clipId, { ...clip, ...updates })
            // Update duration if needed
            const updatedClip = state.clips.get(clipId)!
            const clipEnd = updatedClip.startTime + updatedClip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      moveClip: (clipId, trackId, startTime) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            state.clips.set(clipId, { ...clip, trackId, startTime })
            // Update duration if needed
            const clipEnd = startTime + clip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      duplicateClip: (clipId) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (clip) {
            // Place duplicate immediately after the original clip
            const newStartTime = clip.startTime + clip.duration

            const newClip: Clip = {
              ...clip,
              id: `${clip.id}-copy-${Date.now()}`,
              startTime: newStartTime,
            }

            // Check for overlapping clips on the same track
            const overlappingClips: { id: string; startTime: number; duration: number }[] = []
            state.clips.forEach((otherClip) => {
              if (otherClip.trackId === clip.trackId && otherClip.id !== clipId) {
                const otherClipEnd = otherClip.startTime + otherClip.duration
                const newClipEnd = newStartTime + newClip.duration

                // Check if clips overlap
                if (
                  (otherClip.startTime >= newStartTime && otherClip.startTime < newClipEnd) ||
                  (otherClipEnd > newStartTime && otherClipEnd <= newClipEnd) ||
                  (otherClip.startTime <= newStartTime && otherClipEnd >= newClipEnd)
                ) {
                  overlappingClips.push({
                    id: otherClip.id,
                    startTime: otherClip.startTime,
                    duration: otherClip.duration
                  })
                }
              }
            })

            // Move overlapping clips to the right
            overlappingClips.forEach(({ id }) => {
              const overlappingClip = state.clips.get(id)
              if (overlappingClip) {
                const newClipEnd = newStartTime + newClip.duration
                state.clips.set(id, {
                  ...overlappingClip,
                  startTime: newClipEnd
                })
              }
            })

            state.clips.set(newClip.id, newClip)
            const clipEnd = newClip.startTime + newClip.duration
            if (clipEnd > state.duration) {
              state.duration = clipEnd
            }
          }
        }),

      splitClip: (clipId, frame) =>
        set((state) => {
          const clip = state.clips.get(clipId)
          if (!clip || frame <= clip.startTime || frame >= clip.startTime + clip.duration) {
            return // Invalid split point
          }

          const splitPoint = frame - clip.startTime
          const firstClipDuration = splitPoint
          const secondClipDuration = clip.duration - splitPoint

          // Create first clip (before split)
          const firstClip: Clip = {
            ...clip,
            duration: firstClipDuration,
            outPoint: clip.inPoint + firstClipDuration,
          }

          // Create second clip (after split)
          const secondClip: Clip = {
            ...clip,
            id: `${clip.id}-split-${Date.now()}`,
            startTime: frame,
            duration: secondClipDuration,
            inPoint: clip.inPoint + firstClipDuration,
          }

          // Update clips map
          state.clips.set(clip.id, firstClip)
          state.clips.set(secondClip.id, secondClip)
        }),

      // Track operations
      addTrack: (track) =>
        set((state) => {
          const newTrack: Track = {
            ...track,
            id: `track-${Date.now()}`,
            order: state.tracks.length,
          }
          state.tracks.push(newTrack)
        }),

      removeTrack: (trackId) =>
        set((state) => {
          // Remove all clips on this track
          const clipsToRemove: string[] = []
          state.clips.forEach((clip) => {
            if (clip.trackId === trackId) {
              clipsToRemove.push(clip.id)
            }
          })
          clipsToRemove.forEach((clipId) => state.clips.delete(clipId))

          // Remove track
          state.tracks = state.tracks.filter((track) => track.id !== trackId)

          // Reorder remaining tracks
          state.tracks.forEach((track, index) => {
            track.order = index
          })
        }),

      updateTrack: (trackId, updates) =>
        set((state) => {
          const trackIndex = state.tracks.findIndex((t) => t.id === trackId)
          if (trackIndex !== -1) {
            state.tracks[trackIndex] = { ...state.tracks[trackIndex], ...updates }
          }
        }),

      reorderTracks: (trackIds) =>
        set((state) => {
          const trackMap = new Map(state.tracks.map((track) => [track.id, track]))
          state.tracks = trackIds
            .map((id) => trackMap.get(id))
            .filter((track): track is Track => track !== undefined)
            .map((track, index) => ({ ...track, order: index }))
        }),

      // Playhead and view
      setPlayhead: (frame) =>
        set((state) => {
          state.playhead = Math.max(0, Math.min(frame, state.duration))
        }),

      setZoom: (zoom) =>
        set((state) => {
          state.zoom = Math.max(0.25, Math.min(8, zoom))
        }),

      // Selection
      selectClip: (clipId, addToSelection = false) =>
        set((state) => {
          if (addToSelection) {
            if (!state.selectedClipIds.includes(clipId)) {
              state.selectedClipIds.push(clipId)
            }
          } else {
            state.selectedClipIds = [clipId]
          }
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedClipIds = []
        }),

      // Utility
      reset: () => set(createInitialState()),
        })),
        { name: 'TimelineStore' }
      ),
      {
        limit: 50, // Keep last 50 history states
        equality: (a, b) => a === b,
        // Exclude playhead and zoom from undo/redo history
        partialize: (state) => {
          const { playhead: _playhead, zoom: _zoom, selectedClipIds: _selectedClipIds, ...rest } = state
          return rest as Omit<typeof state, 'playhead' | 'zoom' | 'selectedClipIds'>
        },
      }
    )
  )
}

// Export type for the store instance
export type TimelineStoreInstance = ReturnType<typeof createTimelineStore>
