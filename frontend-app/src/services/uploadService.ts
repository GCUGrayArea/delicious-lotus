/**
 * Upload Service
 * Handles media file uploads to S3 via presigned URLs
 */

import { extractMediaMetadata } from './mediaMetadataExtractor'

// API base URL - should be configured from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
console.log('[UploadService] Initialized with API_BASE_URL:', API_BASE_URL)

export interface PresignedUrlRequest {
  name: string
  size: number
  type: 'image' | 'video' | 'audio'
  checksum: string
}

export interface PresignedUrlResponse {
  id: string // Asset ID from backend
  presigned_url: string
  upload_params: {
    method: string
    headers: Record<string, string>
    fields: Record<string, string>
  }
  expires_in: number
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  bytesPerSecond?: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

export class UploadError extends Error {
  statusCode?: number
  retryable: boolean

  constructor(
    message: string,
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message)
    this.statusCode = statusCode
    this.retryable = retryable
    this.name = 'UploadError'
  }
}

/**
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (error instanceof UploadError && !error.retryable) {
        throw error
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Requests a presigned URL from the backend
 */
export async function requestPresignedUrl(
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  console.log('[UploadService] Requesting presigned URL:', {
    url: `${API_BASE_URL}/api/v1/media/upload`,
    request: request,
    checksumLength: request.checksum.length,
  })

  const response = await retryWithBackoff(async () => {
    const res = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500
      let errorDetail = res.statusText
      try {
        const errorBody = await res.text()
        console.error('[UploadService] Upload error response:', {
          status: res.status,
          statusText: res.statusText,
          body: errorBody,
        })
        errorDetail = errorBody || res.statusText
      } catch (e) {
        console.error('[UploadService] Could not parse error response')
      }
      throw new UploadError(
        `Failed to get presigned URL: ${errorDetail}`,
        res.status,
        retryable
      )
    }

    return res
  }, 3, 2000)

  return response.json()
}

/**
 * Calculate MD5 checksum of a file
 */
async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  console.log('[UploadService] Calculated checksum:', {
    fileName: file.name,
    fileSize: file.size,
    checksum: hashHex,
    checksumLength: hashHex.length,
  })
  return hashHex
}

/**
 * Determine media type from file MIME type
 */
function getMediaType(mimeType: string): 'image' | 'video' | 'audio' {
  console.log('[UploadService] Detecting media type for MIME:', mimeType)
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  throw new UploadError('Unsupported file type', undefined, false)
}

/**
 * Uploads a file directly to S3 using a presigned URL
 */
export async function uploadToS3(
  file: File,
  presignedUrl: string,
  uploadParams: {
    method: string
    headers: Record<string, string>
    fields: Record<string, string>
  },
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track progress
    let startTime = Date.now()
    let lastLoaded = 0

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const now = Date.now()
        const elapsed = (now - startTime) / 1000 // seconds
        const loaded = e.loaded - lastLoaded

        const bytesPerSecond = elapsed > 0 ? loaded / elapsed : 0

        onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
          bytesPerSecond,
        })

        lastLoaded = e.loaded
        startTime = now
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // For POST uploads, ETag might not be in headers
        const etag = xhr.getResponseHeader('ETag') || ''
        console.log('[UploadService] S3 upload successful, ETag:', etag)
        resolve({ etag: etag.replace(/"/g, '') })
      } else {
        console.error('[UploadService] S3 upload failed:', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          responseHeaders: xhr.getAllResponseHeaders(),
        })
        reject(
          new UploadError(
            `S3 upload failed with status ${xhr.status}: ${xhr.responseText || xhr.statusText}`,
            xhr.status,
            xhr.status >= 500
          )
        )
      }
    })

    xhr.addEventListener('error', () => {
      reject(new UploadError('Network error during upload', undefined, true))
    })

    xhr.addEventListener('timeout', () => {
      reject(new UploadError('Upload timeout', undefined, true))
    })

    xhr.addEventListener('abort', () => {
      reject(new UploadError('Upload aborted', undefined, false))
    })

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
      })
    }

    // Start upload - use POST method with FormData for presigned POST uploads
    console.log('[UploadService] Starting S3 upload:', {
      url: presignedUrl,
      method: uploadParams.method,
      fields: uploadParams.fields,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    xhr.open(uploadParams.method, presignedUrl)
    xhr.timeout = 10 * 60 * 1000 // 10 minutes timeout

    // Build FormData with all required fields
    const formData = new FormData()

    // Add all fields from the presigned URL params IN ORDER
    // These fields are signed by AWS and must be sent exactly as provided
    Object.entries(uploadParams.fields).forEach(([key, value]) => {
      console.log(`[UploadService] Adding form field: ${key} = ${value}`)
      formData.append(key, value)
    })

    // File must be the LAST field in the form
    // IMPORTANT: The field name must be 'file' (not the actual filename)
    formData.append('file', file)
    console.log('[UploadService] Added file field (last):')

    xhr.send(formData)
  })
}

