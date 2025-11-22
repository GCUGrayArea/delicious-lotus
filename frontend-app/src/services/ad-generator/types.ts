/**
 * API Type Definitions
 * TypeScript interfaces for all backend API requests and responses
 */

// ============================================================================
// Common Types
// ============================================================================

export type GenerationStatus =
  | 'queued'
  | 'processing'
  | 'composing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CompositionStatus = 'queued' | 'encoding' | 'completed' | 'failed';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    request_id: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  status?: GenerationStatus;
  sort?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ============================================================================
// Generation API Types
// ============================================================================

export interface BrandColorPalette {
  primary: string[];
  secondary?: string[];
  background?: string;
}

export interface BrandParameters {
  name: string;
  colors: BrandColorPalette;
  logo_url?: string;
}

export interface GenerationParameters {
  duration_seconds: 15 | 30 | 45 | 60;
  aspect_ratio: AspectRatio;
  style: string;
  brand?: BrandParameters;
  include_cta?: boolean;
  cta_text?: string;
  music_style?: string;
}

export interface GenerationOptions {
  quality?: 'low' | 'medium' | 'high';
  fast_generation?: boolean;
  parallelize_generations?: boolean;
}

export interface CreateGenerationRequest {
  prompt: string;
  parameters: GenerationParameters;
  options?: GenerationOptions;
}

export interface CreateGenerationResponse {
  generation_id: string;
  status: GenerationStatus;
  created_at: string;
  estimated_completion: string;
  websocket_url: string;
  prompt_analysis?: Record<string, unknown> | null;
  brand_config?: Record<string, unknown> | null;
  scenes?: Array<Record<string, unknown>> | null;
  micro_prompts?: Array<Record<string, unknown>> | null;
}

export interface ClipInfo {
  clip_id: string;
  thumbnail_url: string;
  duration: number;
  status: string;
  url?: string;
}

export interface GenerationProgress {
  current_step: string;
  steps_completed: number;
  total_steps: number;
  percentage: number;
  current_clip?: number;
  total_clips?: number;
}

export interface GenerationMetadata {
  prompt: string;
  parameters: GenerationParameters;
  created_at: string;
  updated_at: string;
}

export interface GetGenerationResponse {
  generation_id: string;
  status: GenerationStatus;
  progress: GenerationProgress;
  metadata: GenerationMetadata;
  clips_generated: ClipInfo[];
}

export interface GenerationListItem {
  generation_id: string;
  status: GenerationStatus;
  prompt: string;
  thumbnail_url?: string;
  created_at: string;
  duration_seconds: number;
}

export interface ListGenerationsResponse {
  generations: GenerationListItem[];
  pagination: PaginationMeta;
}

export interface CancelGenerationResponse {
  generation_id: string;
  status: GenerationStatus;
  message: string;
}

export interface AudioAsset {
  url: string;
  duration: number;
  format: string;
}

export interface AssetMetadata {
  scene_descriptions?: string[];
  style_parameters?: Record<string, unknown>;
}

export interface GetAssetsResponse {
  generation_id: string;
  assets: {
    clips: ClipInfo[];
    audio?: AudioAsset;
    metadata?: AssetMetadata;
  };
}

// ============================================================================
// Prompt Generation Types
// ============================================================================

export interface VideoPromptRequest {
  prompt: string;
  num_clips?: number;
  clip_length?: number;
}

export interface VideoPromptClip {
  video_prompt: string;
  image_prompt: string;
  length: number;
}

export interface VideoPromptResponse {
  success: string;
  content: VideoPromptClip[];
}

// ============================================================================
// Composition API Types
// ============================================================================

export interface ClipConfig {
  clip_id: string;
  url: string;
  start_time: number;
  end_time: number;
  transition_in?: string;
  transition_out?: string;
}

export interface AudioConfig {
  url: string;
  volume?: number;
  fade_in?: number;
  fade_out?: number;
}

export interface TextOverlayStyle {
  font?: string;
  size?: number;
  color?: string;
}

export interface OverlayPosition {
  x: number;
  y: number;
}

export interface TextOverlay {
  type: 'text';
  content: string;
  position: OverlayPosition;
  start_time: number;
  duration: number;
  style?: TextOverlayStyle;
}

export interface OutputConfig {
  format?: string;
  resolution?: string;
  fps?: number;
  codec?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface CreateCompositionRequest {
  generation_id: string;
  clips: ClipConfig[];
  audio?: AudioConfig;
  overlays?: TextOverlay[];
  output?: OutputConfig;
}

export interface CreateCompositionResponse {
  composition_id: string;
  status: CompositionStatus;
  estimated_duration: number;
  websocket_url: string;
}

export interface CompositionProgress {
  percentage: number;
  frames_processed: number;
  total_frames: number;
  current_pass: number;
  total_passes: number;
}

export interface CompositionOutput {
  url: string | null;
  size_bytes: number | null;
  duration: number;
}

export interface GetCompositionResponse {
  composition_id: string;
  status: CompositionStatus;
  progress: CompositionProgress;
  output: CompositionOutput;
}

export interface CompositionFileInfo {
  size_bytes: number;
  duration_seconds: number;
  resolution: string;
  fps: number;
  codec: string;
  bitrate: string;
}

export interface ProcessingStats {
  start_time: string;
  end_time: string;
  total_seconds: number;
}

export interface GetCompositionMetadataResponse {
  composition_id: string;
  file_info: CompositionFileInfo;
  timeline: unknown[];
  processing_stats: ProcessingStats;
}

export interface EditCompositionRequest {
  instructions: string;
  apply_immediately?: boolean;
}

export interface EditCompositionResponse {
  composition_id: string;
  status: CompositionStatus;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type WebSocketMessageType =
  | 'subscribe'
  | 'progress'
  | 'clip_completed'
  | 'status_change'
  | 'completed'
  | 'error'
  | 'encoding_progress';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  data?: T;
  generation_id?: string;
}

export interface ProgressUpdateData {
  step: string;
  clip_number?: number;
  total_clips?: number;
  percentage: number;
  message: string;
}

export interface ClipCompletedData {
  clip_id: string;
  thumbnail_url: string;
  duration: number;
}

export interface StatusChangeData {
  old_status: GenerationStatus | CompositionStatus;
  new_status: GenerationStatus | CompositionStatus;
  message: string;
}

export interface CompletedData {
  video_url: string;
  thumbnail_url: string;
  duration: number;
}

export interface ErrorData {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface EncodingProgressData {
  percentage: number;
  frames_processed: number;
  total_frames: number;
  estimated_remaining: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
}

export interface ServiceStatus {
  database: string;
  redis: string;
  replicate: string;
  storage: string;
}

export interface HealthMetrics {
  active_generations: number;
  queue_depth: number;
  average_generation_time: number;
}

export interface DetailedHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: ServiceStatus;
  metrics: HealthMetrics;
}
