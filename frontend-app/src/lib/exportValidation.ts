import { z } from 'zod'
import type {
  AspectRatio,
  Resolution,
  ExportFormat,
  ExportSettings,
  ExportDimensions,
} from '@/types/export'
import {
  RESOLUTION_DIMENSIONS,
  FORMAT_CODEC_MAP,
} from '@/types/export'

// Zod schema for export settings validation
export const exportSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .trim(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3'], {
    message: 'Invalid aspect ratio',
  }),
  resolution: z.enum(['1080p', '720p', '480p', '4k'], {
    message: 'Invalid resolution',
  }),
  format: z.enum(['mp4', 'webm'], {
    message: 'Invalid export format',
  }),
  codec: z.enum(['h264', 'vp8', 'vp9']).optional(),
  quality: z
    .number()
    .min(18, 'Quality (CRF) must be between 18 and 28')
    .max(28, 'Quality (CRF) must be between 18 and 28')
    .int('Quality must be an integer'),
  frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)], {
    message: 'Frame rate must be 24, 30, or 60 fps',
  }),
})

// Validation result type
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validates export settings for compatibility and correctness
 */
export function validateExportSettings(
  settings: Partial<ExportSettings>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate using Zod schema
  const result = exportSettingsSchema.safeParse(settings)
  if (!result.success) {
    errors.push(...result.error.issues.map((err) => err.message))
    return { valid: false, errors, warnings }
  }

  const validSettings = result.data

  // Check format/codec compatibility
  const compatibilityCheck = validateFormatCodecCompatibility(
    validSettings.format,
    validSettings.codec
  )
  if (!compatibilityCheck.valid) {
    errors.push(compatibilityCheck.error!)
  }

  // Check resolution and aspect ratio constraints
  const dimensionsCheck = validateResolutionAspectRatio(
    validSettings.resolution as Resolution,
    validSettings.aspectRatio as AspectRatio
  )
  if (!dimensionsCheck.valid) {
    errors.push(dimensionsCheck.error!)
  }

  // Add warnings for quality/file size
  const qualityWarnings = getQualityWarnings(
    validSettings.quality,
    validSettings.resolution as Resolution
  )
  warnings.push(...qualityWarnings)

  // Add warnings for high resolution exports
  const resolutionWarnings = getResolutionWarnings(validSettings.resolution as Resolution)
  warnings.push(...resolutionWarnings)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validates format/codec compatibility
 */
export function validateFormatCodecCompatibility(
  format: ExportFormat,
  codec?: string
): { valid: boolean; error?: string } {
  if (!codec) {
    // Auto-select codec based on format
    return { valid: true }
  }

  const compatibleCodecs = FORMAT_CODEC_MAP[format]
  if (!compatibleCodecs.includes(codec as any)) {
    return {
      valid: false,
      error: `Codec ${codec} is not compatible with format ${format}. Use ${compatibleCodecs.join(' or ')} instead.`,
    }
  }

  return { valid: true }
}

/**
 * Validates resolution and aspect ratio combination
 */
export function validateResolutionAspectRatio(
  resolution: Resolution,
  aspectRatio: AspectRatio
): { valid: boolean; error?: string } {
  const dimensions = RESOLUTION_DIMENSIONS[resolution]?.[aspectRatio]

  if (!dimensions) {
    return {
      valid: false,
      error: `Invalid combination of resolution ${resolution} and aspect ratio ${aspectRatio}`,
    }
  }

  // Check if dimensions are reasonable (not too large)
  const maxDimension = Math.max(dimensions.width, dimensions.height)
  if (maxDimension > 4320) {
    // 8K limit
    return {
      valid: false,
      error: `Output dimensions (${dimensions.width}x${dimensions.height}) exceed maximum supported resolution`,
    }
  }

  return { valid: true }
}

/**
 * Get warnings about quality settings
 */
export function getQualityWarnings(quality: number, resolution: Resolution): string[] {
  const warnings: string[] = []

  // Warn about very high quality with high resolution (large file size)
  if (quality <= 20 && (resolution === '1080p' || resolution === '4k')) {
    warnings.push(
      'High quality setting with high resolution will result in very large file sizes'
    )
  }

  // Warn about low quality
  if (quality >= 26) {
    warnings.push('Quality setting may result in visible compression artifacts')
  }

  return warnings
}

/**
 * Get warnings about resolution settings
 */
export function getResolutionWarnings(resolution: Resolution): string[] {
  const warnings: string[] = []

  if (resolution === '4k') {
    warnings.push(
      '4K export may take significantly longer to process and require more storage'
    )
  }

  return warnings
}

/**
 * Calculate output dimensions based on resolution and aspect ratio
 */
export function calculateOutputDimensions(
  resolution: Resolution,
  aspectRatio: AspectRatio
): ExportDimensions {
  return RESOLUTION_DIMENSIONS[resolution][aspectRatio]
}

/**
 * Estimate file size in MB based on settings
 * This is a rough estimate based on typical encoding parameters
 */
export function estimateFileSize(
  settings: ExportSettings,
  durationSeconds: number
): number {
  const dimensions = calculateOutputDimensions(
    settings.resolution,
    settings.aspectRatio
  )
  const pixelCount = dimensions.width * dimensions.height

  // Base bitrate calculation (simplified)
  // Quality affects bitrate: lower CRF = higher bitrate
  const qualityMultiplier = 1 + (28 - settings.quality) / 10
  const baseBitrateMbps = (pixelCount / 1000000) * 0.1 * qualityMultiplier

  // Frame rate multiplier
  const fpsMultiplier = settings.frameRate / 30

  // Final bitrate in Mbps
  const bitrateMbps = baseBitrateMbps * fpsMultiplier

  // Convert to MB (duration * bitrate / 8)
  const fileSizeMB = (durationSeconds * bitrateMbps) / 8

  return Math.round(fileSizeMB * 100) / 100
}

/**
 * Get the default codec for a given format
 */
export function getDefaultCodec(format: ExportFormat): string {
  return FORMAT_CODEC_MAP[format][0]
}
