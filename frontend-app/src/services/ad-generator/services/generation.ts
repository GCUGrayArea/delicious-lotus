/**
 * Generation Service
 * API calls for video generation operations
 */

import { get, post, del } from '@/services/ad-generator/client';
import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  GetGenerationResponse,
  ListGenerationsResponse,
  CancelGenerationResponse,
  GetAssetsResponse,
  PaginationParams,
  VideoPromptRequest,
  VideoPromptResponse,
} from '@/services/ad-generator/types';

export interface DeleteGenerationResponse {
  generation_id: string;
  message: string;
}

/**
 * Submit a new video generation request
 */
export const createGeneration = async (
  request: CreateGenerationRequest
): Promise<CreateGenerationResponse> => {
  return post<CreateGenerationResponse, CreateGenerationRequest>(
    '/v1/generations',
    request
  );
};

/**
 * Get generation status and progress
 */
export const getGeneration = async (
  generationId: string
): Promise<GetGenerationResponse> => {
  return get<GetGenerationResponse>(`/v1/generations/${generationId}`);
};

/**
 * List user's generations with pagination
 */
export const listGenerations = async (
  params?: PaginationParams
): Promise<ListGenerationsResponse> => {
  const queryParams = new URLSearchParams();

  // Backend uses offset, but frontend may pass page - convert if needed
  if (params?.page && params?.limit) {
    const offset = (params.page - 1) * params.limit;
    queryParams.append('offset', offset.toString());
  } else if (params?.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  }
  
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.sort) {
    queryParams.append('sort', params.sort);
  }

  const url = `/v1/generations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return get<ListGenerationsResponse>(url);
};

/**
 * Cancel an in-progress generation
 */
export const cancelGeneration = async (
  generationId: string
): Promise<CancelGenerationResponse> => {
  return post<CancelGenerationResponse>(
    `/v1/generations/${generationId}/cancel`
  );
};

/**
 * Get generated assets (clips, audio, metadata)
 */
export const getGenerationAssets = async (
  generationId: string
): Promise<GetAssetsResponse> => {
  return get<GetAssetsResponse>(`/v1/generations/${generationId}/assets`);
};

/**
 * Delete a generation
 */
export const deleteGeneration = async (
  generationId: string
): Promise<DeleteGenerationResponse> => {
  return del<DeleteGenerationResponse>(`/v1/generations/${generationId}`);
};

/**
 * Generate structured video prompts (clip-level) via OpenAI
 */
export const generateVideoClipPrompts = async (
  request: VideoPromptRequest
): Promise<VideoPromptResponse> => {
  return post<VideoPromptResponse, VideoPromptRequest>(
    // Note: router is mounted under /prompts with its own /prompts prefix, so path repeats
    '/v1/prompts/prompts/generate-video-clips',
    request
  );
};

/**
 * Poll generation status until complete or failed
 * Returns a promise that resolves when generation is done
 */
export const pollGenerationStatus = async (
  generationId: string,
  onProgress?: (response: GetGenerationResponse) => void,
  intervalMs: number = 2000
): Promise<GetGenerationResponse> => {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await getGeneration(generationId);

        // Call progress callback if provided
        if (onProgress) {
          onProgress(response);
        }

        // Check if generation is complete
        if (response.status === 'completed') {
          resolve(response);
          return;
        }

        // Check if generation failed
        if (response.status === 'failed' || response.status === 'cancelled') {
          reject(
            new Error(`Generation ${response.status}: ${generationId}`)
          );
          return;
        }

        // Continue polling
        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};
