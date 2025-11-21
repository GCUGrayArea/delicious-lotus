/**
 * AI Generation Service
 * Handles API calls to Replicate for image and video generation
 */

import type { QualityTier } from '../types/stores'

// API base URL - should be configured from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface GenerateImageRequest {
  prompt: string
  qualityTier: QualityTier
  aspectRatio: string
}

export interface GenerateVideoRequest {
  prompt: string
  size?: string
  duration?: number
}

export interface GenerationResponse {
  job_id: string
  status: string
  message?: string
}

/**
 * Generate an image using Replicate's Nano-Banana model
 * @param request - Image generation request parameters
 * @returns Response containing job ID for tracking
 */
export async function generateImage(request: GenerateImageRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/nano-banana`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      quality_tier: request.qualityTier,
      aspect_ratio: request.aspectRatio,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Generate a video using Replicate's Wan Video 2.5 T2V model (text-to-video)
 * @param request - Video generation request parameters
 * @returns Response containing job ID for tracking
 */


// ============================================================================
// Video Generation Interfaces & Functions
// ============================================================================

export interface GenerateWanVideoI2VRequest {
  prompt: string
  image: string
  last_image?: string
  resolution?: '480p' | '720p'
}

export interface GenerateWanVideoT2VRequest {
  prompt: string
  size?: string
  duration?: number
}

export interface GenerateSeedanceVideoRequest {
  prompt: string
  image?: string
  duration?: number
  resolution?: string
  aspect_ratio?: string
  fps?: number
  camera_fixed?: boolean
  seed?: number
}

export interface GenerateHailuoVideoRequest {
  prompt: string
  first_frame_image: string
  duration?: number
  resolution?: string
  prompt_optimizer?: boolean
}

export interface GenerateKlingVideoRequest {
  prompt: string
  start_image?: string
  duration?: number
  aspect_ratio?: string
  negative_prompt?: string
}

export interface GenerateVeoVideoRequest {
  prompt: string
  image?: string
  last_frame?: string
  duration?: number
  aspect_ratio?: string
  resolution?: string
  generate_audio?: boolean
  negative_prompt?: string
  seed?: number
}

/**
 * Generate a video using Replicate's Wan Video 2.5 T2V model (text-to-video)
 * @param request - Video generation request parameters
 * @returns Response containing job ID for tracking
 */
export async function generateWanVideoT2V(request: GenerateWanVideoT2VRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/wan-video-t2v`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      size: request.size || '1280*720',
      duration: request.duration || 5,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Alias for backward compatibility if needed, or just replace usages
export const generateVideo = generateWanVideoT2V

export async function generateWanVideoI2V(request: GenerateWanVideoI2VRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/wan-video-i2v`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateSeedanceVideo(request: GenerateSeedanceVideoRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/seedance-1-pro-fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateHailuoVideo(request: GenerateHailuoVideoRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/hailuo-2.3-fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateKlingVideo(request: GenerateKlingVideoRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/kling-v2.5-turbo-pro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateVeoVideo(request: GenerateVeoVideoRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/veo-3.1-fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

// ============================================================================
// Audio Generation Interfaces & Functions
// ============================================================================

export interface GenerateLyriaAudioRequest {
  prompt: string
  negative_prompt?: string
  seed?: number
}

export interface GenerateMusic01Request {
  lyrics?: string
  voice_id?: string
  voice_file?: string
  song_file?: string
  instrumental_id?: string
  instrumental_file?: string
  sample_rate?: number
  bitrate?: number
}

export interface GenerateMusic15Request {
  prompt: string
  lyrics: string
  bitrate?: number
  sample_rate?: number
  audio_format?: string
}

export interface GenerateStableAudioRequest {
  prompt: string
  duration?: number
  steps?: number
  cfg_scale?: number
  seed?: number
}

export async function generateLyriaAudio(request: GenerateLyriaAudioRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/lyria-2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateMusic01Audio(request: GenerateMusic01Request): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/music-01`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateMusic15Audio(request: GenerateMusic15Request): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/music-1.5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

export async function generateStableAudio(request: GenerateStableAudioRequest): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/stable-audio-2.5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error((await response.json()).message || response.statusText)
  return response.json()
}

/**
 * Cancel a generation job
 * @param jobId - Job ID to cancel
 */
export async function cancelGeneration(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `Failed to cancel generation: ${response.status}`)
  }
}

/**
 * Get generation job status (backup for WebSocket)
 * @param jobId - Job ID to check status for
 * @returns Job status information
 */
export async function getGenerationStatus(jobId: string): Promise<{
  status: string
  progress?: number
  result_url?: string
  error?: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replicate/jobs/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `Failed to get job status: ${response.status}`)
  }

  return response.json()
}
