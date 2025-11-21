/**
 * Upload Hook
 * Provides upload functionality to components with UploadManager integration
 */

import { useEffect, useRef, useContext } from 'react'
import { UploadManager } from '../services/uploadManager'
import { importFromUrl } from '../services/uploadService'
import { MediaStoreContext } from '../contexts/StoreContext'
import { useMediaStore } from '../contexts/StoreContext'
import type { UploadItem } from '../types/stores'

export interface UseUploadReturn {
  /**
   * Add files to the upload queue
   */
  uploadFiles: (files: File[]) => Promise<void>

  /**
   * Cancel an in-progress upload
   */
  cancelUpload: (uploadId: string) => void

  /**
   * Retry a failed upload
   */
  retryUpload: (uploadId: string) => void

  /**
   * Remove an upload from the queue
   */
  removeUpload: (uploadId: string) => void

  /**
   * Clear all completed uploads from the queue
   */
  clearCompleted: () => void

  /**
   * Get current upload queue
   */
  uploads: UploadItem[]

  /**
   * Get upload speeds for active uploads
   */
  uploadSpeeds: Map<string, number>

  /**
   * Import media from a URL
   */
  importMediaFromUrl: (url: string, name: string, type: 'image' | 'video' | 'audio') => Promise<void>
}

/**
 * Hook to manage file uploads with concurrent upload support
 */
export function useUpload(): UseUploadReturn {
  const mediaStoreContext = useContext(MediaStoreContext)
  const uploadManagerRef = useRef<UploadManager | null>(null)

  // Subscribe to upload queue changes
  const uploads = useMediaStore((state) => state.uploadQueue)
  const clearCompletedUploads = useMediaStore((state) => state.clearCompletedUploads)
  const removeFromQueue = useMediaStore((state) => state.removeFromQueue)

  // Validate context exists
  if (!mediaStoreContext) {
    throw new Error('useUpload must be used within StoreProvider')
  }

  // Initialize UploadManager
  useEffect(() => {
    // mediaStoreContext is guaranteed to be non-null here
    const storeInstance = mediaStoreContext!

    if (!uploadManagerRef.current) {
      uploadManagerRef.current = new UploadManager(storeInstance, {
        maxConcurrent: 3,
        maxRetries: 3,
        retryDelay: 2000,
      })
    }

    // Cleanup on unmount
    return () => {
      if (uploadManagerRef.current) {
        uploadManagerRef.current.destroy()
        uploadManagerRef.current = null
      }
    }
  }, [mediaStoreContext])

  // Get upload speeds - use a getter to avoid accessing ref during render
  const getUploadSpeeds = () => uploadManagerRef.current?.getUploadSpeeds() ?? new Map()

  return {
    uploadFiles: async (files: File[]) => {
      if (!uploadManagerRef.current) {
        throw new Error('UploadManager not initialized')
      }
      await uploadManagerRef.current.addFiles(files)
    },

    cancelUpload: (uploadId: string) => {
      if (!uploadManagerRef.current) return
      uploadManagerRef.current.cancelUpload(uploadId)
    },

    retryUpload: (uploadId: string) => {
      if (!uploadManagerRef.current) return
      uploadManagerRef.current.retryUpload(uploadId)
    },

    removeUpload: (uploadId: string) => {
      removeFromQueue(uploadId)
    },

    clearCompleted: () => {
      clearCompletedUploads()
    },

    uploads,
    get uploadSpeeds() { return getUploadSpeeds() },

    importMediaFromUrl: async (url: string, name: string, type: 'image' | 'video' | 'audio') => {
      const state = mediaStoreContext!.getState()

      try {
        const result = await importFromUrl(url, name, type)

        state.addAsset({
          id: result.id,
          name: result.name,
          type: getAssetType(result.type),
          url: result.url,
          thumbnailUrl: result.thumbnail_url || undefined,
          size: result.size,
          createdAt: new Date(result.created_at),
          metadata: result.metadata,
        })
      } catch (error) {
        console.error('Failed to import media from URL:', error)
        throw error
      }
    },
  }
}

/**
 * Helper to determine asset type from MIME type or simple type string
 */
function getAssetType(fileType: string): 'image' | 'video' | 'audio' {
  const lowerType = fileType.toLowerCase()

  // Handle simple type strings from backend (e.g., "image", "video", "audio")
  if (lowerType === 'image' || lowerType.startsWith('image/')) return 'image'
  if (lowerType === 'video' || lowerType.startsWith('video/')) return 'video'
  if (lowerType === 'audio' || lowerType.startsWith('audio/')) return 'audio'

  // Fallback to image for unknown types
  console.warn(`Unknown file type: ${fileType}, defaulting to image`)
  return 'image'
}
