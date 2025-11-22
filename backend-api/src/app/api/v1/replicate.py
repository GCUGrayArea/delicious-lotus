"""Replicate API endpoints for AI generation with async job tracking."""

import asyncio
import json
import logging
import os
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
from workers.redis_pool import get_redis_connection

from ..schemas.replicate import (
    AsyncJobResponse,
    FluxSchnellRequest,
    Hailuo23FastRequest,
    KlingV25TurboProRequest,
    Lyria2Request,
    Music01Request,
    NanoBananaErrorResponse,
    NanoBananaRequest,
    NanoBananaResponse,
    ReplicateWebhookPayload,
    Seedance1ProFastRequest,
    StableAudio25Request,
    Veo31FastRequest,
    WanVideoI2VRequest,
    WanVideoT2VRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Replicate API Configuration
REPLICATE_WEBHOOK_SECRET = os.getenv("REPLICATE_WEBHOOK_SECRET", "")
REPLICATE_WEBHOOK_URL = os.getenv("REPLICATE_WEBHOOK_URL", "")  # e.g., "https://yourdomain.com/api/v1/replicate/webhook"


def extract_result_from_output(output: object | None) -> tuple[str | None, object | None]:
    """Extract a usable result URL from Replicate outputs and return the raw payload.

    Replicate can return strings, lists of strings, or lists/dicts for video payloads.
    We return both the first URL we can find and the normalized payload for clients
    that want to inspect the full output (e.g., for logging or debugging).
    """
    if output is None:
        return None, None

    # String output (most image models)
    if isinstance(output, str):
        return output, output

    # List output (video models sometimes return list of URLs or dicts)
    if isinstance(output, list):
        for item in output:
            url, _ = extract_result_from_output(item)
            if url:
                return url, output
        # No URL found, but return payload for debugging
        return None, output

    # Dict output (some video models wrap URLs under keys like "video" or "url")
    if isinstance(output, dict):
        url_keys = ["url", "video", "mp4", "download_url"]
        for key in url_keys:
            value = output.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value, output
        # Check any string value in the dict
        for value in output.values():
            if isinstance(value, str) and value.startswith("http"):
                return value, output
        return None, output

    return None, None


def store_job_metadata(
    job_id: str,
    job_type: str,
    prompt: str,
    model: str,
    **extra_metadata
) -> None:
    """Store job metadata in Redis for tracking.

    Args:
        job_id: Replicate prediction ID
        job_type: Type of generation (image, video, etc.)
        prompt: User prompt
        model: Replicate model identifier
        **extra_metadata: Additional metadata to store
    """
    try:
        redis_conn = get_redis_connection()

        job_data = {
            "job_id": job_id,
            "job_type": job_type,
            "prompt": prompt,
            "model": model,
            "status": "queued",
            "created_at": datetime.now(UTC).isoformat(),
            **extra_metadata
        }

        # Store with 24-hour expiration
        redis_key = f"ai_job:{job_id}"
        redis_conn.setex(redis_key, 86400, json.dumps(job_data))

        logger.info(f"Stored job metadata for {job_id}", extra={"job_type": job_type})

    except Exception as e:
        logger.error(f"Failed to store job metadata: {e}", exc_info=True)


def publish_job_update(
    job_id: str,
    status_value: str,
    progress: int | None = None,
    result_url: str | None = None,
    result_output: object | None = None,
    error: str | None = None
) -> None:
    """Publish job update to Redis pub/sub for WebSocket delivery.

    Args:
        job_id: Job identifier
        status_value: Job status (queued, running, succeeded, failed, canceled)
        progress: Optional progress percentage (0-100)
        result_url: Optional result URL when completed
        result_output: Optional raw output payload from the provider
        error: Optional error message
    """
    try:
        redis_conn = get_redis_connection()

        # Map Replicate statuses to our job statuses
        status_map = {
            "starting": "queued",
            "processing": "running",
            "succeeded": "succeeded",
            "failed": "failed",
            "canceled": "canceled"
        }

        mapped_status = status_map.get(status_value, status_value)

        message = {
            "event": f"job.{mapped_status}",
            "jobId": job_id,
            "jobType": "ai_generation",
            "status": mapped_status,
            "progress": progress,
            "message": f"Job {mapped_status}",
            "timestamp": datetime.now(UTC).isoformat()
        }

        if result_url or result_output is not None:
            result_payload: dict[str, object] = {}
            if result_url:
                result_payload["url"] = result_url
            if result_output is not None:
                result_payload["output"] = result_output
            message["result"] = result_payload

        if error:
            message["error"] = error

        # Publish to job-specific channel
        channel = f"job:progress:{job_id}"
        redis_conn.publish(channel, json.dumps(message))

        # Also publish to general AI jobs channel for monitoring
        redis_conn.publish("ai_jobs:updates", json.dumps(message))

        logger.info(f"Published job update for {job_id}: {mapped_status}")

    except Exception as e:
        logger.error(f"Failed to publish job update: {e}", exc_info=True)


@router.post(
    "/nano-banana",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate image with Nano-Banana model (Async)",
    description="Start async image generation using Google's Nano-Banana model via Replicate",
    responses={
        202: {
            "description": "Job created successfully",
            "model": AsyncJobResponse,
        },
        503: {
            "description": "Replicate API key not configured",
            "model": NanoBananaErrorResponse,
        },
    },
)
async def generate_nano_banana(request_body: NanoBananaRequest) -> JSONResponse:
    """Generate image using Nano-Banana model (async).

    Creates an async prediction job and returns immediately with a job ID.
    The client should use WebSocket or polling to track job progress.

    Args:
        request_body: Request containing prompt and optional image input

    Returns:
        AsyncJobResponse: Response with job ID for tracking

    Raises:
        HTTPException: If API key is not configured or job creation fails
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured. Please set REPLICATE_API_TOKEN environment variable.",
                    "status": "error",
                },
            )

        # Import Replicate here to avoid import errors if package not installed
        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed. Please run: pip install replicate",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Nano-Banana async request",
            extra={
                "prompt": request_body.prompt,
                "has_image_input": request_body.image_input is not None,
                "image_count": len(request_body.image_input) if request_body.image_input else 0,
            },
        )

        # Set API token for replicate
        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for the model
        model_input = {
            "prompt": request_body.prompt,
        }

        # Add image input if provided
        if request_body.image_input:
            model_input["image_input"] = [str(url) for url in request_body.image_input]

        # Create async prediction with webhook
        try:
            prediction = replicate.predictions.create(
                model="google/nano-banana",
                input=model_input,
                webhook=REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            # Store job metadata in Redis
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="google/nano-banana",
                generation_type="image"
            )

            # Publish initial job status
            publish_job_update(job_id, "starting")

            logger.info(
                "Nano-Banana async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "status": prediction.status
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Image generation started"
                },
            )

        except Exception as e:
            logger.exception(
                "Replicate API call failed",
                extra={
                    "error": str(e),
                    "prompt": request_body.prompt,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start image generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception(
            "Unexpected error in Nano-Banana endpoint",
            extra={"error": str(e)},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )



@router.post(
    "/flux-schnell",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate image with Flux Schnell model (Async)",
    description="Start async image generation using Black Forest Labs Flux Schnell model via Replicate",
)
async def generate_flux_schnell(request_body: FluxSchnellRequest) -> JSONResponse:
    """Generate image using Flux Schnell model (async).

    Creates an async prediction job and returns immediately with a job ID.

    Args:
        request_body: Request containing prompt and generation parameters

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Flux Schnell async request",
            extra={
                "prompt": request_body.prompt,
                "aspect_ratio": request_body.aspect_ratio,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Flux Schnell
        model_input = {
            "prompt": request_body.prompt,
            "aspect_ratio": request_body.aspect_ratio,
            "output_format": request_body.output_format,
            "output_quality": request_body.output_quality,
            "disable_safety_checker": request_body.disable_safety_checker,
            "go_fast": True,
            "megapixels": "1",
            "num_outputs": 1,
        }

        if request_body.seed is not None:
            model_input["seed"] = request_body.seed

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "black-forest-labs/flux-schnell",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using Flux Schnell model
            prediction = replicate.predictions.create(
                model="black-forest-labs/flux-schnell",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="black-forest-labs/flux-schnell",
                generation_type="image"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Flux Schnell async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Image generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start image generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Flux Schnell endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/wan-video-i2v",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Wan Video I2V model (Async)",
    description="Start async video generation using Wan Video 2.2 I2V Fast model via Replicate",
)
async def generate_wan_video_i2v(request_body: WanVideoI2VRequest) -> JSONResponse:
    """Generate video using Wan Video I2V model (async).

    Creates an async prediction job and returns immediately with a job ID.

    Args:
        request_body: Request containing prompt and optional image input

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Wan Video async request",
            extra={
                "prompt": request_body.prompt,
                "has_image": True,
                "has_audio": request_body.audio is not None,
                "resolution": request_body.resolution,
                "duration": request_body.duration,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Wan Video 2.5 I2V
        model_input = {
            "prompt": request_body.prompt,
            "image": str(request_body.image),
            "resolution": request_body.resolution,
            "duration": request_body.duration,
            "negative_prompt": request_body.negative_prompt,
            "enable_prompt_expansion": request_body.enable_prompt_expansion,
        }

        # Add optional audio input
        if request_body.audio:
            model_input["audio"] = str(request_body.audio)

        # Create async prediction
        try:
            # Using Wan Video 2.5 I2V model
            prediction = replicate.predictions.create(
                model="wan-video/wan-2.5-i2v",
                input=model_input,
                webhook=REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="wan-video/wan-2.5-i2v",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Wan Video async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Wan Video endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/wan-video-t2v",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Wan Video 2.5 T2V model (Async)",
    description="Start async text-to-video generation using Wan Video 2.5 T2V model via Replicate",
)
async def generate_wan_video_t2v(request_body: WanVideoT2VRequest) -> JSONResponse:
    """Generate video using Wan Video 2.5 T2V model (async text-to-video).

    Creates an async prediction job and returns immediately with a job ID.
    This is a text-to-video model that generates videos from prompts only.

    Args:
        request_body: Request containing prompt, size, and duration

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Wan Video 2.5 T2V async request",
            extra={
                "prompt": request_body.prompt,
                "size": request_body.size,
                "duration": request_body.duration,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input with defaults for Wan Video 2.5 T2V
        model_input = {
            "prompt": request_body.prompt,
            "size": request_body.size,
            "duration": request_body.duration,
            "negative_prompt": "",
            "enable_prompt_expansion": True,
        }

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "wan-video/wan-2.5-t2v",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using Wan Video 2.5 T2V model
            prediction = replicate.predictions.create(
                model="wan-video/wan-2.5-t2v",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="wan-video/wan-2.5-t2v",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Wan Video 2.5 T2V async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "size": request_body.size,
                    "duration": request_body.duration,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Wan Video 2.5 T2V endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/seedance-1-pro-fast",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Seedance-1-Pro-Fast model (Async)",
    description="Start async video generation using Seedance-1-Pro-Fast model via Replicate",
)
async def generate_seedance_1_pro_fast(request_body: Seedance1ProFastRequest) -> JSONResponse:
    """Generate video using Seedance-1-Pro-Fast model (async).

    Creates an async prediction job and returns immediately with a job ID.
    Supports both text-to-video and image-to-video generation.

    Args:
        request_body: Request containing prompt and optional image input

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Seedance-1-Pro-Fast async request",
            extra={
                "prompt": request_body.prompt,
                "has_image": request_body.image is not None,
                "duration": request_body.duration,
                "resolution": request_body.resolution,
                "aspect_ratio": request_body.aspect_ratio,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Seedance-1-Pro-Fast
        model_input = {
            "prompt": request_body.prompt,
            "duration": request_body.duration,
            "resolution": request_body.resolution,
            "aspect_ratio": request_body.aspect_ratio,
            "fps": request_body.fps,
            "camera_fixed": request_body.camera_fixed,
        }

        # Add optional parameters
        if request_body.image:
            model_input["image"] = str(request_body.image)

        if request_body.seed is not None:
            model_input["seed"] = request_body.seed

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "bytedance/seedance-1-pro-fast",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using Seedance-1-Pro-Fast model
            prediction = replicate.predictions.create(
                model="bytedance/seedance-1-pro-fast",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="bytedance/seedance-1-pro-fast",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Seedance-1-Pro-Fast async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "duration": request_body.duration,
                    "resolution": request_body.resolution,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Seedance-1-Pro-Fast endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/veo-3.1-fast",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Google Veo 3.1 Fast model (Async)",
    description="Start async video generation using Google Veo 3.1 Fast model via Replicate",
)
async def generate_veo_31_fast(request_body: Veo31FastRequest) -> JSONResponse:
    """Generate video using Google Veo 3.1 Fast model (async).

    Creates an async prediction job and returns immediately with a job ID.
    Supports text-to-video, image-to-video, and video interpolation.

    Args:
        request_body: Request containing prompt and optional image inputs

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Veo 3.1 Fast async request",
            extra={
                "prompt": request_body.prompt,
                "has_image": request_body.image is not None,
                "has_last_frame": request_body.last_frame is not None,
                "duration": request_body.duration,
                "resolution": request_body.resolution,
                "aspect_ratio": request_body.aspect_ratio,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Veo 3.1 Fast
        model_input = {
            "prompt": request_body.prompt,
            "aspect_ratio": request_body.aspect_ratio,
            "duration": request_body.duration,
            "resolution": request_body.resolution,
            "generate_audio": request_body.generate_audio,
        }

        # Add optional parameters
        if request_body.image:
            model_input["image"] = str(request_body.image)

        if request_body.last_frame:
            model_input["last_frame"] = str(request_body.last_frame)

        if request_body.negative_prompt:
            model_input["negative_prompt"] = request_body.negative_prompt

        if request_body.seed is not None:
            model_input["seed"] = request_body.seed

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "google/veo-3.1-fast",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using Google Veo 3.1 Fast model
            prediction = replicate.predictions.create(
                model="google/veo-3.1-fast",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="google/veo-3.1-fast",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Veo 3.1 Fast async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "duration": request_body.duration,
                    "resolution": request_body.resolution,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Veo 3.1 Fast endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/hailuo-2.3-fast",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with MiniMax Hailuo 2.3 Fast model (Async)",
    description="Start async video generation using MiniMax Hailuo 2.3 Fast model via Replicate",
)
async def generate_hailuo_23_fast(request_body: Hailuo23FastRequest) -> JSONResponse:
    """Generate video using MiniMax Hailuo 2.3 Fast model (async).

    Creates an async prediction job and returns immediately with a job ID.
    Requires a first frame image - the output video will have the same aspect ratio.

    Args:
        request_body: Request containing prompt and first frame image

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Hailuo 2.3 Fast async request",
            extra={
                "prompt": request_body.prompt,
                "first_frame_image": str(request_body.first_frame_image),
                "duration": request_body.duration,
                "resolution": request_body.resolution,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Hailuo 2.3 Fast
        model_input = {
            "prompt": request_body.prompt,
            "first_frame_image": str(request_body.first_frame_image),
            "duration": request_body.duration,
            "resolution": request_body.resolution,
            "prompt_optimizer": request_body.prompt_optimizer,
        }

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "minimax/hailuo-2.3-fast",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using MiniMax Hailuo 2.3 Fast model
            prediction = replicate.predictions.create(
                model="minimax/hailuo-2.3-fast",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="minimax/hailuo-2.3-fast",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Hailuo 2.3 Fast async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "duration": request_body.duration,
                    "resolution": request_body.resolution,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Hailuo 2.3 Fast endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/kling-v2.5-turbo-pro",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate video with Kling v2.5 Turbo Pro model (Async)",
    description="Start async video generation using Kuaishou Kling v2.5 Turbo Pro model via Replicate",
)
async def generate_kling_v25_turbo_pro(request_body: KlingV25TurboProRequest) -> JSONResponse:
    """Generate video using Kling v2.5 Turbo Pro model (async).

    Creates an async prediction job and returns immediately with a job ID.
    Supports text-to-video and image-to-video generation.

    Args:
        request_body: Request containing prompt and optional start image

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        # Check if Replicate API key is configured
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Kling v2.5 Turbo Pro async request",
            extra={
                "prompt": request_body.prompt,
                "has_start_image": request_body.start_image is not None,
                "duration": request_body.duration,
                "aspect_ratio": request_body.aspect_ratio,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Kling v2.5 Turbo Pro
        model_input = {
            "prompt": request_body.prompt,
            "aspect_ratio": request_body.aspect_ratio,
            "duration": request_body.duration,
            "negative_prompt": request_body.negative_prompt,
        }

        # Add optional start image
        if request_body.start_image:
            model_input["start_image"] = str(request_body.start_image)

        # Create async prediction
        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "kwaivgi/kling-v2.5-turbo-pro",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            # Using Kling v2.5 Turbo Pro model
            prediction = replicate.predictions.create(
                model="kwaivgi/kling-v2.5-turbo-pro",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            # Store job metadata
            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="kwaivgi/kling-v2.5-turbo-pro",
                generation_type="video"
            )

            # Publish initial status
            publish_job_update(job_id, "starting")

            logger.info(
                "Kling v2.5 Turbo Pro async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "duration": request_body.duration,
                    "aspect_ratio": request_body.aspect_ratio,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Video generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start video generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Kling v2.5 Turbo Pro endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


# ============================================================================
# Audio Generation Endpoints
# ============================================================================


@router.post(
    "/lyria-2",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate audio with Google Lyria 2 model (Async)",
    description="Start async audio generation using Google Lyria 2 model via Replicate",
)
async def generate_lyria_2(request_body: Lyria2Request) -> JSONResponse:
    """Generate audio using Google Lyria 2 model (async).

    Creates an async prediction job and returns immediately with a job ID.

    Args:
        request_body: Request containing prompt and optional parameters

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Lyria 2 async request",
            extra={
                "prompt": request_body.prompt,
                "has_negative_prompt": request_body.negative_prompt is not None,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Lyria 2
        model_input = {
            "prompt": request_body.prompt,
        }

        # Add optional parameters
        if request_body.negative_prompt:
            model_input["negative_prompt"] = request_body.negative_prompt

        if request_body.seed is not None:
            model_input["seed"] = request_body.seed

        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "google/lyria-2",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            prediction = replicate.predictions.create(
                model="google/lyria-2",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="google/lyria-2",
                generation_type="audio"
            )

            publish_job_update(job_id, "starting")

            logger.info(
                "Lyria 2 async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Audio generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start audio generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Lyria 2 endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/music-01",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate music with MiniMax Music-01 model (Async)",
    description="Start async music generation using MiniMax Music-01 model via Replicate",
)
async def generate_music_01(request_body: Music01Request) -> JSONResponse:
    """Generate music using MiniMax Music-01 model (async).

    Creates an async prediction job and returns immediately with a job ID.
    Supports lyrics, voice references, and instrumental references.

    Args:
        request_body: Request containing lyrics and optional reference files

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Music-01 async request",
            extra={
                "has_lyrics": bool(request_body.lyrics),
                "has_voice_file": request_body.voice_file is not None,
                "has_song_file": request_body.song_file is not None,
                "has_instrumental_file": request_body.instrumental_file is not None,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Music-01
        model_input = {
            "lyrics": request_body.lyrics,
            "sample_rate": request_body.sample_rate,
            "bitrate": request_body.bitrate,
        }

        # Add optional parameters
        if request_body.voice_id:
            model_input["voice_id"] = request_body.voice_id

        if request_body.voice_file:
            model_input["voice_file"] = str(request_body.voice_file)

        if request_body.song_file:
            model_input["song_file"] = str(request_body.song_file)

        if request_body.instrumental_id:
            model_input["instrumental_id"] = request_body.instrumental_id

        if request_body.instrumental_file:
            model_input["instrumental_file"] = str(request_body.instrumental_file)

        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "minimax/music-01",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            prediction = replicate.predictions.create(
                model="minimax/music-01",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.lyrics or "music generation",
                model="minimax/music-01",
                generation_type="audio"
            )

            publish_job_update(job_id, "starting")

            logger.info(
                "Music-01 async job created",
                extra={
                    "job_id": job_id,
                    "has_lyrics": bool(request_body.lyrics),
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Music generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start music generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Music-01 endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.post(
    "/stable-audio-2.5",
    response_model=AsyncJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate audio with Stable Audio 2.5 model (Async)",
    description="Start async audio generation using Stability AI Stable Audio 2.5 model via Replicate",
)
async def generate_stable_audio_25(request_body: StableAudio25Request) -> JSONResponse:
    """Generate audio using Stability AI Stable Audio 2.5 model (async).

    Creates an async prediction job and returns immediately with a job ID.

    Args:
        request_body: Request containing prompt and generation parameters

    Returns:
        AsyncJobResponse: Response with job ID for tracking
    """
    try:
        replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
        if not replicate_api_key:
            logger.error("REPLICATE_API_TOKEN environment variable not set")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "Replicate API key not configured.",
                    "status": "error",
                },
            )

        try:
            import replicate
        except ImportError as e:
            logger.error(f"Failed to import Replicate package: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Replicate package not installed.",
                    "status": "error",
                },
            )

        logger.info(
            "Processing Stable Audio 2.5 async request",
            extra={
                "prompt": request_body.prompt,
                "duration": request_body.duration,
                "steps": request_body.steps,
                "cfg_scale": request_body.cfg_scale,
            },
        )

        os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

        # Prepare input for Stable Audio 2.5
        model_input = {
            "prompt": request_body.prompt,
            "duration": request_body.duration,
            "steps": request_body.steps,
            "cfg_scale": request_body.cfg_scale,
        }

        # Add optional seed
        if request_body.seed is not None:
            model_input["seed"] = request_body.seed

        try:
            webhook_url = REPLICATE_WEBHOOK_URL if REPLICATE_WEBHOOK_URL else None

            logger.info(
                "Creating Replicate prediction",
                extra={
                    "model": "stability-ai/stable-audio-2.5",
                    "webhook_url": webhook_url,
                    "webhook_configured": bool(webhook_url),
                },
            )

            prediction = replicate.predictions.create(
                model="stability-ai/stable-audio-2.5",
                input=model_input,
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            job_id = prediction.id

            logger.info(
                "Replicate prediction created successfully",
                extra={
                    "job_id": job_id,
                    "prediction_status": prediction.status,
                    "webhook_registered": bool(webhook_url),
                },
            )

            store_job_metadata(
                job_id=job_id,
                job_type="ai_generation",
                prompt=request_body.prompt,
                model="stability-ai/stable-audio-2.5",
                generation_type="audio"
            )

            publish_job_update(job_id, "starting")

            logger.info(
                "Stable Audio 2.5 async job created",
                extra={
                    "job_id": job_id,
                    "prompt": request_body.prompt,
                    "duration": request_body.duration,
                },
            )

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "job_id": job_id,
                    "status": prediction.status,
                    "message": "Audio generation started"
                },
            )

        except Exception as e:
            logger.exception("Replicate API call failed", extra={"error": str(e)})
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": f"Failed to start audio generation: {str(e)}",
                    "status": "error",
                },
            )

    except Exception as e:
        logger.exception("Unexpected error in Stable Audio 2.5 endpoint", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": f"Unexpected error: {str(e)}",
                "status": "error",
            },
        )


@router.get(
    "/jobs/{job_id}",
    status_code=status.HTTP_200_OK,
    summary="Get AI generation job status",
    description="Get status of an AI generation job (for polling fallback with auto-import)",
)
async def get_ai_job_status(
    job_id: str,
    auto_import: bool = True
) -> JSONResponse:
    """Get AI generation job status with automatic import on completion.

    Checks Redis cache first, then queries Replicate API if needed.
    When auto_import=True and job succeeds, automatically triggers media import.

    Args:
        job_id: Replicate prediction ID
        auto_import: Whether to automatically trigger import on success (default: True)

    Returns:
        JSONResponse with job status
    """
    try:
        redis_conn = get_redis_connection()
        redis_key = f"ai_job:{job_id}"

        # Try to get from Redis cache first
        job_data_str = redis_conn.get(redis_key)
        job_data = json.loads(job_data_str) if job_data_str else None

        # Default values from cache (if present)
        mapped_status = job_data.get("status", "processing") if job_data else "processing"
        result_url = job_data.get("result_url") if job_data else None
        output = job_data.get("output") if job_data else None
        error = job_data.get("error") if job_data else None

        # Refresh from Replicate when cache is stale (non-terminal) or missing result URL
        should_refresh = (
            job_data is None
            or mapped_status not in {"succeeded", "failed", "canceled"}
            or (mapped_status == "succeeded" and not result_url)
        )

        if should_refresh:
            replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
            if not replicate_api_key:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"error": "Job not found"}
                )

            try:
                import replicate
                os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

                prediction = replicate.predictions.get(job_id)

                # Map Replicate status to our format
                status_map = {
                    "starting": "processing",
                    "processing": "processing",
                    "succeeded": "succeeded",
                    "failed": "failed",
                    "canceled": "canceled"
                }

                mapped_status = status_map.get(prediction.status, prediction.status)
                result_url, normalized_output = extract_result_from_output(prediction.output)
                output = normalized_output or prediction.output
                error = prediction.error

                # Merge with existing metadata so we keep prompt/model info
                job_data = {
                    **(job_data or {}),
                    "job_id": job_id,
                    "status": mapped_status,
                    "result_url": result_url,
                    "output": output,
                    "error": error,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
                redis_conn.setex(redis_key, 86400, json.dumps(job_data))

            except Exception as e:
                logger.error(f"Failed to get job from Replicate: {e}")
                # If we have cached data, return it instead of a hard 404
                if job_data:
                    mapped_status = job_data.get("status", "processing")
                    result_url = job_data.get("result_url")
                    output = job_data.get("output")
                    error = job_data.get("error")
                else:
                    return JSONResponse(
                        status_code=status.HTTP_404_NOT_FOUND,
                        content={"error": "Job not found"}
                    )

        # Auto-import on first completion detection (polling fallback)
        if auto_import and mapped_status == "succeeded" and result_url:
            import_key = f"imported:{job_id}"

            # Check if already imported (deduplication)
            if not redis_conn.exists(import_key):
                logger.info(
                    f"Polling detected completion for {job_id}, triggering auto-import",
                    extra={"job_id": job_id, "result_url": result_url}
                )

                try:
                    from workers.job_queue import enqueue_video_import
                    import uuid

                    # Get metadata from job data or use defaults
                    generation_type = job_data.get("generation_type", "video") if job_data else "video"
                    prompt = job_data.get("prompt", "") if job_data else ""
                    model = job_data.get("model", "unknown") if job_data else "unknown"

                    # Only trigger for video generation (skip images for now)
                    if generation_type == "video":
                        asset_id = str(uuid.uuid4())
                        user_id = "00000000-0000-0000-0000-000000000001"  # TODO: Get from job metadata
                        filename = f"AI_Video_{job_id[:8]}.mp4"

                        # Enqueue import job
                        import_job = enqueue_video_import(
                            url=result_url,
                            name=filename,
                            user_id=user_id,
                            asset_id=asset_id,
                            metadata={
                                "aiGenerated": True,
                                "prompt": prompt,
                                "model": model,
                                "replicate_job_id": job_id,
                            }
                        )

                        # Mark as imported so we don't trigger again (24hr TTL)
                        redis_conn.setex(import_key, 86400, "1")

                        logger.info(
                            f"Auto-triggered video import from polling for {job_id}",
                            extra={
                                "job_id": job_id,
                                "import_job_id": import_job,
                                "asset_id": asset_id
                            }
                        )

                        # Update job data with asset_id for frontend reference
                        if job_data:
                            job_data["asset_id"] = asset_id
                            job_data["import_job_id"] = import_job
                            redis_conn.setex(redis_key, 86400, json.dumps(job_data))

                except Exception as e:
                    logger.error(
                        f"Failed to auto-trigger import from polling: {e}",
                        extra={"job_id": job_id, "result_url": result_url}
                    )
                    # Don't fail the polling request - just log the error

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": mapped_status,
                "result_url": result_url,
                "output": output,
                "error": error,
            }
        )

    except Exception as e:
        logger.exception(f"Error getting AI job status: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e)}
        )


