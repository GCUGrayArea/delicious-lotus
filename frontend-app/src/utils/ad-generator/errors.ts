/**
 * Error Handling Utilities
 * User-friendly error messages and error classification
 */

import type { ErrorResponse } from '@/services/ad-generator/types';

/**
 * API Error class with structured error information
 */
export class ApiError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, unknown>;
  public requestId?: string;
  public timestamp?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    requestId?: string,
    timestamp?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.timestamp = timestamp;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (typeof (Error as typeof Error & { captureStackTrace?: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace === 'function') {
      (Error as typeof Error & { captureStackTrace: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if error is a client error (4xx)
   */
  public isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  public isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }

  /**
   * Check if error is retryable
   */
  public isRetryable(): boolean {
    // Server errors and specific client errors are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(this.statusCode);
  }
}

/**
 * Network Error class for connectivity issues
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';

    if (typeof (Error as typeof Error & { captureStackTrace?: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace === 'function') {
      (Error as typeof Error & { captureStackTrace: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace(this, NetworkError);
    }
  }
}

/**
 * Timeout Error class for request timeouts
 */
export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';

    if (typeof (Error as typeof Error & { captureStackTrace?: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace === 'function') {
      (Error as typeof Error & { captureStackTrace: (target: object, constructor: new (...args: unknown[]) => Error) => void }).captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Client Errors (4xx)
  INVALID_PROMPT:
    'Your prompt is invalid. Please check the length and content.',
  INVALID_PARAMETERS:
    'One or more generation parameters are invalid. Please review your settings.',
  GENERATION_NOT_FOUND:
    'The requested generation could not be found. It may have been deleted.',
  COMPOSITION_NOT_FOUND:
    'The requested composition could not be found. It may have been deleted.',
  RATE_LIMIT_EXCEEDED:
    'You have made too many requests. Please wait a moment and try again.',
  INSUFFICIENT_CREDITS:
    'You do not have enough credits to complete this action.',

  // Server Errors (5xx)
  REPLICATE_API_ERROR:
    'There was an error with the AI generation service. Please try again later.',
  PROCESSING_FAILED:
    'Video processing failed. Please try generating again or contact support.',
  DATABASE_ERROR:
    'A database error occurred. Please try again or contact support.',
  STORAGE_ERROR:
    'There was an error accessing storage. Please try again later.',
  QUEUE_ERROR:
    'There was an error with the job queue. Please try again later.',

  // Network Errors
  NETWORK_ERROR:
    'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',

  // Generic
  UNKNOWN_ERROR:
    'An unexpected error occurred. Please try again or contact support.',
};

/**
 * Get user-friendly error message from error code
 */
export const getUserFriendlyMessage = (code: string): string => {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Parse error response from API
 */
export const parseApiError = (error: unknown): ApiError => {
  // If it's already an ApiError, return it
  if (error instanceof ApiError) {
    return error;
  }

  // If it's an axios error with response
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const response = error.response as {
      status: number;
      data: ErrorResponse;
    };

    if (response.data?.error) {
      const { code, message, details, timestamp, request_id } =
        response.data.error;
      return new ApiError(
        message,
        code,
        response.status,
        details,
        request_id,
        timestamp
      );
    }
  }

  // If it's a network error
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_NETWORK'
  ) {
    throw new NetworkError();
  }

  // If it's a timeout error
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ECONNABORTED'
  ) {
    throw new TimeoutError();
  }

  // Generic error
  const message =
    error instanceof Error ? error.message : 'An unknown error occurred';
  return new ApiError(message, 'UNKNOWN_ERROR', 500);
};

/**
 * Get error message for display to user
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return getUserFriendlyMessage(error.code);
  }

  if (error instanceof NetworkError) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (error instanceof TimeoutError) {
    return ERROR_MESSAGES.TIMEOUT_ERROR;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Log error for debugging (can be enhanced with error reporting service)
 */
export const logError = (error: unknown, context?: string): void => {
  if (error instanceof ApiError) {
    console.error('[API Error]', {
      context,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      requestId: error.requestId,
      timestamp: error.timestamp,
    });
  } else if (error instanceof Error) {
    console.error('[Error]', {
      context,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.error('[Unknown Error]', { context, error });
  }
};

/**
 * Check if error should trigger user notification
 */
export const shouldNotifyUser = (error: unknown): boolean => {
  // Don't notify for certain client errors
  const silentCodes = ['GENERATION_NOT_FOUND', 'COMPOSITION_NOT_FOUND'];

  if (error instanceof ApiError && silentCodes.includes(error.code)) {
    return false;
  }

  return true;
};

/**
 * Get retry recommendation based on error
 */
export const shouldRetry = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return error.isRetryable();
  }

  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  return false;
};
