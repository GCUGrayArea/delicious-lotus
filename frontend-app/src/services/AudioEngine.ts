/**
 * AudioEngine - Web Audio API synchronization for timeline playback
 *
 * Manages audio playback using Web Audio API with precise scheduling
 * and synchronization with video playback timing
 */

import type { MediaAsset } from '../types/stores'
import type { ActiveClip } from './ClipResolver'

export interface AudioEngineOptions {
  sampleRate?: number
  volume?: number
}

interface AudioSourceState {
  source: AudioBufferSourceNode | null
  gainNode: GainNode
  assetId: string
  clipId: string
  startTime: number // When the source was started in AudioContext time
  offset: number // Offset into the audio buffer
}

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private activeSources: Map<string, AudioSourceState> = new Map()
  private isInitialized: boolean = false
  private volume: number = 1

  constructor(options: AudioEngineOptions = {}) {
    this.volume = options.volume ?? 1
  }

  /**
   * Initialize Web Audio API context
   * Must be called after user interaction due to autoplay policies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()

      // Create master gain node for volume control
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.audioContext.destination)

      // Resume context if suspended (for autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      throw error
    }
  }

  /**
   * Load audio buffer from asset
   */
  async loadAudioBuffer(assetId: string, asset: MediaAsset): Promise<AudioBuffer> {
    if (!this.audioContext) {
      await this.initialize()
    }

    // Check cache
    const cached = this.audioBuffers.get(assetId)
    if (cached) {
      return cached
    }

    try {
      // Fetch audio data
      const response = await fetch(asset.url)
      const arrayBuffer = await response.arrayBuffer()

      // Decode audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer)

      // Cache the buffer
      this.audioBuffers.set(assetId, audioBuffer)

      return audioBuffer
    } catch (error) {
      console.error(`Failed to load audio for asset ${assetId}:`, error)
      throw error
    }
  }

  /**
   * Play audio clips synchronized with timeline
   */
  async playAudioClips(
    audioClips: ActiveClip[],
    assets: Map<string, MediaAsset>,
    currentTime: number,
    playbackRate: number = 1
  ): Promise<void> {
    if (!this.audioContext || !this.isInitialized) {
      await this.initialize()
    }

    // Stop sources that are no longer active
    const activeClipIds = new Set(audioClips.map((clip) => clip.id))
    this.activeSources.forEach((sourceState, clipId) => {
      if (!activeClipIds.has(clipId)) {
        this.stopAudioSource(clipId)
      }
    })

    // Start/update active audio clips
    for (const clip of audioClips) {
      const asset = assets.get(clip.assetId)
      if (!asset || asset.type !== 'audio') continue

      // Check if this clip is already playing
      const existingSource = this.activeSources.get(clip.id)
      if (existingSource) {
        // Audio is already playing for this clip
        continue
      }

      try {
        // Load audio buffer
        const audioBuffer = await this.loadAudioBuffer(clip.assetId, asset)

        // Calculate offset into the audio (considering clip trim)
        const clipLocalTime = clip.localTime / 30 // Convert frames to seconds (assuming 30fps)
        const offset = Math.max(0, clipLocalTime)

        // Create and start audio source
        await this.startAudioSource(clip.id, clip.assetId, audioBuffer, offset, playbackRate)
      } catch (error) {
        console.warn(`Failed to play audio for clip ${clip.id}:`, error)
      }
    }
  }

  /**
   * Start an audio source with precise timing
   */
  private async startAudioSource(
    clipId: string,
    assetId: string,
    audioBuffer: AudioBuffer,
    offset: number,
    playbackRate: number
  ): Promise<void> {
    if (!this.audioContext || !this.masterGain) return

    // Create buffer source
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.playbackRate.value = playbackRate

    // Create gain node for this clip
    const gainNode = this.audioContext.createGain()
    gainNode.gain.value = 1 // Can be controlled per-clip later

    // Connect: source -> gainNode -> masterGain -> destination
    source.connect(gainNode)
    gainNode.connect(this.masterGain)

    // Start playback
    const startTime = this.audioContext.currentTime
    source.start(startTime, offset)

    // Store source state
    this.activeSources.set(clipId, {
      source,
      gainNode,
      assetId,
      clipId,
      startTime,
      offset,
    })

    // Clean up when source ends
    source.onended = () => {
      this.activeSources.delete(clipId)
    }
  }

  /**
   * Stop a specific audio source
   */
  private stopAudioSource(clipId: string): void {
    const sourceState = this.activeSources.get(clipId)
    if (!sourceState || !sourceState.source) return

    try {
      sourceState.source.stop()
    } catch {
      // Ignore errors if source already stopped
    }

    this.activeSources.delete(clipId)
  }

  /**
   * Stop all audio playback
   */
  stopAll(): void {
    this.activeSources.forEach((sourceState) => {
      if (sourceState.source) {
        try {
          sourceState.source.stop()
        } catch {
          // Ignore errors
        }
      }
    })

    this.activeSources.clear()
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))

    if (this.masterGain) {
      this.masterGain.gain.value = this.volume
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume
  }

  /**
   * Set playback rate for all active sources
   */
  setPlaybackRate(rate: number): void {
    this.activeSources.forEach((sourceState) => {
      if (sourceState.source) {
        sourceState.source.playbackRate.value = rate
      }
    })
  }

  /**
   * Seek - stop all and prepare to restart at new position
   */
  seek(): void {
    this.stopAll()
  }

  /**
   * Resume audio context (for autoplay policy)
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  /**
   * Suspend audio context (pause)
   */
  async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend()
    }
  }

  /**
   * Check if audio context is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null
  }

  /**
   * Get audio context current time
   */
  getCurrentTime(): number {
    return this.audioContext?.currentTime ?? 0
  }

  /**
   * Clear cached audio buffers
   */
  clearCache(): void {
    this.audioBuffers.clear()
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAll()

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.masterGain = null
    this.audioBuffers.clear()
    this.isInitialized = false
  }
}