async def generate_video_clips(
    scenes: list[dict],
    micro_prompts: list[str],
    generation_id: str,
    aspect_ratio: str = "16:9",
    parallelize: bool = False,
    webhook_base_url: str | None = None,
) -> list[dict]:
    """Generate video clips for multiple prompts/scenes using Replicate.

    Args:
        scenes: List of scene dictionaries (for metadata)
        micro_prompts: List of prompt strings
        generation_id: Unique ID for the generation batch
        aspect_ratio: Aspect ratio for the videos (e.g., "16:9")
        parallelize: Whether to run generations in parallel
        webhook_base_url: Base URL for webhooks

    Returns:
        list[dict]: List of video result objects with tracking info
    """
    import replicate
    
    # Configure Replicate API token
    replicate_api_key = os.getenv("REPLICATE_API_TOKEN")
    if not replicate_api_key:
        raise Exception("REPLICATE_API_TOKEN environment variable not set")
    os.environ["REPLICATE_API_TOKEN"] = replicate_api_key

    results = []
    
    async def _process_single_clip(prompt: str, index: int) -> dict:
        """Process a single clip generation."""
        clip_id = f"clip_{index+1}_{uuid.uuid4().hex[:8]}"
        scene_id = scenes[index].get("id") if index < len(scenes) else None
        
        try:
            # Construct webhook URL if base URL provided
            webhook_url = None
            if webhook_base_url:
                # Use the standard webhook endpoint
                webhook_url = f"{webhook_base_url}/api/v1/replicate/webhook"
            
            logger.info(f"Starting generation for clip {clip_id}", extra={"prompt": prompt[:50], "webhook": webhook_url})
            
            # Run blocking Replicate call in thread pool
            # Using Wan Video 2.5 T2V model as default
            prediction = await asyncio.to_thread(
                replicate.predictions.create,
                model="wan-video/wan-2.5-t2v",
                input={
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    # Default parameters from generate_wan_video_t2v
                    "size": "1280*720" if aspect_ratio == "16:9" else "720*1280",
                    "duration": 5,
                    "negative_prompt": "",
                    "enable_prompt_expansion": True
                },
                webhook=webhook_url,
                webhook_events_filter=["completed"]
            )

            # Store metadata for tracking
            store_job_metadata(
                job_id=prediction.id,
                job_type="ai_generation",
                prompt=prompt,
                model="wan-video/wan-2.5-t2v",
                generation_type="video",
                clip_id=clip_id,
                generation_id=generation_id,
                scene_id=scene_id,
                duration=5
            )
            
            return {
                "clip_id": clip_id,
                "prediction_id": prediction.id,
                "status": "queued",
                "status_url": f"https://replicate.com/p/{prediction.id}",
                "scene_id": scene_id
            }
            
        except Exception as e:
            logger.exception(f"Failed to generate clip {clip_id}: {e}")
            return {
                "clip_id": clip_id,
                "status": "failed",
                "error": str(e),
                "scene_id": scene_id
            }

    # Execute generations
    if parallelize:
        # Run all concurrently
        tasks = []
        for i, prompt in enumerate(micro_prompts):
            tasks.append(_process_single_clip(prompt, i))
        results = await asyncio.gather(*tasks)
    else:
        # Run sequentially
        for i, prompt in enumerate(micro_prompts):
            result = await _process_single_clip(prompt, i)
            results.append(result)
            
    return results


