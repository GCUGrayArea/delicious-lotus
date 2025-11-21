/**
 * PreviewRenderer - Main preview rendering engine
 *
 * Integrates PlaybackEngine, ClipResolver, VideoElementPool, DOMCompositor,
 * and AudioEngine to provide real-time preview with quality settings
 */

import { PlaybackEngine } from './PlaybackEngine'
import { ClipResolver } from './ClipResolver'
import { VideoElementPool } from './VideoElementPool'
import { DOMCompositor } from './DOMCompositor'
import { AudioEngine } from './AudioEngine'
import { TransformEngine } from './TransformEngine'
import type { TimelineStoreInstance } from '../stores/timelineStore'
import type { EditorStoreInstance } from '../stores/editorStore'
import type { MediaStore, PreviewQuality } from '../types/stores'

export interface PreviewRendererOptions {
  containerElement: HTMLElement
  timelineStore: TimelineStoreInstance
  editorStore: EditorStoreInstance
  mediaStore: MediaStore
  quality?: PreviewQuality
}

export interface PerformanceMetrics {
  fps: number
  frameDrops: number
  renderTime: number // milliseconds
  lastFrameTime: number
}

export class PreviewRenderer {
  private container: HTMLElement
  private timelineStore: TimelineStoreInstance
  private editorStore: EditorStoreInstance
  private mediaStore: MediaStore

  private playbackEngine: PlaybackEngine
  private clipResolver: ClipResolver
  private videoPool: VideoElementPool
  private compositor: DOMCompositor
  private audioEngine: AudioEngine

  private quality: PreviewQuality = 'half'
  private isRendering: boolean = false
  private animationFrameId: number | null = null

