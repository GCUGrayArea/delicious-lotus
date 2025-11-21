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
  const completingGenerationsMap = useAIGenerationStore((state) => state.completingGenerations)
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
    () => {
      const active = Array.from(activeGenerationsMap.values())
      const completing = Array.from(completingGenerationsMap.values())
      return [...active, ...completing].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )
    },
    [activeGenerationsMap, completingGenerationsMap]
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
      modelId?: string
      duration?: number
      resolution?: string
      imageUrl?: string
      lastFrameUrl?: string
      cameraFixed?: boolean
      lyrics?: string
      referenceAudioUrl?: string
      negativePrompt?: string
    }) => {
      // Disable button while API call is in progress
      setIsPending(true)

      // Queue the generation in the store immediately
      const generationId = queueGeneration({
        type: params.type,
        prompt: params.prompt,
        qualityTier: params.qualityTier,
        aspectRatio: params.aspectRatio,
      })

      try {
        let response

        if (params.type === 'image') {
          response = await generateImage({
            prompt: params.prompt,
            qualityTier: params.qualityTier,
            aspectRatio: params.aspectRatio,
          })
        } else if (params.type === 'video') {
          // Video generation dispatch
          switch (params.modelId) {
            case 'wan-video-i2v':
              if (!params.imageUrl) throw new Error('Image URL is required for Image-to-Video')
              response = await import('../../services/aiGenerationService').then(m => m.generateWanVideoI2V({
                prompt: params.prompt,
                image: params.imageUrl,
                last_image: params.lastFrameUrl,
                resolution: params.resolution as '480p' | '720p',
              }))
              break
            case 'seedance':
              response = await import('../../services/aiGenerationService').then(m => m.generateSeedanceVideo({
                prompt: params.prompt,
                image: params.imageUrl,
                duration: params.duration,
                resolution: params.resolution,
                aspect_ratio: params.aspectRatio,
                camera_fixed: params.cameraFixed,
              }))
              break
            case 'hailuo':
              if (!params.imageUrl) throw new Error('First frame image is required for Hailuo')
              response = await import('../../services/aiGenerationService').then(m => m.generateHailuoVideo({
                prompt: params.prompt,
                first_frame_image: params.imageUrl,
                duration: params.duration,
                resolution: params.resolution,
              }))
              break
            case 'kling':
              response = await import('../../services/aiGenerationService').then(m => m.generateKlingVideo({
                prompt: params.prompt,
                start_image: params.imageUrl,
                duration: params.duration,
                aspect_ratio: params.aspectRatio,
                negative_prompt: params.negativePrompt,
              }))
              break
            case 'veo':
              response = await import('../../services/aiGenerationService').then(m => m.generateVeoVideo({
                prompt: params.prompt,
                image: params.imageUrl,
                last_frame: params.lastFrameUrl,
                duration: params.duration,
                aspect_ratio: params.aspectRatio,
                resolution: params.resolution,
                negative_prompt: params.negativePrompt,
              }))
              break
            case 'wan-video-t2v':
            default: {
              // Default to Wan Video T2V
              const videoSize = params.aspectRatio === '9:16' ? '720*1280' : '1280*720'

              response = await generateVideo({
                prompt: params.prompt,
                size: videoSize,
                duration: params.duration || 5,
              })
              break
            }
          }
        } else if (params.type === 'audio') {
          // Audio generation dispatch
          switch (params.modelId) {
            case 'music-01':
              response = await import('../../services/aiGenerationService').then(m => m.generateMusic01Audio({
                lyrics: params.lyrics,
                song_file: params.referenceAudioUrl,
              }))
              break
            case 'music-1.5':
              if (!params.lyrics) throw new Error('Lyrics are required for Music 1.5')
              response = await import('../../services/aiGenerationService').then(m => m.generateMusic15Audio({
                prompt: params.prompt,
                lyrics: params.lyrics!,
              }))
              break
            case 'stable-audio':
              response = await import('../../services/aiGenerationService').then(m => m.generateStableAudio({
                prompt: params.prompt,
                duration: params.duration,
              }))
              break
            case 'lyria':
            default:
              response = await import('../../services/aiGenerationService').then(m => m.generateLyriaAudio({
                prompt: params.prompt,
                negative_prompt: params.negativePrompt,
              }))
              break
          }
        }

        console.log('[AIGenerationPanel] Generation response:', response)

        if (response && response.job_id) {
          // Update with job ID
          updateGenerationStatus(generationId, 'generating', {
            jobId: response.job_id,
          })
        } else {
          console.warn('[AIGenerationPanel] No job ID in response:', response)
          // If no job ID, we should probably fail the generation
          updateGenerationStatus(generationId, 'failed', {
            error: 'Failed to start generation: No Job ID returned',
          })
        }

        // Re-enable button after successful generation
        setIsPending(false)
      } catch (error: unknown) {
        console.error('Failed to start generation:', error)
        // Update status to failed so it doesn't stay stuck in 'generating'
        updateGenerationStatus(generationId, 'failed', {
          error: error instanceof Error ? error.message : 'Generation failed',
        })

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
      if (generation && (generation.status === 'completed' || generation.status === 'failed' || generation.status === 'cancelled')) {
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
    (prompt: string, type: 'image' | 'video', aspectRatio: string, qualityTier?: string) => {
      handleGenerate({
        prompt,
        type,
        qualityTier: (qualityTier as QualityTier) || 'draft',
        aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1' | '4:3',
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
          // moveToCompleting(generation.id)

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
              // clearCompletingGeneration(generation.id)
            } catch (error) {
              console.error('[AIGenerationPanel] Failed to refresh media library:', error)
              // Still clear the completing generation on error to prevent stuck skeletons
              // clearCompletingGeneration(generation.id)
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