/**
 * Confirms upload completion with the backend
 */
export async function confirmUpload(
  assetId: string,
  metadata: {
    duration?: number
    width?: number
    height?: number
    frame_rate?: number
    codec?: string
    bitrate?: number
    sample_rate?: number
    channels?: number
  } = {}
): Promise<{
  id: string
  name: string
  file_size: number
  file_type: string
  status: string
  url: string
  thumbnail_url?: string
  metadata: Record<string, any>
}> {
  const response = await fetch(`${API_BASE_URL}/api/v1/media/${assetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata,
      status: 'ready',
    }),
  })

  if (!response.ok) {
    throw new UploadError(
      `Failed to confirm upload: ${response.statusText}`,
      response.status,
      false
    )
  }

  return response.json()
}

/**
 * Get media asset details by ID
 */
export async function getMediaAsset(
  assetId: string
): Promise<{
  id: string
  name: string
  type: string
  url: string
  thumbnail_url?: string
  file_size: number
  created_at: string
  metadata: Record<string, any>
}> {
  const response = await fetch(`/api/v1/media/${assetId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new UploadError(
      `Failed to fetch media asset: ${response.statusText}`,
      response.status,
      false
    )
  }

  return response.json()
}

/**
 * Complete upload flow: request presigned URL, upload to S3, confirm with backend
 */
export async function uploadFile(
  file: File,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<{
  id: string
  name: string
  file_size: number
  file_type: string
  status: string
  url: string
  thumbnail_url?: string
}> {
  // Step 1: Calculate checksum
  const checksum = await calculateChecksum(file)

  // Step 2: Request presigned URL
  const presignedData = await requestPresignedUrl({
    name: file.name,
    size: file.size,
    type: getMediaType(file.type),
    checksum,
  })

  // Step 3: Upload to S3
  await uploadToS3(
    file,
    presignedData.presigned_url,
    presignedData.upload_params,
    onProgress,
    signal
  )

  // Step 4: Extract metadata from file (client-side)
  const extractedMetadata = await extractMediaMetadata(file)

  // Step 5: Confirm upload with backend and get full asset details
  const result = await confirmUpload(presignedData.id, extractedMetadata)

  return result
}

/**
 * Import media from external URL (e.g., Replicate CDN)
 * Downloads from URL, uploads to S3, and creates media asset record
 */
export async function importFromUrl(
  url: string,
  name: string,
  type: 'image' | 'video' | 'audio',
  metadata: Record<string, any> = {}
): Promise<{
  id: string
  name: string
  type: string
  url: string
  thumbnail_url: string | null
  size: number
  created_at: string
  metadata: Record<string, any>
}> {
  console.log(`[UploadService] Importing from URL: ${url}`)
  console.log(`[UploadService] Asset name: ${name}, type: ${type}`)
  console.log(`[UploadService] Calling: ${API_BASE_URL}/api/v1/media/import-from-url`)

  const response = await fetch(`${API_BASE_URL}/api/v1/media/import-from-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      name,
      type,
      metadata,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const errorMessage = error.detail || `Failed to import from URL: ${response.statusText}`
    console.error(`[UploadService] Import failed: ${errorMessage}`, {
      status: response.status,
      url,
      error
    })
    throw new UploadError(
      errorMessage,
      response.status,
      response.status >= 500
    )
  }

  const result = await response.json()
  console.log(`[UploadService] Successfully imported asset:`, result)
  return result
}