  // Performance tracking
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameDrops: 0,
    renderTime: 0,
    lastFrameTime: 0,
  }
  private frameTimestamps: number[] = []
  private lastRenderTime: number = 0

  // Video container
  private videoContainer: HTMLDivElement | null = null

  // Track currently visible video to avoid unnecessary hide/show operations
  private currentVisibleVideoId: string | null = null

  constructor(options: PreviewRendererOptions) {
    this.container = options.containerElement
    this.timelineStore = options.timelineStore
    this.editorStore = options.editorStore
    this.mediaStore = options.mediaStore
    this.quality = options.quality ?? 'half'

    // Initialize components
    this.playbackEngine = new PlaybackEngine({
      timelineStore: this.timelineStore,
      editorStore: this.editorStore,
      onFrameUpdate: this.handleFrameUpdate.bind(this),
      onStateChange: this.handleStateChange.bind(this),
    })

    this.clipResolver = new ClipResolver(this.timelineStore)

    this.videoPool = new VideoElementPool({
      poolSize: 3,
      preloadCount: 2,
      muted: true, // Video audio handled by AudioEngine
    })

    this.compositor = new DOMCompositor({
      containerElement: this.container,
      maxLayers: 20,
    })

    this.audioEngine = new AudioEngine({
      volume: this.editorStore.getState().volume,
    })

    this.setupContainer()
    this.startRenderLoop()

    // Subscribe to playhead changes to update preview when scrubbing
    this.timelineStore.subscribe((state, prevState) => {
      // Only render if playhead changed and we're not currently playing
      if (state.playhead !== prevState.playhead && !this.editorStore.getState().isPlaying) {
        this.renderFrame(state.playhead)
      }
    })

    // Render initial frame
    const initialPlayhead = this.timelineStore.getState().playhead
    this.renderFrame(initialPlayhead)
  }

  /**
   * Setup the preview container
   */
  private setupContainer(): void {
    this.container.style.position = 'relative'
    this.container.style.overflow = 'hidden'
    this.container.style.backgroundColor = '#000'

    // Create video container
    this.videoContainer = document.createElement('div')
    this.videoContainer.style.position = 'absolute'
    this.videoContainer.style.top = '0'
    this.videoContainer.style.left = '0'
    this.videoContainer.style.width = '100%'
    this.videoContainer.style.height = '100%'
    this.videoContainer.style.zIndex = '1'

    this.container.appendChild(this.videoContainer)

    // Attach video elements to container
    const videoElements = this.videoPool.getAllVideoElements()
    videoElements.forEach((video) => {
      this.videoContainer!.appendChild(video)
      video.style.display = 'none' // Hide by default
    })
  }

  /**
   * Handle frame updates from playback engine
   */
  private async handleFrameUpdate(frame: number): Promise<void> {
    await this.renderFrame(frame)
  }

  /**
   * Handle playback state changes
   */
  private handleStateChange(state: string): void {
    if (state === 'playing') {
      this.audioEngine.resume()
    } else {
      this.audioEngine.suspend()
      this.audioEngine.stopAll()
    }
  }

  /**
   * Render a specific frame
   */
  private async renderFrame(frame: number): Promise<void> {
    const startTime = performance.now()

    try {
      // Get active clips at current frame
      const assets = this.mediaStore.assets

      // Track-based sets for order, then filter by asset type for overlays
      const activeVideoTrackClips = this.clipResolver.getActiveVideoClips(frame)
      const primaryVideoClip = activeVideoTrackClips[0]

      const activeClips = this.clipResolver.getActiveClips(frame)
      const activeImageClips = activeClips.filter(
        (clip) => assets.get(clip.assetId)?.type === 'image'
      )
      const activeTextClips = this.clipResolver.getActiveClipsByType(frame, 'text')
      const activeAudioClips = this.clipResolver.getActiveAudioClips(frame)

      const activeOverlayClips = [
        ...activeTextClips,
        ...activeImageClips,
        ...activeVideoTrackClips.slice(1), // Additional videos as overlays
      ]

      // Get container dimensions
      const { width, height } = this.getPreviewDimensions()

      // Render primary video (first video clip)
      await this.renderPrimaryVideo(primaryVideoClip, frame, width, height)

      // Render overlays (images, text, additional videos)
      this.compositor.renderOverlays(
        activeOverlayClips,
        this.mediaStore.assets,
        width,
        height
      )

      // Handle audio if playing
      const { isPlaying, playbackRate } = this.editorStore.getState()
      if (isPlaying && activeAudioClips.length > 0) {
        const currentTime = frame / this.timelineStore.getState().fps
        await this.audioEngine.playAudioClips(
          activeAudioClips,
          this.mediaStore.assets,
          currentTime,
          playbackRate
        )
      }

      // Update performance metrics
      const renderTime = performance.now() - startTime
      this.updateMetrics(renderTime)
    } catch (error) {
      console.error('Frame render error:', error)
    }
  }

  /**
   * Render the primary video clip
   */
  private async renderPrimaryVideo(
    videoClip: any,
    frame: number,
    width: number,
    height: number
  ): Promise<void> {
    // If no video clip, hide current video if any
    if (!videoClip) {
      if (this.currentVisibleVideoId !== null) {
        const videoElements = this.videoPool.getAllVideoElements()
        videoElements.forEach((video) => {
          video.style.display = 'none'
        })
        this.currentVisibleVideoId = null
      }
      return
    }

    const asset = this.mediaStore.assets.get(videoClip.assetId)
    if (!asset) {
      console.warn('Asset not found for clip:', videoClip.assetId)
      return
    }

    if (asset.type !== 'video') {
      console.warn('Asset is not a video:', asset.type)
      return
    }

    if (!asset.url) {
      console.error('Video asset missing URL:', asset)
      return
    }

    // Calculate video time
    const fps = this.timelineStore.getState().fps
    const videoTime = videoClip.localTime / fps

    // Get playback state
    const { isPlaying } = this.editorStore.getState()

    // Get video element (pass isPlaying to avoid unnecessary seeks during playback)
    const videoElement = await this.videoPool.getVideoElement(
      videoClip.assetId,
      asset,
      videoTime,
      isPlaying
    )

    // Only update visibility if the video changed
    if (this.currentVisibleVideoId !== videoClip.assetId) {
      // Hide all other videos
      const videoElements = this.videoPool.getAllVideoElements()
      videoElements.forEach((video) => {
        if (video !== videoElement) {
          video.style.display = 'none'
        }
      })

      // Show the current video
      videoElement.style.display = 'block'
      videoElement.style.zIndex = '1'
      this.currentVisibleVideoId = videoClip.assetId
    }

    // Apply transforms (these may change frame-to-frame for animations)
    TransformEngine.applyTransforms(videoElement, videoClip, width, height)

    // Sync playback
    const { playbackRate } = this.editorStore.getState()
    this.videoPool.syncToTimeline(videoElement, isPlaying, playbackRate)
  }

  /**
   * Get preview dimensions based on quality setting
   */
  private getPreviewDimensions(): { width: number; height: number } {
    const { resolution } = this.editorStore.getState().previewSettings

    // Use resolution from preview settings
    return resolution
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    if (this.isRendering) return

    this.isRendering = true
    this.renderLoop()
  }

  /**
   * Main render loop
   */
  private renderLoop = (): void => {
    if (!this.isRendering) return

    // Auto-optimization: reduce frame rate if performance is poor
    if (this.metrics.fps < 20 && this.quality !== 'draft') {
      this.setQuality('draft')
      console.warn('Preview quality reduced to draft due to performance')
    }

    this.animationFrameId = requestAnimationFrame(this.renderLoop)
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(renderTime: number): void {
    const now = performance.now()

    // Track frame timestamps for FPS calculation
    this.frameTimestamps.push(now)

    // Keep only last second of timestamps
    const oneSecondAgo = now - 1000
    this.frameTimestamps = this.frameTimestamps.filter((t) => t > oneSecondAgo)

    // Calculate FPS
    this.metrics.fps = this.frameTimestamps.length

    // Track render time
    this.metrics.renderTime = renderTime
    this.metrics.lastFrameTime = now

    // Detect frame drops (if render takes longer than frame budget)
    const targetFrameTime = 1000 / 60 // 60 FPS target
    if (renderTime > targetFrameTime) {
      this.metrics.frameDrops++
    }
  }

  /**
   * Set preview quality
   */
  setQuality(quality: PreviewQuality): void {
    this.quality = quality
    this.editorStore.getState().setPreviewQuality(quality)

    // Force re-render
    const frame = this.timelineStore.getState().playhead
    this.renderFrame(frame)
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Seek to specific frame
   */
  seek(frame: number): void {
    this.audioEngine.seek()
    this.playbackEngine.seek(frame)
  }

  /**
   * Update container size
   */
  updateSize(width: number, height: number): void {
    this.compositor.updateContainerSize(width, height)
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.isRendering = false

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.playbackEngine.dispose()
    this.clipResolver.dispose()
    this.videoPool.dispose()
    this.compositor.dispose()
    this.audioEngine.dispose()

    if (this.videoContainer) {
      this.videoContainer.remove()
      this.videoContainer = null
    }
  }
}
