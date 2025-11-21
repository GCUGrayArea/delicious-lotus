/**
 * File Validation Utilities
 * Utilities for validating files before upload
 */

import { formatFileSize } from '@/services/ad-generator/services/assets';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationOptions {
  accept?: string;
  maxSize?: number;
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
  maxDuration?: number; // For audio/video
}

/**
 * Validate file type, size, and other constraints
 */
export function validateFile(
  file: File,
  options: ValidationOptions
): ValidationResult {
  // Check file type
  if (options.accept) {
    const accepted = isAcceptedType(file.type, options.accept);
    if (!accepted) {
      return {
        valid: false,
        error: `File type not accepted. Expected: ${options.accept}`,
      };
    }
  }

  // Check file size
  if (options.maxSize && file.size > options.maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${formatFileSize(options.maxSize)}`,
    };
  }

  return { valid: true };
}

/**
 * Check if file type matches accept string
 */
function isAcceptedType(fileType: string, accept: string): boolean {
  const acceptTypes = accept.split(',').map((t) => t.trim());

  return acceptTypes.some((acceptType) => {
    if (acceptType.endsWith('/*')) {
      const category = acceptType.replace('/*', '');
      return fileType.startsWith(category + '/');
    }
    return fileType === acceptType;
  });
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(
  file: File,
  options: {
    minDimensions?: { width: number; height: number };
    maxDimensions?: { width: number; height: number };
  }
): Promise<ValidationResult> {
  try {
    const dimensions = await getImageDimensions(file);

    if (options.minDimensions) {
      if (
        dimensions.width < options.minDimensions.width ||
        dimensions.height < options.minDimensions.height
      ) {
        return {
          valid: false,
          error: `Image too small. Min: ${options.minDimensions.width}×${options.minDimensions.height}`,
        };
      }
    }

    if (options.maxDimensions) {
      if (
        dimensions.width > options.maxDimensions.width ||
        dimensions.height > options.maxDimensions.height
      ) {
        return {
          valid: false,
          error: `Image too large. Max: ${options.maxDimensions.width}×${options.maxDimensions.height}`,
        };
      }
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Failed to read image dimensions',
    };
  }
}

/**
 * Get image dimensions
 */
function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Validate audio duration
 */
export async function validateAudioDuration(
  file: File,
  maxDuration: number
): Promise<ValidationResult> {
  try {
    const duration = await getAudioDuration(file);

    if (duration > maxDuration) {
      return {
        valid: false,
        error: `Audio too long. Max: ${maxDuration}s`,
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Failed to read audio duration',
    };
  }
}

/**
 * Get audio duration
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio'));
    };

    audio.src = url;
  });
}

/**
 * Generate thumbnail from image file
 */
export async function generateImageThumbnail(
  file: File,
  maxSize: number = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
