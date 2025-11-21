/**
 * Form Validation Utilities
 */

import type { AdCreativeFormData, ValidationRule, FormErrors } from '@/types/ad-generator/form';

/**
 * Validation rules for each step
 */
export const VALIDATION_RULES: Record<number, Record<string, ValidationRule>> = {
  // Step 1: Prompt Input
  1: {
    prompt: {
      required: true,
      maxLength: 2000,
      message: 'Prompt cannot exceed 2000 characters',
    },
  },

  // Step 2: Brand Settings
  2: {
    brandName: {
      maxLength: 100,
      message: 'Brand name cannot exceed 100 characters',
    },
    'brandColors.primary': {
      required: true,
      pattern: /^#[0-9A-Fa-f]{6}$/,
      message: 'Primary color must be a valid hex code (e.g., #2563eb)',
    },
    'brandColors.secondary': {
      required: true,
      pattern: /^#[0-9A-Fa-f]{6}$/,
      message: 'Secondary color must be a valid hex code (e.g., #10b981)',
    },
    ctaText: {
      maxLength: 50,
      custom: (value: string, formData: AdCreativeFormData) => {
        if (formData.includeCta && !value) {
          return false;
        }
        return true;
      },
      message: 'CTA text is required when CTA is enabled',
    },
  },

  // Step 3: Video Parameters
  3: {
    duration: {
      required: true,
      enum: [15, 30, 45, 60],
      message: 'Please select a valid duration',
    },
    aspectRatio: {
      required: true,
      enum: ['16:9', '9:16', '1:1'],
      message: 'Please select a valid aspect ratio',
    },
    style: {
      required: true,
      enum: ['professional', 'casual', 'modern', 'luxury', 'minimal', 'energetic', 'elegant'],
      message: 'Please select a video style',
    },
    musicStyle: {
      required: true,
      enum: ['corporate', 'upbeat', 'cinematic', 'ambient', 'electronic', 'none'],
      message: 'Please select a music style',
    },
  },

  // Step 4: Review (validates all previous steps)
  4: {},
};

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => (current as Record<string, unknown>)?.[key], obj as unknown);
}

/**
 * Validate a single field
 */
export function validateField(
  _fieldName: string,
  value: unknown,
  rule: ValidationRule,
  formData?: AdCreativeFormData
): string | null {
  // Required validation
  if (rule.required && (value === undefined || value === null || value === '')) {
    return rule.message;
  }

  // Skip other validations if value is empty and not required
  if (!value && !rule.required) {
    return null;
  }

  // MinLength validation
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return rule.message;
  }

  // MaxLength validation
  if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
    return rule.message;
  }

  // Pattern validation
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return rule.message;
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    return rule.message;
  }

  // Custom validation
  if (rule.custom && formData && !rule.custom(value, formData)) {
    return rule.message;
  }

  return null;
}

/**
 * Validate a specific step
 */
export function validateStep(step: number, formData: AdCreativeFormData): FormErrors {
  const errors: FormErrors = {};
  const stepRules = VALIDATION_RULES[step] || {};

  // For step 4 (review), validate all previous steps
  if (step === 4) {
    for (let i = 1; i <= 3; i++) {
      const stepErrors = validateStep(i, formData);
      Object.assign(errors, stepErrors);
    }
    return errors;
  }

  // Validate each field in the step
  Object.entries(stepRules).forEach(([fieldName, rule]) => {
    const value = getNestedValue(formData, fieldName);
    const error = validateField(fieldName, value, rule, formData);

    if (error) {
      errors[fieldName] = error;
    }
  });

  return errors;
}

/**
 * Validate entire form
 */
export function validateForm(formData: AdCreativeFormData): FormErrors {
  return validateStep(4, formData);
}

/**
 * Check if a step is complete (has all required fields filled)
 */
export function isStepComplete(step: number, formData: AdCreativeFormData): boolean {
  const errors = validateStep(step, formData);
  return Object.keys(errors).length === 0;
}

/**
 * Get step titles and descriptions
 */
export const STEP_INFO = [
  {
    number: 1,
    title: 'Prompt Input',
    description: 'Describe your video concept in detail',
  },
  {
    number: 2,
    title: 'Brand Settings',
    description: 'Configure your brand identity',
  },
  {
    number: 3,
    title: 'Video Parameters',
    description: 'Choose duration, format, and style',
  },
  {
    number: 4,
    title: 'Review & Submit',
    description: 'Review your settings and create video',
  },
] as const;
