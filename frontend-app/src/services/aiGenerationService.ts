/**
 * AI Generation Service
 * Handles API calls to Replicate for image, video, and audio generation
 */

import type { GenerationType, QualityTier } from '../types/stores'

// API base URL - should be configured from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface GenerateImageRequest {
  prompt: string
  qualityTier: QualityTier
  aspectRatio: string
  model?: string
  // Advanced params
  image_input?: string
  output_format?: string
  output_quality?: number
  seed?: number
  disable_safety_checker?: boolean
}

export interface GenerateVideoRequest {
  prompt: string
  size?: string // Deprecated but kept for compatibility
  duration?: number
  model?: string
  aspectRatio?: string
  resolution?: string
  // Advanced params
  image?: string
  last_image?: string
  last_frame?: string
  start_image?: string
  first_frame_image?: string
  negative_prompt?: string
  seed?: number
  fps?: number
  camera_fixed?: boolean
  prompt_optimizer?: boolean
  audio?: string
  enable_prompt_expansion?: boolean
}

export interface GenerateAudioRequest {
  prompt: string
  duration?: number
  model?: string
  // Advanced params
  negative_prompt?: string
  seed?: number
  lyrics?: string
  voice_file?: string
  song_file?: string
  instrumental_file?: string
}

export interface GenerationResponse {
  job_id: string
  generation_id?: string
  status: string
  message?: string
  websocket_url?: string
}

/**
 * Generate an image using Replicate models
 * @param request - Image generation request parameters
 * @returns Response containing job ID for tracking
 */