@router.post(
    "/generate-clips",
    status_code=status.HTTP_200_OK,
    summary="Generate video clips (Internal)",
    description="Internal endpoint to generate video clips from scenes and micro-prompts",
)
async def generate_clips(request: Request) -> JSONResponse:
    """Generate video clips from scenes and micro-prompts via Replicate."""
    try:
        payload = await request.json()
        generation_id = payload.get("generation_id")
        if not generation_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="generation_id is required",
            )

        scenes = payload.get("scenes", [])
        raw_micro_prompts = payload.get("micro_prompts", [])
        aspect_ratio = payload.get("aspect_ratio", "16:9")
        parallelize = bool(payload.get("parallelize", False))
        webhook_base_url = payload.get("webhook_base_url")

        # Normalize prompts into strings
        micro_prompts: list[str] = []
        for prompt in raw_micro_prompts:
            if isinstance(prompt, dict):
                micro_prompts.append(prompt.get("prompt_text") or prompt.get("prompt") or str(prompt))
            else:
                micro_prompts.append(str(prompt))

        logger.info(
            "Received generate-clips request",
            extra={
                "generation_id": generation_id,
                "scene_count": len(scenes),
                "micro_prompt_count": len(micro_prompts),
                "parallelize": parallelize,
                "aspect_ratio": aspect_ratio,
            },
        )

        video_results = await generate_video_clips(
            scenes=scenes,
            micro_prompts=micro_prompts,
            generation_id=generation_id,
            aspect_ratio=aspect_ratio,
            parallelize=parallelize,
            webhook_base_url=webhook_base_url,
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"video_results": video_results},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating clips: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e)},
        )


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Replicate webhook receiver",
    description="Receives status updates from Replicate for async predictions",
)
async def replicate_webhook(request: Request) -> JSONResponse:
    """Receive webhook callbacks from Replicate.

    When a prediction completes, Replicate sends a POST request to this endpoint.
    We then publish the result to Redis for WebSocket delivery and enqueue
    a background job to save videos to permanent S3 storage.

    Args:
        request: FastAPI request object containing webhook payload

    Returns:
        JSONResponse: Acknowledgment response
    """
    try:
        # Parse webhook payload
        payload_dict = await request.json()
        payload = ReplicateWebhookPayload(**payload_dict)

        logger.info(
            f"Received Replicate webhook for job {payload.id}",
            extra={
                "job_id": payload.id,
                "status": payload.status,
                "output_type": type(payload.output).__name__,
                "has_error": payload.error is not None,
            }
        )

        # Extract result URL and keep the raw output for downstream consumers
        result_url, normalized_output = extract_result_from_output(payload.output)

        logger.info(
            "Parsed Replicate webhook payload",
            extra={
                "job_id": payload.id,
                "status": payload.status,
                "result_url": result_url,
                "normalized_output_type": type(normalized_output).__name__,
            },
        )

        # Publish job update based on status
        if payload.status == "succeeded":
            publish_job_update(
                job_id=payload.id,
                status_value="succeeded",
                progress=100,
                result_url=result_url,
                result_output=normalized_output or payload.output
            )

            # Broadcast to generation WebSocket if applicable
            try:
                # Get job metadata to find generation_id
                redis_conn = get_redis_connection()
                redis_key = f"ai_job:{payload.id}"
                job_data_str = redis_conn.get(redis_key)
                
                if job_data_str:
                    job_data = json.loads(job_data_str)
                    generation_id = job_data.get("generation_id")
                    
                    if generation_id:
                        # Import here to avoid circular dependency
                        from fastapi_app.services.websocket_broadcast import broadcast_clip_completed
                        
                        internal_clip_id = job_data.get("clip_id", payload.id)
                        duration = job_data.get("duration", 5.0)
                        
                        await broadcast_clip_completed(
                            generation_id=generation_id,
                            clip_id=internal_clip_id,
                            thumbnail_url=result_url,
                            duration=float(duration)
                        )
                        logger.info(f"Broadcasted clip completion for generation {generation_id}, clip {internal_clip_id}")
            except Exception as e:
                logger.error(f"Failed to broadcast generation update: {e}")

            # Enqueue background job to save video to permanent S3 storage
            if result_url:
                try:
                    from workers.job_queue import enqueue_image_import, enqueue_video_import

                    # Get job metadata from Redis to determine generation type
                    redis_conn = get_redis_connection()
                    redis_key = f"ai_job:{payload.id}"
                    import_key = f"imported:{payload.id}"

                    # Check if already imported (deduplication for webhook vs polling)
                    if redis_conn.exists(import_key):
                        logger.info(
                            f"Job {payload.id} already imported, skipping duplicate webhook import",
                            extra={"job_id": payload.id}
                        )
                    else:
                        job_data_str = redis_conn.get(redis_key)

                        if job_data_str:
                            job_data = json.loads(job_data_str)
                            generation_type = job_data.get("generation_type", "image")
                            prompt = job_data.get("prompt", "")
                            model = job_data.get("model", "unknown")

                            # Generate asset ID and filename
                            import uuid
                            asset_id = str(uuid.uuid4())
                            user_id = "00000000-0000-0000-0000-000000000001"  # TODO: Get from job metadata

                            # Determine file extension and media type
                            if generation_type == "video":
                                file_ext = ".mp4"
                                filename = f"AI_Video_{payload.id[:8]}{file_ext}"
                            else:
                                file_ext = ".png"
                                filename = f"AI_Image_{payload.id[:8]}{file_ext}"

                            # Build metadata
                            metadata = {
                                "aiGenerated": True,
                                "prompt": prompt,
                                "model": model,
                                "replicate_job_id": payload.id,
                            }

                            # Enqueue appropriate import job
                            if generation_type == "video":
                                import_job_id = enqueue_video_import(
                                    url=result_url,
                                    name=filename,
                                    user_id=user_id,
                                    asset_id=asset_id,
                                    metadata=metadata,
                                )
                                logger.info(
                                    f"Enqueued video import job {import_job_id} for {payload.id}",
                                    extra={"asset_id": asset_id, "import_job_id": import_job_id},
                                )
                            else:
                                import_job_id = enqueue_image_import(
                                    url=result_url,
                                    name=filename,
                                    user_id=user_id,
                                    asset_id=asset_id,
                                    metadata=metadata,
                                )
                                logger.info(
                                    f"Enqueued image import job {import_job_id} for {payload.id}",
                                    extra={"asset_id": asset_id, "import_job_id": import_job_id},
                                )

                            # Mark as imported (deduplication)
                            redis_conn.setex(import_key, 86400, "1")

                            # Store asset_id in Redis job metadata for frontend reference
                            job_data["asset_id"] = asset_id
                            job_data["import_job_id"] = import_job_id
                            redis_conn.setex(redis_key, 86400, json.dumps(job_data))

                except Exception as e:
                    logger.error(
                        f"Failed to enqueue media import job: {e}",
                        extra={"job_id": payload.id, "result_url": result_url},
                    )
                    # Don't fail the webhook - continue processing

        elif payload.status == "failed":
            publish_job_update(
                job_id=payload.id,
                status_value="failed",
                error=payload.error or "Generation failed",
                result_output=normalized_output or payload.output
            )
        elif payload.status == "canceled":
            publish_job_update(
                job_id=payload.id,
                status_value="canceled",
                result_output=normalized_output or payload.output
            )

        # Update job metadata in Redis
        try:
            redis_conn = get_redis_connection()
            redis_key = f"ai_job:{payload.id}"

            job_data_str = redis_conn.get(redis_key)
            if job_data_str:
                job_data = json.loads(job_data_str)
                job_data["status"] = payload.status
                job_data["updated_at"] = datetime.now(UTC).isoformat()

                if result_url:
                    job_data["result_url"] = result_url
                if payload.error:
                    job_data["error"] = payload.error
                if normalized_output or payload.output:
                    job_data["output"] = normalized_output or payload.output

                redis_conn.setex(redis_key, 86400, json.dumps(job_data))

        except Exception as e:
            logger.warning(f"Failed to update job metadata: {e}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ok", "job_id": payload.id}
        )

    except Exception as e:
        logger.exception("Failed to process webhook", extra={"error": str(e)})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e)}
        )
