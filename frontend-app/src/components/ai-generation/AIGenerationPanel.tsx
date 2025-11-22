import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import PromptInput from './PromptInput'
import GenerationQueue from './GenerationQueue'
import GenerationHistory from './GenerationHistory'
import { useAIGenerationStore, useMediaStore, useWebSocketStore } from '../../contexts/StoreContext'
import { generateImage, generateVideo, cancelGeneration as cancelGenerationAPI } from '../../services/aiGenerationService'
import type { GenerationType, QualityTier } from '../../types/stores'

export default function AIGenerationPanel() {
  const [activeTab, setActiveTab] = useState('generate')
  const [isPending, setIsPending] = useState(false)

  // Get state and actions from stores - get the Map directly without transformation
  const activeGenerationsMap = useAIGenerationStore((state) => state.activeGenerations)
  const generationHistory = useAIGenerationStore((state) => state.generationHistory)
  const maxConcurrent = useAIGenerationStore((state) => state.maxConcurrentGenerations)

  // Get store actions
  const queueGeneration = useAIGenerationStore((state) => state.queueGeneration)
  const updateGenerationStatus = useAIGenerationStore((state) => state.updateGenerationStatus)
  const cancelGeneration = useAIGenerationStore((state) => state.cancelGeneration)
  const removeGeneration = useAIGenerationStore((state) => state.removeGeneration)
  const moveToCompleting = useAIGenerationStore((state) => state.moveToCompleting)
  const clearCompletingGeneration = useAIGenerationStore((state) => state.clearCompletingGeneration)
  const addToHistory = useAIGenerationStore((state) => state.addToHistory)
  const toggleFavorite = useAIGenerationStore((state) => state.toggleFavorite)
  const removeFromHistory = useAIGenerationStore((state) => state.removeFromHistory)

  // Get media store action for refreshing assets
  const loadAssets = useMediaStore((state) => state.loadAssets)

  // Memoize the sorted array to prevent infinite loops
  const activeGenerations = useMemo(
    () =>
      Array.from(activeGenerationsMap.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
    [activeGenerationsMap]
  )

  // Check if we can queue more generations
  const activeCount = activeGenerations.filter(
    (g) => g.status === 'generating' || g.status === 'queued'
  ).length
  const canGenerate = activeCount < maxConcurrent

  // Handle generation request
  const handleGenerate = useCallback(
    async (params: {
      prompt: string
      type: GenerationType
      qualityTier: QualityTier
      aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
    }) => {
      // Disable button while API call is in progress
      setIsPending(true)

      try {
        // Queue the generation in the store
        const generationId = queueGeneration({
          type: params.type,
          prompt: params.prompt,
          qualityTier: params.qualityTier,
          aspectRatio: params.aspectRatio,
        })

        // Call the appropriate API based on type
        let response
        if (params.type === 'image') {
          response = await generateImage({
            prompt: params.prompt,
            qualityTier: params.qualityTier,
            aspectRatio: params.aspectRatio,
            model: params.model,
            image_input: params.imageInput,
            ...params.advancedParams,
          })
        } else if (params.type === 'video') {
          // Video generation
          // Map aspect ratios to valid T2V sizes (wan-video/wan-2.5-t2v supported sizes)
          // Valid sizes: "832*480", "480*832", "1280*720", "720*1280", "1920*1080", "1080*1920"
          let size = '1280*720' // default 16:9 HD
          let resolution = params.resolution || '1080p'

          switch (params.aspectRatio) {
            case '16:9':
              size = '1280*720'
              if (!params.resolution) resolution = '1080p'
              break
            case '9:16':
              size = '720*1280'
              if (!params.resolution) resolution = '1080p'
              break
            case '1:1':
              // 1:1 (square) not supported by T2V model, use 16:9 as fallback
              console.warn('[AIGenerationPanel] 1:1 aspect ratio not supported for video, using 16:9')
              size = '1280*720'
              if (!params.resolution) resolution = '1080p'
              break
            case '4:3':
              // 4:3 not exactly supported, use closest 16:9
              console.warn('[AIGenerationPanel] 4:3 aspect ratio not supported for video, using 16:9')
              size = '1280*720'
              if (!params.resolution) resolution = '1080p'
              break
            default:
              console.error('[AIGenerationPanel] Invalid aspect ratio:', params.aspectRatio)
              size = '1280*720'
              if (!params.resolution) resolution = '1080p'
          }

          console.log('[AIGenerationPanel] Video generation params:', {
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
            size,
            model: params.model,
            resolution,
            hasImage: !!params.imageInput
          })

          response = await generateVideo({
            prompt: params.prompt,
            size,
            duration: params.duration || 5,
            model: params.model,
            aspectRatio: params.aspectRatio,
            resolution,
            image: params.imageInput,
            ...params.advancedParams
          })
        } else if (params.type === 'audio') {
          response = await generateAudio({
            prompt: params.prompt,
            duration: params.duration,
            model: params.model,
            ...params.advancedParams
          })
        }

        // Update with job ID
        updateGenerationStatus(generationId, 'generating', {
          jobId: response.job_id,
        })

        // Re-enable button after successful generation
        setIsPending(false)
      } catch (error) {
        console.error('Failed to start generation:', error)
        // Re-enable button after error
        setIsPending(false)
      }
    },
    [queueGeneration, updateGenerationStatus]
  )

  // NOTE: Polling fallback is now handled in RootLayout.tsx for persistence
  // across navigation and panel open/close states. No need for component-level polling here.

  // Handle generation cancellation
  const handleCancelGeneration = useCallback(
    async (generationId: string) => {
      const generation = activeGenerations.find((g) => g.id === generationId)
      if (generation?.jobId) {
        try {
          await cancelGenerationAPI(generation.jobId)
        } catch (error) {
          console.error('Failed to cancel generation:', error)
        }
      }
      cancelGeneration(generationId)
    },
    [activeGenerations, cancelGeneration]
  )

  // Handle removing completed/failed generations
  const handleRemoveGeneration = useCallback(
    (generationId: string) => {
      const generation = activeGenerations.find((g) => g.id === generationId)
      if (generation && (generation.status === 'completed' || generation.status === 'failed')) {
        // Add to history before removing
        if (generation.status === 'completed') {
          addToHistory(generation)
        }
        removeGeneration(generationId)
      }
    },
    [activeGenerations, addToHistory, removeGeneration]
  )

  // Handle rerunning a generation from history
  const handleRerun = useCallback(
    (prompt: string, type: 'image' | 'video' | 'audio', aspectRatio: string, qualityTier?: string) => {
      // Default models for rerun if not stored in history (legacy support)
      let model = 'nano-banana'
      if (type === 'video') model = 'wan-video-t2v'
      if (type === 'audio') model = 'stable-audio'

      handleGenerate({
        prompt,
        type,
        qualityTier: (qualityTier as QualityTier) || 'draft',
        aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3',
        model, // Use default model for reruns for now
        duration: type === 'audio' ? 45 : 5
      })
    },
    [handleGenerate]
  )

  // Get WebSocket jobs Map
  const wsJobs = useWebSocketStore((state) => state.jobs)

  // Track processed job updates to prevent duplicate processing
  const processedJobsRef = useRef(new Map<string, { status: string; timestamp: number }>())

  const resolveResultUrl = useCallback((result: unknown): string | undefined => {
    if (!result) return undefined

    if (typeof result === 'string') {
      return result
    }

    if (Array.isArray(result)) {
      for (const item of result) {
        const candidate = resolveResultUrl(item)
        if (candidate) return candidate
      }
      return undefined
    }

    if (typeof result === 'object') {
      const obj = result as Record<string, unknown>
      const prioritizedKeys = ['url', 'video', 'mp4', 'download_url', 'output']

      for (const key of prioritizedKeys) {
        const value = obj[key]
        if (typeof value === 'string' && value.startsWith('http')) {
          return value
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string' && item.startsWith('http')) {
              return item
            }
          }
        }
      }

      for (const value of Object.values(obj)) {
        if (typeof value === 'string' && value.startsWith('http')) {
          return value
        }
      }
    }

    return undefined
  }, [])

  // Sync WebSocket job updates to AI generation store
  useEffect(() => {
    // For each active generation with a jobId, check if there's a corresponding WebSocket job update
    activeGenerations.forEach((generation) => {
      if (!generation.jobId) return

      const job = wsJobs.get(generation.jobId)
      if (!job) return

      // CRITICAL: Validate this job actually belongs to this generation
      // Prevent wrong job results from being applied to different generations
      if (job.id && job.id !== generation.jobId) {
        console.warn(
          `[AIGenerationPanel] Job ID mismatch for generation ${generation.id}:`,
          { expectedJobId: generation.jobId, actualJobId: job.id }
        )
        return
      }

      // Check if we've already processed this job update for THIS specific generation
      // Use composite key to prevent cross-generation pollution
      const processingKey = `${generation.id}:${generation.jobId}`
      const processed = processedJobsRef.current.get(processingKey)

      // Skip if already processed this exact update (except for running jobs which can have progress updates)
      if (processed && processed.status === job.status && job.status !== 'running') {
        return
      }

      // Only update if generation is still in 'generating' or 'queued' status
      if (generation.status !== 'generating' && generation.status !== 'queued') return

      // Handle successful completion
      if (job.status === 'succeeded') {
        const resultUrl = resolveResultUrl(job.result)

        if (resultUrl) {
          // Log full payload for debugging
          console.log(`[AIGenerationPanel] Job ${generation.jobId} completed successfully`)
          console.log('[AIGenerationPanel] Full job payload:', JSON.stringify(job, null, 2))
          console.log('[AIGenerationPanel] Generation metadata:', {
            id: generation.id,
            jobId: generation.jobId,
            type: generation.type,
            prompt: generation.prompt,
            qualityTier: generation.qualityTier,
            aspectRatio: generation.aspectRatio,
            status: generation.status,
          })
          console.log('[AIGenerationPanel] Result URL:', resultUrl)

          // Mark as processed using composite key (generation.id:jobId)
          processedJobsRef.current.set(processingKey, {
            status: job.status,
            timestamp: Date.now()
          })

          // Update generation status to completed
          updateGenerationStatus(generation.id, 'completed', {
            resultUrl,
            progress: 100,
          })

          // Move to completing state to keep skeleton visible
          moveToCompleting(generation.id)

          // ✅ REMOVED: importFromUrl() call
          // The backend webhook now handles importing to S3 automatically.
          // The MediaAsset will be created by the worker after successful S3 upload.
          // Frontend will see the asset when it refreshes the media list.

          console.log(`[AIGenerationPanel] Job completed. Backend webhook will handle import automatically.`)

          // Refresh media library to show newly imported asset and clear skeleton
          // Add a small delay to ensure worker has time to create MediaAsset
          setTimeout(async () => {
            console.log('[AIGenerationPanel] Refreshing media library after job completion')
            try {
              await loadAssets()
              console.log('[AIGenerationPanel] Media library refreshed successfully')
              // Clear the completing generation after assets are loaded
              clearCompletingGeneration(generation.id)
            } catch (error) {
              console.error('[AIGenerationPanel] Failed to refresh media library:', error)
              // Still clear the completing generation on error to prevent stuck skeletons
              clearCompletingGeneration(generation.id)
            }
          }, 1500) // 2 second delay for worker to complete (reduced from 3s)
        } else {
          console.warn(
            `[AIGenerationPanel] Job ${generation.jobId} succeeded but no result URL found`,
            { result: job.result }
          )

          processedJobsRef.current.set(processingKey, {
            status: job.status,
            timestamp: Date.now()
          })

          // Still mark completion to unblock the UI; resultUrl undefined indicates an upstream payload issue
          updateGenerationStatus(generation.id, 'completed', {
            resultUrl,
            progress: 100,
          })
        }
      }

      // Handle failure
      if (job.status === 'failed') {
        console.error(`[AIGenerationPanel] Job ${generation.jobId} failed:`, job.error)

        // Mark as processed using composite key
        processedJobsRef.current.set(processingKey, {
          status: job.status,
          timestamp: Date.now()
        })

        updateGenerationStatus(generation.id, 'failed', {
          error: job.error || 'Generation failed',
        })
      }

      // Handle cancellation
      if (job.status === 'canceled') {
        console.log(`[AIGenerationPanel] Job ${generation.jobId} was canceled`)

        // Mark as processed using composite key
        processedJobsRef.current.set(processingKey, {
          status: job.status,
          timestamp: Date.now()
        })

        updateGenerationStatus(generation.id, 'cancelled')
      }

      // Update progress for running jobs (allow repeated updates for progress)
      if (job.status === 'running' && job.progress !== undefined) {
        // Only update if progress has changed
        if (!processed || processed.status !== 'running' || Math.abs((job.progress || 0) - (processed.timestamp || 0)) > 5) {
          updateGenerationStatus(generation.id, 'generating', {
            progress: job.progress,
          })

          // Update processed status for running jobs using composite key
          processedJobsRef.current.set(processingKey, {
            status: job.status,
            timestamp: job.progress || 0
          })
        }
      }
    })
  }, [wsJobs, activeGenerations, updateGenerationStatus, resolveResultUrl, loadAssets, moveToCompleting, clearCompletingGeneration])

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-zinc-800 px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="queue">
              Queue
              {activeCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="generate" className="p-4 m-0">
            {!canGenerate && (
              <div className="mb-4 p-3 bg-yellow-950/30 border border-yellow-900/50 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Maximum concurrent generations reached ({maxConcurrent}). Please wait for current
                  generations to complete.
                </p>
              </div>
            )}
            <PromptInput onGenerate={handleGenerate} isGenerating={isPending || !canGenerate} />
          </TabsContent>

          <TabsContent value="queue" className="p-4 m-0">
            <GenerationQueue
              generations={activeGenerations}
              onCancel={handleCancelGeneration}
              onRemove={handleRemoveGeneration}
            />
          </TabsContent>

          <TabsContent value="history" className="p-4 m-0">
            <GenerationHistory
              history={generationHistory}
              onRerun={handleRerun}
              onToggleFavorite={toggleFavorite}
              onDelete={removeFromHistory}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
