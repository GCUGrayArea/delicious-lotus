import { useState, useEffect } from 'react'
import { Sparkles, Image, Video, Music, Settings2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

import type { GenerationType, QualityTier } from '../../types/stores'

// Model definitions
const VIDEO_MODELS = [
  { id: 'wan-video-t2v', name: 'Wan Video 2.5 T2V', type: 't2v' },
  { id: 'wan-video-i2v', name: 'Wan Video I2V', type: 'i2v' },
  { id: 'seedance', name: 'Seedance-1-Pro-Fast', type: 'both' },
  { id: 'hailuo', name: 'MiniMax Hailuo 2.3', type: 'i2v' },
  { id: 'kling', name: 'Kling v2.5 Turbo', type: 'both' },
  { id: 'veo', name: 'Google Veo 3.1', type: 'both' },
]

const AUDIO_MODELS = [
  { id: 'lyria', name: 'Google Lyria 2' },
  { id: 'music-01', name: 'MiniMax Music-01' },
  { id: 'music-1.5', name: 'MiniMax Music 1.5' },
  { id: 'stable-audio', name: 'Stable Audio 2.5' },
]

export interface GenerationParams {
  prompt: string
  type: GenerationType
  qualityTier: QualityTier
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
  modelId?: string
  // Video params
  duration?: number
  resolution?: string
  imageUrl?: string
  lastFrameUrl?: string
  cameraFixed?: boolean
  // Audio params
  referenceAudioUrl?: string
  lyrics?: string
  negativePrompt?: string
}

interface PromptInputProps {
  onGenerate: (params: GenerationParams) => void
  isGenerating?: boolean
}

export default function PromptInput({ onGenerate, isGenerating = false }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [generationType, setGenerationType] = useState<GenerationType>('image')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9')

  // Model state
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0].id)
  const [selectedAudioModel, setSelectedAudioModel] = useState(AUDIO_MODELS[0].id)

  // Advanced params
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState('720p')
  const [imageUrl, setImageUrl] = useState('')
  const [referenceAudioUrl, setReferenceAudioUrl] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Reset params when type changes
  useEffect(() => {
    if (generationType === 'image') {
      // Reset to defaults if needed
    }
  }, [generationType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!prompt.trim() && generationType !== 'audio') return // Audio might use lyrics instead
    if (generationType === 'audio') {
      if (selectedAudioModel === 'music-01' && !lyrics.trim() && !prompt.trim()) return
      if (selectedAudioModel === 'music-1.5' && (!prompt.trim() || !lyrics.trim())) return
    }

    onGenerate({
      prompt,
      type: generationType,
      qualityTier: 'draft',
      aspectRatio,
      modelId: generationType === 'video' ? selectedVideoModel : generationType === 'audio' ? selectedAudioModel : undefined,
      duration,
      resolution,
      imageUrl: imageUrl.trim() || undefined,
      referenceAudioUrl: referenceAudioUrl.trim() || undefined,
      lyrics: lyrics.trim() || undefined,
      negativePrompt: negativePrompt.trim() || undefined,
    })
  }

  const maxChars = 2000
  const charsRemaining = maxChars - prompt.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Generation Type Toggle */}
      <div className="space-y-2">
        <Label>Generation Type</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGenerationType('image')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${generationType === 'image'
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
          >
            <Image className="w-5 h-5" />
            <span>Image</span>
          </button>
          <button
            type="button"
            onClick={() => setGenerationType('video')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${generationType === 'video'
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
          >
            <Video className="w-5 h-5" />
            <span>Video</span>
          </button>
          <button
            type="button"
            onClick={() => setGenerationType('audio')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${generationType === 'audio'
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
          >
            <Music className="w-5 h-5" />
            <span>Audio</span>
          </button>
        </div>
      </div>

      {/* Model Selection */}
      {generationType === 'video' && (
        <div className="space-y-2">
          <Label>Video Model</Label>
          <Select value={selectedVideoModel} onValueChange={setSelectedVideoModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {generationType === 'audio' && (
        <div className="space-y-2">
          <Label>Audio Model</Label>
          <Select value={selectedAudioModel} onValueChange={setSelectedAudioModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Prompt Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt">Prompt</Label>
          <span
            className={`text-sm ${charsRemaining < 50 ? 'text-orange-500' : 'text-zinc-500'}`}
          >
            {charsRemaining} characters remaining
          </span>
        </div>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, maxChars))}
          placeholder={`Describe the ${generationType} you want to generate...`}
          className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          disabled={isGenerating}
        />
      </div>

      {/* Audio Specific: Lyrics & Reference (Music-01) */}
      {generationType === 'audio' && selectedAudioModel === 'music-01' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referenceAudio">Reference Audio URL (Required)</Label>
            <Input
              id="referenceAudio"
              value={referenceAudioUrl}
              onChange={(e) => setReferenceAudioUrl(e.target.value)}
              placeholder="https://example.com/song.mp3"
              disabled={isGenerating}
            />
            <p className="text-xs text-zinc-500">
              Required for Music-01. Provide a link to a song or voice sample.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lyrics">Lyrics (Optional)</Label>
            <textarea
              id="lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Enter lyrics here..."
              className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isGenerating}
            />
          </div>
        </div>
      )}

      {/* Audio Specific: Lyrics (Music 1.5) */}
      {generationType === 'audio' && selectedAudioModel === 'music-1.5' && (
        <div className="space-y-2">
          <Label htmlFor="lyrics">Lyrics (Required)</Label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Enter lyrics here... (Supports [intro][verse][chorus][bridge][outro])"
            className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isGenerating}
          />
          <p className="text-xs text-zinc-500">
            Both Prompt and Lyrics are required for Music 1.5.
          </p>
        </div>
      )}

      {/* Advanced Settings Toggle */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
        </Button>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
          {/* Aspect Ratio - Image/Video only */}
          {generationType !== 'audio' && (
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['16:9', '9:16', '1:1', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${aspectRatio === ratio
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video Specific Params */}
          {generationType === 'video' && (
            <>
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5s</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Input Image URL (Optional)</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {/* Negative Prompt */}
          <div className="space-y-2">
            <Label>Negative Prompt</Label>
            <Input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to avoid..."
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        type="submit"
        disabled={(!prompt.trim() && !lyrics.trim()) || isGenerating}
        className="w-full flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        {isGenerating ? 'Generating...' : `Generate ${generationType === 'image' ? 'Image' : generationType === 'video' ? 'Video' : 'Audio'}`}
      </Button>
    </form>
  )
}
