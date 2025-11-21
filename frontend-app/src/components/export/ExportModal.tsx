import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import type {
  AspectRatio,
  Resolution,
  ExportFormat,
  FrameRate,
  ExportSettings,
} from '@/types/export'
import { QUALITY_PRESETS, RESOLUTION_DIMENSIONS } from '@/types/export'
import { validateExportSettings, estimateFileSize } from '@/lib/exportValidation'

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (settings: ExportSettings) => void
  defaultProjectName?: string
}

export function ExportModal({
  open,
  onOpenChange,
  onExport,
  defaultProjectName = 'Untitled Project',
}: ExportModalProps) {
  // Form state
  const [name, setName] = useState(defaultProjectName)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [resolution, setResolution] = useState<Resolution>('1080p')
  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [quality, setQuality] = useState<number>(QUALITY_PRESETS.high)
  const [frameRate, setFrameRate] = useState<FrameRate>(30)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  // Get dimensions based on resolution and aspect ratio
  const dimensions = RESOLUTION_DIMENSIONS[resolution][aspectRatio]

  // Validate settings whenever they change
  useEffect(() => {
    const settings: Partial<ExportSettings> = {
      name,
      aspectRatio,
      resolution,
      format,
      quality,
      frameRate,
    }
    const validation = validateExportSettings(settings)
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
  }, [name, aspectRatio, resolution, format, quality, frameRate])

  // Calculate estimated file size (assuming 60 second duration as default)
  const estimatedSize = estimateFileSize(
    { name, aspectRatio, resolution, format, quality, frameRate },
    60
  )

  // Get quality preset name
  const getQualityLabel = (crfValue: number): string => {
    const preset = Object.entries(QUALITY_PRESETS).find(
      ([, value]) => value === crfValue
    )
    return preset ? preset[0] : 'Custom'
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const settings: ExportSettings = {
        name,
        aspectRatio,
        resolution,
        format,
        quality,
        frameRate,
      }
      await onExport(settings)
      onOpenChange(false)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Configure export settings for your video composition.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Project Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="grid gap-2">
            <Label htmlFor="aspectRatio">Aspect Ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(value) => setAspectRatio(value as AspectRatio)}
            >
              <SelectTrigger id="aspectRatio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="4:3">4:3 (Classic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resolution */}
          <div className="grid gap-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Select
              value={resolution}
              onValueChange={(value) => setResolution(value as Resolution)}
            >
              <SelectTrigger id="resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="480p">480p ({dimensions.width}x{dimensions.height})</SelectItem>
                <SelectItem value="720p">720p (HD)</SelectItem>
                <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                <SelectItem value="4k">4K (Ultra HD)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-zinc-400">
              Output: {dimensions.width} × {dimensions.height}
            </p>
          </div>

          {/* Format */}
          <div className="grid gap-2">
            <Label htmlFor="format">Format</Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
            >
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                <SelectItem value="webm">WebM (VP9)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div className="grid gap-2">
            <div className="flex justify-between">
              <Label htmlFor="quality">Quality</Label>
              <span className="text-sm text-zinc-400 capitalize">
                {getQualityLabel(quality)} (CRF: {quality})
              </span>
            </div>
            <Slider
              id="quality"
              min={18}
              max={28}
              step={1}
              value={[quality]}
              onValueChange={(value) => setQuality(value[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Best Quality</span>
              <span>Smaller File</span>
            </div>
          </div>

          {/* Frame Rate */}
          <div className="grid gap-2">
            <Label htmlFor="frameRate">Frame Rate</Label>
            <Select
              value={frameRate.toString()}
              onValueChange={(value) => setFrameRate(parseInt(value) as FrameRate)}
            >
              <SelectTrigger id="frameRate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps (Cinematic)</SelectItem>
                <SelectItem value="30">30 fps (Standard)</SelectItem>
                <SelectItem value="60">60 fps (Smooth)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Size Estimate */}
          <div className="rounded-md bg-zinc-800/50 p-3 text-sm text-zinc-400">
            Estimated file size: ~{estimatedSize} MB per minute
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
              {validationErrors.map((error, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
              {validationWarnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-yellow-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || validationErrors.length > 0}
          >
            {isSubmitting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
