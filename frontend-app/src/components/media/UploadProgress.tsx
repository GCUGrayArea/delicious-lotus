import { useEffect, useState } from 'react'
import { X, CheckCircle, XCircle, Loader2, Pause, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import type { UploadItem } from '../../types/stores'

interface UploadProgressProps {
  upload: UploadItem
  onCancel?: (uploadId: string) => void
  onRetry?: (uploadId: string) => void
  onRemove?: (uploadId: string) => void
  bytesPerSecond?: number
}

/**
 * Formats bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Formats seconds to human-readable format
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}h ${m}m ${s}s`
  } else if (m > 0) {
    return `${m}m ${s}s`
  } else {
    return `${s}s`
  }
}

/**
 * Individual upload progress item component
 */
export function UploadProgressItem({
  upload,
  onCancel,
  onRetry,
  onRemove,
  bytesPerSecond = 0,
}: UploadProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Calculate time remaining based on upload speed
  useEffect(() => {
    if (upload.status === 'uploading' && bytesPerSecond > 0) {
      const remainingBytes = upload.file.size * (1 - upload.progress / 100)
      const seconds = remainingBytes / bytesPerSecond
      if (seconds !== timeRemaining) {
        setTimeRemaining(seconds)
      }
    } else if (timeRemaining !== 0) {
      setTimeRemaining(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.status, upload.progress, upload.file.size, bytesPerSecond])

  const getStatusIcon = () => {
    switch (upload.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
      case 'queued':
        return <Pause className="w-4 h-4 text-zinc-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-zinc-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (upload.status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return upload.error || 'Failed'
      case 'uploading':
        return `Uploading... ${upload.progress}%`
      case 'processing':
        return 'Processing...'
      case 'queued':
        return 'Queued'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = () => {
    switch (upload.status) {
      case 'completed':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
      case 'uploading':
        return 'text-blue-400'
      case 'processing':
        return 'text-purple-400'
      case 'queued':
        return 'text-zinc-400'
      case 'cancelled':
        return 'text-zinc-500'
      default:
        return 'text-zinc-400'
    }
  }

  const showActions = upload.status !== 'completed'
  const canCancel = upload.status === 'uploading' || upload.status === 'queued'
  const canRetry = upload.status === 'failed'
  const canRemove = upload.status === 'completed' || upload.status === 'failed' || upload.status === 'cancelled'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      {/* Header with file name and status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getStatusIcon()}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {upload.file.name}
            </p>
            <p className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1">
            {canRetry && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onRetry(upload.id)}
                title="Retry upload"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            {canCancel && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onCancel(upload.id)}
                title="Cancel upload"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {canRemove && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onRemove(upload.id)}
                title="Remove from list"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(upload.status === 'uploading' || upload.status === 'processing') && (
        <div className="space-y-1.5">
          <Progress value={upload.progress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {formatBytes(upload.file.size * upload.progress / 100)} / {formatBytes(upload.file.size)}
            </span>
            {bytesPerSecond > 0 && upload.status === 'uploading' && (
              <span>
                {formatBytes(bytesPerSecond)}/s • {formatTime(timeRemaining)} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Retry count indicator */}
      {upload.retryCount > 0 && (
        <p className="text-xs text-zinc-500">
          Retry attempt {upload.retryCount}
        </p>
      )}
    </div>
  )
}

/**
 * Upload queue list component showing all uploads
 */
interface UploadQueueProps {
  uploads: UploadItem[]
  onCancel?: (uploadId: string) => void
  onRetry?: (uploadId: string) => void
  onRemove?: (uploadId: string) => void
  onClearCompleted?: () => void
  uploadSpeeds?: Map<string, number> // uploadId -> bytes per second
}

export function UploadQueue({
  uploads,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
  uploadSpeeds = new Map(),
}: UploadQueueProps) {
  const activeUploads = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'queued' || u.status === 'processing'
  )
  const completedUploads = uploads.filter((u) => u.status === 'completed')
  const failedUploads = uploads.filter((u) => u.status === 'failed')

  const totalProgress = activeUploads.length > 0
    ? activeUploads.reduce((sum, u) => sum + u.progress, 0) / activeUploads.length
    : 0

  if (uploads.length === 0) {
    return null
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-4">
      {/* Header with overall stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Uploads
            {activeUploads.length > 0 && (
              <span className="ml-2 text-xs text-zinc-400">
                {activeUploads.length} active
              </span>
            )}
          </h3>
          {activeUploads.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Overall progress: {Math.round(totalProgress)}%
            </p>
          )}
        </div>

        {completedUploads.length > 0 && onClearCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCompleted}
            className="text-xs h-7"
          >
            Clear completed
          </Button>
        )}
      </div>

      {/* Overall progress bar for active uploads */}
      {activeUploads.length > 0 && (
        <Progress value={totalProgress} className="h-1" />
      )}

      {/* Upload items */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {/* Failed uploads first */}
        {failedUploads.map((upload) => (
          <UploadProgressItem
            key={upload.id}
            upload={upload}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            bytesPerSecond={uploadSpeeds.get(upload.id)}
          />
        ))}

        {/* Active uploads */}
        {activeUploads.map((upload) => (
          <UploadProgressItem
            key={upload.id}
            upload={upload}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            bytesPerSecond={uploadSpeeds.get(upload.id)}
          />
        ))}

        {/* Completed uploads */}
        {completedUploads.map((upload) => (
          <UploadProgressItem
            key={upload.id}
            upload={upload}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            bytesPerSecond={uploadSpeeds.get(upload.id)}
          />
        ))}
      </div>
    </div>
  )
}
