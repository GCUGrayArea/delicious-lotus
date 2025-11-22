import { Dialog, DialogContent } from '../ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { ExternalLink, Copy, Check, Pencil, X, Save, Info } from 'lucide-react'
import type { MediaAsset } from '../../types/stores'
import { useEffect, useRef, useState } from 'react'
import { updateMediaAsset } from '../../lib/api'

interface MediaPreviewModalProps {
  asset: MediaAsset | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedAsset: MediaAsset) => void
}

/**
 * MediaPreviewModal - Full-size preview modal for media assets
 * Shows images, playable videos, or audio files with source URL link
 */
export function MediaPreviewModal({ asset, isOpen, onClose, onUpdate }: MediaPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes or asset changes
  useEffect(() => {
    if (isOpen && asset) {
      setEditedName(asset.name)
      setIsEditing(false)
      setError(null)
    } else if (!isOpen) {
      // Pause and reset video
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      // Pause and reset audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [isOpen, asset])

  if (!asset) return null

  const isVideo = asset.type === 'video'
  const isImage = asset.type === 'image'
  const isAudio = asset.type === 'audio'

  const cleanUrl = asset.url.split('?')[0]

  const handleSave = async () => {
    if (!editedName.trim()) {
      setError('Name cannot be empty')
      return
    }

    // Validate name: alphanumeric, spaces, hyphens, underscores, dots (for extensions)
    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(editedName)) {
      setError('Name contains invalid characters')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const updatedAssetRaw = await updateMediaAsset(asset.id, { name: editedName })

      // Map API response to MediaAsset structure
      const updatedAsset: MediaAsset = {
        ...asset,
        name: updatedAssetRaw.name,
        // Ensure type is preserved correctly (API returns file_type)
        type: (updatedAssetRaw.file_type || asset.type) as 'image' | 'video' | 'audio',
      }

      if (onUpdate) {
        onUpdate(updatedAsset)
      }
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update asset name:', err)
      setError('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditedName(asset.name)
      setError(null)
    }
  }

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(cleanUrl)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditing(false)
        setError(null)
      }
      onClose()
    }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-zinc-950 border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex-1 min-w-0 mr-4">
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => {
                      setEditedName(e.target.value)
                      setError(null)
                    }}
                    onKeyDown={handleKeyDown}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-100 text-lg font-semibold rounded px-2 py-1 focus:outline-none focus:border-blue-500 w-full max-w-md"
                    autoFocus
                    disabled={isSaving}
                  />
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-1 hover:bg-zinc-800 rounded text-green-500 disabled:opacity-50"
                    title="Save"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedName(asset.name)
                      setError(null)
                    }}
                    disabled={isSaving}
                    className="p-1 hover:bg-zinc-800 rounded text-red-500 disabled:opacity-50"
                    title="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {error && <span className="text-xs text-red-500">{error}</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-lg font-semibold text-zinc-100 truncate max-w-md" title={asset.name}>
                  {asset.name}
                </h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-400 transition-opacity"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            {(() => {
              const parts = [
                asset.width && asset.height ? `${asset.width} × ${asset.height} ` : null,
                asset.duration ? `${Math.floor(asset.duration / 60)}:${String(Math.floor(asset.duration % 60)).padStart(2, '0')} ` : null,
              ].filter(Boolean)

              if (parts.length === 0) return null

              return <p className="text-sm text-zinc-400 mt-1">{parts.join(' • ')}</p>
            })()}
          </div>
          <div className="flex items-center gap-2 mr-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => window.open(asset.url, '_blank')}
                    className="h-8 w-8"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Open Source</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleCopyLink}
                    className="h-8 w-8"
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{isCopied ? 'Copied!' : 'Copy Link'}</p>
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-8 w-8">
                        <Info className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Asset Info</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Asset Information</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {asset.width && asset.height && (
                    <div className="px-2 py-1.5 text-sm">
                      <span className="text-zinc-400 block text-xs mb-0.5">Dimensions</span>
                      {asset.width} × {asset.height}
                    </div>
                  )}

                  {/* Tags Section */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="px-2 py-1.5 text-sm">
                      <span className="text-zinc-400 block text-xs mb-1">Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.map((tag, index) => (
                          <span key={index} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300 border border-zinc-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specific Metadata: Prompt */}
                  {!!asset.metadata?.prompt && (
                    <div className="px-2 py-1.5 text-sm">
                      <span className="text-zinc-400 block text-xs mb-0.5">Prompt</span>
                      <p className="whitespace-pre-wrap text-zinc-200 line-clamp-6">
                        {String(asset.metadata.prompt)}
                      </p>
                    </div>
                  )}

                  {/* Specific Metadata: Model */}
                  {!!(asset.metadata?.model || asset.metadata?.ai_model) && (
                    <div className="px-2 py-1.5 text-sm">
                      <span className="text-zinc-400 block text-xs mb-0.5">Model</span>
                      {String(asset.metadata.model || asset.metadata.ai_model)}
                    </div>
                  )}

                  {/* Other Metadata Loop */}
                  {asset.metadata && Object.entries(asset.metadata).map(([key, value]) => {
                    // Skip keys we've already handled or that are internal/irrelevant
                    if (['prompt', 'model', 'ai_model'].includes(key)) return null
                    if (value === null || value === undefined) return null

                    return (
                      <div key={key} className="px-2 py-1.5 text-sm">
                        <span className="text-zinc-400 block text-xs mb-0.5 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <p className="text-zinc-200 break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    )
                  })}

                  {/* Fallback if absolutely nothing to show */}
                  {!asset.width && !asset.height &&
                    (!asset.tags || asset.tags.length === 0) &&
                    (!asset.metadata || Object.keys(asset.metadata).length === 0) && (
                      <div className="px-2 py-1.5 text-sm text-zinc-500 italic">
                        No additional information available
                      </div>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex items-center justify-center p-4 bg-black" style={{ maxHeight: 'calc(95vh - 80px)' }}>
          {isImage && (
            <img
              src={cleanUrl}
              alt={asset.name}
              className="max-w-full max-h-full object-contain"
              style={{ maxWidth: '95vw', maxHeight: 'calc(95vh - 80px)' }}
            />
          )}

          {isVideo && (
            <video
              ref={videoRef}
              src={cleanUrl}
              controls
              autoPlay
              className="max-w-full max-h-full"
              style={{ maxWidth: '95vw', maxHeight: 'calc(95vh - 80px)' }}
            >
              Your browser does not support the video tag.
            </video>
          )}

          {isAudio && (
            <div className="flex flex-col items-center justify-center gap-6 p-8">
              {/* Audio Waveform Placeholder / Icon */}
              <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>

              {/* Audio Player */}
              <audio
                ref={audioRef}
                src={cleanUrl}
                controls
                autoPlay
                className="w-full max-w-md"
              >
                Your browser does not support the audio element.
              </audio>

              {/* Audio Info */}
              <div className="text-center">
                <p className="text-zinc-300 font-medium">{asset.name}</p>
                {asset.duration && (
                  <p className="text-sm text-zinc-500 mt-1">
                    Duration: {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, '0')}
                  </p>
                )}
              </div>
            </div>
          )}

          {!isImage && !isVideo && !isAudio && (
            <div className="text-center text-zinc-400 p-8">
              <p className="mb-2">Preview not available for this media type</p>
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog >
  )
}
