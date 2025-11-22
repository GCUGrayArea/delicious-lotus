import { useState, useEffect } from 'react'
import { Sparkles, Image, Video, Music, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import type { GenerationType, QualityTier } from '../../types/stores'

interface PromptInputProps {
  onGenerate: (params: {
    prompt: string
    type: GenerationType
    qualityTier: QualityTier
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
    model: string
    duration?: number
    resolution?: string
    imageInput?: string
    advancedParams?: Record<string, any>
  }) => void
  isGenerating?: boolean
  defaultPrompt?: string
  defaultType?: GenerationType
  autoPrompts?: Partial<Record<GenerationType, string>>
}

// Model Configuration Definitions
interface ModelConfig {
  id: string
  name: string
  type: GenerationType
  inputs: {
    aspectRatio?: boolean
    duration?: boolean
    resolution?: boolean
    image?: boolean // Image input (URL)
    lyrics?: boolean // For music models
    audio?: boolean // Audio input (URL)
  }
  options?: {
    resolutions?: string[]
    durations?: number[]
  }
  validation?: {
    imageRequired?: boolean
  }
  advanced?: {
    seed?: boolean
    negativePrompt?: boolean
    outputFormat?: boolean
    outputQuality?: boolean
    disableSafetyChecker?: boolean
    fps?: boolean
    cameraFixed?: boolean
    promptOptimizer?: boolean
  }
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Image Models
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana (Fast)',
    type: 'image',
    inputs: { aspectRatio: true },
  },
  'flux-schnell': {
    id: 'flux-schnell',
    name: 'Flux Schnell (High Quality)',
    type: 'image',
    inputs: { aspectRatio: true },
    advanced: {
      seed: true,
      outputFormat: true,
      outputQuality: true,
      disableSafetyChecker: true,
    },
  },

  // Video Models
  'wan-video-t2v': {
    id: 'wan-video-t2v',
    name: 'Wan Video 2.5 (Standard)',
    type: 'video',
    inputs: { aspectRatio: true, duration: true },
    options: { durations: [5, 10] },
  },
  'wan-video-i2v': {
    id: 'wan-video-i2v',
    name: 'Wan Video 2.5 (Image-to-Video)',
    type: 'video',
    inputs: { image: true, resolution: true, duration: true, audio: true },
    options: { resolutions: ['480p', '720p', '1080p'], durations: [5, 10] },
    validation: { imageRequired: true },
    advanced: { negativePrompt: true, promptOptimizer: true },
  },
  'veo-3.1': {
    id: 'veo-3.1',
    name: 'Google Veo 3.1',
    type: 'video',
    inputs: { aspectRatio: true, duration: true, resolution: true, image: true },
    options: { durations: [4, 6, 8], resolutions: ['1080p'] },
    advanced: { negativePrompt: true, seed: true },
  },
  'kling-v2.5': {
    id: 'kling-v2.5',
    name: 'Kling v2.5 Turbo',
    type: 'video',
    inputs: { aspectRatio: true, duration: true, image: true },
    options: { durations: [5, 10] },
    advanced: { negativePrompt: true },
  },
  'hailuo-2.3': {
    id: 'hailuo-2.3',
    name: 'Hailuo 2.3 (Image-to-Video)',
    type: 'video',
    inputs: { duration: true, resolution: true, image: true },
    options: { durations: [6, 10], resolutions: ['768p', '1080p'] },
    validation: { imageRequired: true },
    advanced: { promptOptimizer: true },
  },
  'seedance': {
    id: 'seedance',
    name: 'Seedance Pro',
    type: 'video',
    inputs: { aspectRatio: true, duration: true, resolution: true, image: true },
    options: { durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], resolutions: ['1080p'] },
    advanced: { fps: true, cameraFixed: true, seed: true },
  },

  // Audio Models
  'stable-audio': {
    id: 'stable-audio',
    name: 'Stable Audio 2.5',
    type: 'audio',
    inputs: { duration: true },
    options: { durations: [30, 45, 60, 90] },
    advanced: { seed: true },
  },
  'music-01': {
    id: 'music-01',
    name: 'Music-01 (Lyrics)',
    type: 'audio',
    inputs: { lyrics: true }, // Uses prompt as lyrics
  },
  'lyria-2': {
    id: 'lyria-2',
    name: 'Google Lyria 2',
    type: 'audio',
    inputs: {},
    advanced: { negativePrompt: true, seed: true },
  },
}

