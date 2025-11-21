import { X, Image, Video, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { Progress } from '../ui/progress'
import type { GenerationRequest } from '../../types/stores'

interface GenerationQueueProps {
  generations: GenerationRequest[]
  onCancel: (generationId: string) => void
  onRemove: (generationId: string) => void
}

export default function GenerationQueue({
  generations,
  onCancel,
  onRemove,
}: GenerationQueueProps) {
  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-lg p-8 max-w-md">
          <Loader2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">No Active Generations</h3>
          <p className="text-zinc-500 text-sm">
            Generated content will appear here while processing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {generations.map((generation) => (
        <GenerationCard
          key={generation.id}
          generation={generation}
          onCancel={onCancel}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

interface GenerationCardProps {
  generation: GenerationRequest
  onCancel: (generationId: string) => void
  onRemove: (generationId: string) => void
}

function GenerationCard({ generation, onCancel, onRemove }: GenerationCardProps) {
  const getStatusIcon = () => {
    switch (generation.status) {
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'generating':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <X className="w-5 h-5 text-zinc-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (generation.status) {
      case 'queued':
        return 'Queued'
      case 'generating':
        return 'Generating...'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return generation.status
    }
  }

  const canCancel = generation.status === 'queued' || generation.status === 'generating'
  const canRemove = generation.status === 'completed' || generation.status === 'failed' || generation.status === 'cancelled'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div className="flex-shrink-0 mt-1">
          {generation.type === 'image' ? (
            <Image className="w-6 h-6 text-zinc-400" />
          ) : (
            <Video className="w-6 h-6 text-zinc-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Prompt */}
          <p className="text-zinc-100 text-sm line-clamp-2 mb-2">{generation.prompt}</p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
            <span className="capitalize">{generation.type}</span>
            <span>•</span>
            <span>{generation.aspectRatio}</span>
            {generation.type === 'image' && generation.qualityTier && (
              <>
                <span>•</span>
                <span className="capitalize">{generation.qualityTier}</span>
              </>
            )}
          </div>

          {/* Job ID */}
          {generation.jobId && (
            <div className="text-xs text-zinc-600 font-mono mb-2 select-all">
              Job ID: {generation.jobId}
            </div>
          )}

          {/* Progress Bar (if generating) */}
          {generation.status === 'generating' && generation.progress !== undefined && (
            <div className="mb-3">
              <Progress value={generation.progress} className="h-2" />
              <p className="text-xs text-zinc-500 mt-1">{generation.progress}% complete</p>
            </div>
          )}

          {/* Error Message */}
          {generation.status === 'failed' && generation.error && (
            <div className="bg-red-950/30 border border-red-900/50 rounded px-3 py-2 mb-3">
              <p className="text-xs text-red-400">{generation.error}</p>
            </div>
          )}

          {/* Status and Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm text-zinc-400">{getStatusText()}</span>
            </div>
            <div className="text-xs text-zinc-500">
              {generation.completedAt
                ? `${Math.round((generation.completedAt.getTime() - generation.createdAt.getTime()) / 1000)}s`
                : new Date(generation.createdAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          {canCancel && (
            <button
              onClick={() => onCancel(generation.id)}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Cancel generation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove(generation.id)}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Remove from queue"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
