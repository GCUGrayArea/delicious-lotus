/**
 * Form Types for Ad Creative Generation
 */

import type { UploadedAsset as AssetUploaderAsset } from '@/hooks/ad-generator/useFileUpload';

export type UploadedAsset = AssetUploaderAsset;

export interface AdCreativeFormData {
  // Step 1: Prompt
  prompt: string;

  // Step 2: Brand Settings
  brandName: string;
  brandLogo: UploadedAsset | null;
  brandColors: {
    primary: string;
    secondary: string;
  };
  includeCta: boolean;
  ctaText: string;

  // Step 3: Video Parameters
  duration: 15 | 30 | 45 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1';
  style: VideoStyle;
  musicStyle: MusicStyle;
  
  // Step 4: Generation Options
  parallelizeGenerations: boolean;
}

export type VideoStyle =
  | 'professional'
  | 'casual'
  | 'modern'
  | 'luxury'
  | 'minimal'
  | 'energetic'
  | 'elegant';

export type MusicStyle =
  | 'corporate'
  | 'upbeat'
  | 'cinematic'
  | 'ambient'
  | 'electronic'
  | 'none';

export interface FormStep {
  number: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  isComplete: boolean;
  isValid: boolean;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: (string | number)[];
  custom?: (value: unknown, formData: AdCreativeFormData) => boolean;
  message: string;
}

export type ValidationRules = {
  [key: string]: ValidationRule;
};

export interface FormErrors {
  [key: string]: string;
}

export interface FormDraft {
  data: AdCreativeFormData;
  currentStep: 1 | 2 | 3 | 4;
  timestamp: number;
  version: string;
}