export async function generateImage(request: GenerateImageRequest): Promise<GenerationResponse> {
  let endpoint = '/api/v1/replicate/nano-banana'
  let body: Record<string, any> = {
    prompt: request.prompt,
    quality_tier: request.qualityTier,
    aspect_ratio: request.aspectRatio,
    image_input: request.image_input ? [request.image_input] : undefined,
  }

  if (request.model === 'flux-schnell') {
    endpoint = '/api/v1/replicate/flux-schnell'
    body = {
      prompt: request.prompt,
      aspect_ratio: request.aspectRatio,
      output_format: request.output_format || 'webp',
      output_quality: request.output_quality || 80,
      disable_safety_checker: request.disable_safety_checker,
      seed: request.seed,
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Generate a video using Replicate models
 * @param request - Video generation request parameters
 * @returns Response containing generation ID (mapped to job_id) for tracking
 */
export async function generateVideo(request: GenerateVideoRequest): Promise<GenerationResponse> {
  let endpoint = '/api/v1/replicate/wan-video-t2v'
  let body: Record<string, any> = {
    prompt: request.prompt,
    size: request.size || '1280*720',
    duration: request.duration || 5,
  }

  // Handle different video models
  switch (request.model) {
    case 'veo-3.1':
      endpoint = '/api/v1/replicate/veo-3.1-fast'
      body = {
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio || '16:9',
        duration: request.duration || 8,
        resolution: request.resolution || '1080p',
        image: request.image,
        last_frame: request.last_frame,
        negative_prompt: request.negative_prompt,
        seed: request.seed,
      }
      break
    case 'kling-v2.5':
      endpoint = '/api/v1/replicate/kling-v2.5-turbo-pro'
      body = {
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio || '16:9',
        duration: request.duration || 5,
        start_image: request.start_image || request.image, // Normalize image input
        negative_prompt: request.negative_prompt,
      }
      break
    case 'hailuo-2.3':
      endpoint = '/api/v1/replicate/hailuo-2.3-fast'
      body = {
        prompt: request.prompt,
        first_frame_image: request.first_frame_image || request.image, // Normalize image input
        duration: request.duration || 6,
        resolution: request.resolution || '768p',
        prompt_optimizer: request.prompt_optimizer !== false, // Default true
      }
      break
    case 'seedance':
      endpoint = '/api/v1/replicate/seedance-1-pro-fast'
      body = {
        prompt: request.prompt,
        duration: request.duration || 5,
        resolution: request.resolution || '1080p',
        aspect_ratio: request.aspectRatio || '16:9',
        image: request.image,
        fps: request.fps || 24,
        camera_fixed: request.camera_fixed,
        seed: request.seed,
      }
      break
    case 'wan-video-i2v':
      endpoint = '/api/v1/replicate/wan-video-i2v'
      body = {
        prompt: request.prompt,
        image: request.image,
        audio: request.audio,
        duration: request.duration || 5,
        resolution: request.resolution || '720p',
        negative_prompt: request.negative_prompt,
        enable_prompt_expansion: request.enable_prompt_expansion !== false, // Default true
      }
      break
    case 'wan-video-t2v':
    default:
      // Default is Wan Video T2V
      endpoint = '/api/v1/replicate/wan-video-t2v'
      body = {
        prompt: request.prompt,
        size: request.size || '1280*720',
        duration: request.duration || 5,
      }
      break
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Generate audio using Replicate models
 * @param request - Audio generation request parameters
 * @returns Response containing job ID for tracking
 */
export async function generateAudio(request: GenerateAudioRequest): Promise<GenerationResponse> {
  let endpoint = '/api/v1/replicate/stable-audio-2.5'
  let body: Record<string, any> = {
    prompt: request.prompt,
    duration: request.duration || 45,
  }

  switch (request.model) {
    case 'music-01':
      endpoint = '/api/v1/replicate/music-01'
      body = {
        lyrics: request.prompt, // Music-01 uses lyrics/prompt field
        voice_file: request.voice_file,
        song_file: request.song_file,
        instrumental_file: request.instrumental_file,
      }
      break
    case 'lyria-2':
      endpoint = '/api/v1/replicate/lyria-2'
      body = {
        prompt: request.prompt,
        negative_prompt: request.negative_prompt,
        seed: request.seed,
      }
      break
    case 'stable-audio':
    default:
      endpoint = '/api/v1/replicate/stable-audio-2.5'
      body = {
        prompt: request.prompt,
        duration: request.duration || 45,
        seed: request.seed,
      }
      break
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  
  return {
    job_id: data.generation_id, // Map generation_id to job_id for frontend compatibility
    generation_id: data.generation_id,
    status: data.status,
    message: "Generation started",
    websocket_url: data.websocket_url
  }
}

/**
 * Cancel a generation job
 * @param jobId - Job ID to cancel
 */
export async function cancelGeneration(jobId: string): Promise<void> {
  // Try to cancel using new endpoint structure if it looks like a generation ID
  // (Generation IDs are usually 'gen_...')
  const isGenerationId = jobId.startsWith('gen_')
  const endpoint = isGenerationId 
    ? `${API_BASE_URL}/api/v1/generations/${jobId}/cancel`
    : `${API_BASE_URL}/api/v1/jobs/${jobId}/cancel`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    // Try fallback if first attempt failed (maybe it was the other type)
    if (response.status === 404 && isGenerationId) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        if (fallbackResponse.ok) return
    }
    
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
  // Check if it's a generation ID (gen_...)
  if (jobId.startsWith('gen_')) {
    const response = await fetch(`${API_BASE_URL}/api/v1/generations/${jobId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `Failed to get generation status: ${response.status}`)
    }

    const data = await response.json()
    
    // Map Advanced Pipeline response to simple status format
    let result_url = undefined
    if (data.status === 'completed' && data.metadata?.video_results) {
        // Use first completed video url
        const completed = data.metadata.video_results.find((r: any) => r.status === 'completed')
        if (completed) result_url = completed.video_url
    }

    return {
      status: data.status,
      progress: data.progress?.percentage || 0,
      result_url,
      error: data.status === 'failed' ? 'Generation failed' : undefined
    }
  } else {
    // Legacy job ID
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
}