const MODELS_BY_TYPE = {
  image: ['nano-banana', 'flux-schnell'],
  video: ['wan-video-t2v', 'wan-video-i2v', 'veo-3.1', 'kling-v2.5', 'hailuo-2.3', 'seedance'],
  audio: ['stable-audio', 'music-01', 'lyria-2'],
}

export function PromptInput({
  onGenerate,
  isPending,
  defaultPrompt,
  defaultType,
  autoPrompts,
}: {
  onGenerate: (params: {
    prompt: string
    type: GenerationType
    qualityTier: QualityTier
    aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
    model: string
    duration?: number
    resolution?: string
    imageInput?: string
    audioInput?: string
    advancedParams?: Record<string, any>
  }) => void
  isPending: boolean
  defaultPrompt?: string
  defaultType?: GenerationType
  autoPrompts?: Partial<Record<GenerationType, string>>
}) {
  // Basic State
  const [prompt, setPrompt] = useState(defaultPrompt || '')
  const [generationType, setGenerationType] = useState<GenerationType>(defaultType || 'image')
  const [selectedModelId, setSelectedModelId] = useState<string>('flux-schnell')

  // Input State
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9')
  const [duration, setDuration] = useState<number>(5)
  const [resolution, setResolution] = useState<string>('1080p')
  const [imageInput, setImageInput] = useState('')
  const [audioInput, setAudioInput] = useState('')
  const [lyrics, setLyrics] = useState('')

  // Advanced State
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [outputFormat, setOutputFormat] = useState('webp')
  const [outputQuality, setOutputQuality] = useState(80)
  const [disableSafetyChecker, setDisableSafetyChecker] = useState(false)
  const [fps, setFps] = useState(24)
  const [cameraFixed, setCameraFixed] = useState(false)
  const [promptOptimizer, setPromptOptimizer] = useState(true)

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Derived State
  const selectedModel = MODEL_CONFIGS[selectedModelId] || MODEL_CONFIGS['nano-banana']

  // Reset state when type changes
  useEffect(() => {
    const defaultModel = MODELS_BY_TYPE[generationType][0]
    setSelectedModelId(defaultModel)
    setErrors({})
    // Auto-fill prompt based on generation type if provided
    if (autoPrompts && autoPrompts[generationType]) {
      setPrompt(autoPrompts[generationType] as string)
    }
  }, [generationType])

  // Sync prompt when defaultPrompt changes
  useEffect(() => {
    if (defaultPrompt !== undefined) {
      setPrompt(defaultPrompt)
    }
  }, [defaultPrompt])

  // Reset state when model changes
  useEffect(() => {
    const config = MODEL_CONFIGS[selectedModelId]
    if (config) {
      // Set defaults based on model options
      if (config.options?.durations?.length) setDuration(config.options.durations[0])
      if (config.options?.resolutions?.length) setResolution(config.options.resolutions[0])

      // Clear errors
      setErrors({})
    }
  }, [selectedModelId])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!prompt.trim()) {
      newErrors.prompt = 'Prompt is required'
    }

    if (selectedModel.validation?.imageRequired && !imageInput.trim()) {
      newErrors.image = 'Image URL is required for this model'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const advancedParams: Record<string, any> = {}
    if (selectedModel.advanced?.seed && seed !== undefined) advancedParams.seed = seed
    if (selectedModel.advanced?.negativePrompt && negativePrompt) advancedParams.negative_prompt = negativePrompt
    if (selectedModel.advanced?.outputFormat) advancedParams.output_format = outputFormat
    if (selectedModel.advanced?.outputQuality) advancedParams.output_quality = outputQuality
    if (selectedModel.advanced?.disableSafetyChecker) advancedParams.disable_safety_checker = disableSafetyChecker
    if (selectedModel.advanced?.fps) advancedParams.fps = fps
    if (selectedModel.advanced?.cameraFixed) advancedParams.camera_fixed = cameraFixed
    if (selectedModel.advanced?.promptOptimizer) advancedParams.prompt_optimizer = promptOptimizer

    onGenerate({
      prompt,
      type: generationType,
      qualityTier: 'draft',
      aspectRatio,
      model: selectedModelId,
      duration: selectedModel.inputs.duration ? duration : undefined,
      resolution: selectedModel.inputs.resolution ? resolution : undefined,
      imageInput: selectedModel.inputs.image ? imageInput : undefined,
      advancedParams
    })
  }

  const maxChars = 500
  const charsRemaining = maxChars - prompt.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Generation Type Toggle */}
      <div className="space-y-2">
        <Label>Generation Type</Label>
        <div className="flex gap-2">
          {(['image', 'video', 'audio'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setGenerationType(type)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${generationType === type
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
            >
              {type === 'image' && <Image className="w-5 h-5" />}
              {type === 'video' && <Video className="w-5 h-5" />}
              {type === 'audio' && <Music className="w-5 h-5" />}
              <span className="capitalize">{type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select value={selectedModelId} onValueChange={setSelectedModelId}>
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-zinc-100">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
            {MODELS_BY_TYPE[generationType].map((modelId) => (
              <SelectItem key={modelId} value={modelId}>
                {MODEL_CONFIGS[modelId].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompt Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt" className={errors.prompt ? 'text-red-500' : ''}>
            {selectedModel.inputs.lyrics ? 'Lyrics' : 'Prompt'}
            {errors.prompt && <span className="ml-2 text-xs text-red-500">({errors.prompt})</span>}
          </Label>
          <span className={`text-sm ${charsRemaining < 50 ? 'text-orange-500' : 'text-zinc-500'}`}>
            {charsRemaining}
          </span>
        </div>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, maxChars))}
          placeholder={selectedModel.inputs.lyrics ? "Enter lyrics..." : `Describe the ${generationType}...`}
          className={`w-full h-24 bg-zinc-900 border rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.prompt ? 'border-red-500' : 'border-zinc-800'
            }`}
          disabled={isPending}
        />
      </div>

      {/* Image Input (URL) */}
      {selectedModel.inputs.image && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="imageInput" className={errors.image ? 'text-red-500' : ''}>
              Image URL {selectedModel.validation?.imageRequired ? '(Required)' : '(Optional)'}
            </Label>
            {errors.image && (
              <div className="flex items-center text-red-500 text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.image}
              </div>
            )}
          </div>
          <Input
            id="imageInput"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className={`bg-zinc-900 ${errors.image ? 'border-red-500' : 'border-zinc-800'}`}
          />
        </div>
      )}

      {/* Dynamic Options Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Aspect Ratio */}
        {selectedModel.inputs.aspectRatio && (
          <div className="space-y-2 col-span-2">
            <Label>Aspect Ratio</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['16:9', '9:16', '1:1', '4:3'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-2 py-2 text-sm rounded-lg border transition-colors ${aspectRatio === ratio
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

        {/* Duration */}
        {selectedModel.inputs.duration && (
          <div className="space-y-2">
            <Label>Duration (s)</Label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(selectedModel.options?.durations || [5]).map((d) => (
                  <SelectItem key={d} value={d.toString()}>{d}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Resolution */}
        {selectedModel.inputs.resolution && (
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(selectedModel.options?.resolutions || ['1080p']).map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      {selectedModel.advanced && Object.keys(selectedModel.advanced).length > 0 && (
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="space-y-2 border border-zinc-800 rounded-lg p-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm text-zinc-400 hover:text-zinc-200">
            <span>Advanced Settings</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            {selectedModel.advanced.seed && (
              <div className="space-y-2">
                <Label className="text-xs">Seed (Optional)</Label>
                <Input
                  type="number"
                  placeholder="Random"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-zinc-900 border-zinc-800 h-8 text-sm"
                />
              </div>
            )}

            {selectedModel.advanced.negativePrompt && (
              <div className="space-y-2">
                <Label className="text-xs">Negative Prompt</Label>
                <Input
                  placeholder="What to avoid..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 h-8 text-sm"
                />
              </div>
            )}

            {selectedModel.advanced.outputFormat && (
              <div className="space-y-2">
                <Label className="text-xs">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webp">WebP</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedModel.advanced.outputQuality && (
              <div className="space-y-2">
                <Label className="text-xs">Quality (0-100): {outputQuality}</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={outputQuality}
                  onChange={(e) => setOutputQuality(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {selectedModel.advanced.disableSafetyChecker && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">Disable Safety Checker</Label>
                <Switch checked={disableSafetyChecker} onCheckedChange={setDisableSafetyChecker} />
              </div>
            )}

            {selectedModel.advanced.cameraFixed && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">Camera Fixed</Label>
                <Switch checked={cameraFixed} onCheckedChange={setCameraFixed} />
              </div>
            )}

            {selectedModel.advanced.promptOptimizer && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">Prompt Optimizer</Label>
                <Switch checked={promptOptimizer} onCheckedChange={setPromptOptimizer} />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Generate Button */}
      <Button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        {isPending ? 'Generating...' : `Generate ${generationType === 'image' ? 'Image' : generationType === 'video' ? 'Video' : 'Audio'}`}
      </Button>
    </form>
  )
}
