"""Replicate API schemas for AI generation models."""

from pydantic import BaseModel, Field, HttpUrl


# ============================================================================
# Request Schemas
# ============================================================================



class FluxSchnellRequest(BaseModel):
    """Request schema for Black Forest Labs Flux Schnell model.

    The Flux Schnell model generates high-quality images from text prompts very quickly.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for image generation",
        min_length=1,
        max_length=2000,
        examples=["A futuristic city with flying cars at sunset"]
    )

    aspect_ratio: str = Field(
        default="1:1",
        description="Aspect ratio of the generated image",
        examples=["1:1", "16:9", "21:9", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3", "9:16", "9:21"]
    )

    output_format: str = Field(
        default="webp",
        description="Format of the output image",
        examples=["webp", "jpg", "png"]
    )

    output_quality: int = Field(
        default=80,
        description="Quality of the output image (0-100)",
        ge=0,
        le=100,
        examples=[80, 90, 100]
    )

    disable_safety_checker: bool = Field(
        default=False,
        description="Disable safety checker for generated images"
    )

    seed: int | None = Field(
        default=None,
        description="Random seed. Set for reproducible generation",
        examples=[42, 12345]
    )


class NanoBananaRequest(BaseModel):
    """Request schema for Nano-Banana image generation model.

    The Nano-Banana model generates stylized images based on a prompt
    and optional image input.
    """

    prompt: str = Field(
        ...,
        description="Text prompt describing the desired style or modifications",
        min_length=1,
        max_length=1000,
        examples=["Make the sheets in the style of the logo. Make the scene natural."]
    )

    image_input: list[HttpUrl] | None = Field(
        default=None,
        description="Optional list of image URLs to use as input",
        max_length=10,
        examples=[["https://example.com/image1.png", "https://example.com/image2.png"]]
    )


class WanVideoI2VRequest(BaseModel):
    """Request schema for Wan Video I2V model.

    The Wan Video I2V model generates videos from text prompts and optional images.
    """

    prompt: str = Field(
        ...,
        description="Prompt for video generation",
        min_length=1,
        max_length=1000,
        examples=["A serene ocean wave crashing on the shore"]
    )

    image: HttpUrl = Field(
        ...,
        description="Input image to generate video from",
        examples=["https://example.com/image.png"]
    )

    audio: HttpUrl | None = Field(
        default=None,
        description="Audio file (wav/mp3, 3-30s, <=15MB) for voice/music synchronization",
        examples=["https://example.com/audio.mp3"]
    )

    duration: int = Field(
        default=5,
        description="Duration of the generated video in seconds",
        examples=[5, 10]
    )

    resolution: str = Field(
        default="720p",
        description="Resolution of video: 480p, 720p, or 1080p",
        examples=["480p", "720p", "1080p"]
    )

    negative_prompt: str = Field(
        default="",
        description="Negative prompt to avoid certain elements",
        examples=["blurry, low quality"]
    )

    enable_prompt_expansion: bool = Field(
        default=True,
        description="If set to true, the prompt optimizer will be enabled"
    )


class WanVideoT2VRequest(BaseModel):
    """Request schema for Wan Video 2.5 T2V model.

    The Wan Video 2.5 T2V model generates videos from text prompts only (text-to-video).
    """

    prompt: str = Field(
        ...,
        description="Text prompt for video generation",
        min_length=1,
        max_length=2000,
        examples=["A majestic dragon flying through clouds at sunset"]
    )

    size: str = Field(
        default="1280*720",
        description="Video resolution and aspect ratio",
        examples=["832*480", "480*832", "1280*720", "720*1280", "1920*1080", "1080*1920"]
    )

    duration: int = Field(
        default=5,
        description="Duration of the generated video in seconds (5 or 10)",
        ge=5,
        le=10,
        examples=[5, 10]
    )


class Seedance1ProFastRequest(BaseModel):
    """Request schema for Seedance-1-Pro-Fast model.

    The Seedance-1-Pro-Fast model generates videos from text prompts with optional image input.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for video generation",
        min_length=1,
        max_length=2000,
        examples=["A dancer performing gracefully in the moonlight"]
    )

    image: HttpUrl | None = Field(
        default=None,
        description="Input image for image-to-video generation",
        examples=["https://example.com/image.png"]
    )

    duration: int = Field(
        default=5,
        description="Video duration in seconds",
        ge=2,
        le=12,
        examples=[5, 10]
    )

    resolution: str = Field(
        default="1080p",
        description="Video resolution: 480p, 720p, or 1080p",
        examples=["480p", "720p", "1080p"]
    )

    aspect_ratio: str = Field(
        default="16:9",
        description="Video aspect ratio",
        examples=["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"]
    )

    fps: int = Field(
        default=24,
        description="Frame rate (frames per second)",
        examples=[24]
    )

    seed: int | None = Field(
        default=None,
        description="Random seed. Set for reproducible generation",
        examples=[42, 12345]
    )

    camera_fixed: bool = Field(
        default=False,
        description="Whether to fix camera position"
    )


class Hailuo23FastRequest(BaseModel):
    """Request schema for MiniMax Hailuo 2.3 Fast model.

    The Hailuo 2.3 Fast model generates videos from a first frame image and text prompt.
    The output video will have the same aspect ratio as the input image.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for generation",
        min_length=1,
        max_length=2000,
        examples=["A person walking through a forest"]
    )

    first_frame_image: HttpUrl = Field(
        ...,
        description="First frame image for video generation. The output video will have the same aspect ratio as this image",
        examples=["https://example.com/first_frame.png"]
    )

    duration: int = Field(
        default=6,
        description="Duration of the video in seconds. 10 seconds is only available for 768p resolution",
        examples=[6, 10]
    )

    resolution: str = Field(
        default="768p",
        description="Pick between 768p or 1080p resolution. 1080p supports only 6-second duration",
        examples=["768p", "1080p"]
    )

    prompt_optimizer: bool = Field(
        default=True,
        description="Use prompt optimizer"
    )


class KlingV25TurboProRequest(BaseModel):
    """Request schema for Kuaishou Kling v2.5 Turbo Pro model.

    The Kling v2.5 Turbo Pro model generates high-quality videos from text prompts
    with optional start image for image-to-video generation.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for video generation",
        min_length=1,
        max_length=2000,
        examples=["A cinematic shot of a sunset over mountains"]
    )

    start_image: HttpUrl | None = Field(
        default=None,
        description="First frame of the video for image-to-video generation",
        examples=["https://example.com/start_frame.png"]
    )

    aspect_ratio: str = Field(
        default="16:9",
        description="Aspect ratio of the video. Ignored if start_image is provided",
        examples=["16:9", "9:16", "1:1"]
    )

    duration: int = Field(
        default=5,
        description="Duration of the video in seconds: 5 or 10",
        examples=[5, 10]
    )

    negative_prompt: str = Field(
        default="",
        description="Things you do not want to see in the video",
        max_length=1000,
        examples=["blurry, low quality, distorted"]
    )


class Veo31FastRequest(BaseModel):
    """Request schema for Google Veo 3.1 Fast model.

    The Veo 3.1 Fast model generates high-quality videos from text prompts with optional image inputs.
    Supports image-to-video and video interpolation.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for video generation",
        min_length=1,
        max_length=2000,
        examples=["A serene landscape transitioning from day to night"]
    )

    aspect_ratio: str = Field(
        default="16:9",
        description="Video aspect ratio: 16:9 or 9:16",
        examples=["16:9", "9:16"]
    )

    duration: int = Field(
        default=8,
        description="Video duration in seconds: 4, 6, or 8",
        examples=[4, 6, 8]
    )

    image: HttpUrl | None = Field(
        default=None,
        description="Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280",
        examples=["https://example.com/start_image.png"]
    )

    last_frame: HttpUrl | None = Field(
        default=None,
        description="Ending image for interpolation. When provided with an input image, creates a transition between the two images",
        examples=["https://example.com/end_image.png"]
    )

    negative_prompt: str | None = Field(
        default=None,
        description="Description of what to exclude from the generated video",
        max_length=1000,
        examples=["blurry, low quality, distorted"]
    )

    resolution: str = Field(
        default="1080p",
        description="Resolution of the generated video: 720p or 1080p",
        examples=["720p", "1080p"]
    )

    generate_audio: bool = Field(
        default=True,
        description="Generate audio with the video"
    )

    seed: int | None = Field(
        default=None,
        description="Random seed. Omit for random generations",
        examples=[42, 12345]
    )


# ============================================================================
# Audio Generation Request Schemas
# ============================================================================


class Lyria2Request(BaseModel):
    """Request schema for Google Lyria 2 audio generation model.

    The Lyria 2 model generates audio from text prompts.
    """

    prompt: str = Field(
        ...,
        description="Text prompt for audio generation",
        min_length=1,
        max_length=2000,
        examples=["An upbeat electronic dance track with heavy bass"]
    )

    negative_prompt: str | None = Field(
        default=None,
        description="Description of what to exclude from the generated audio",
        max_length=1000,
        examples=["vocals, singing, speech"]
    )

    seed: int | None = Field(
        default=None,
        description="Random seed. Omit for random generations",
        examples=[42, 12345]
    )


class Music01Request(BaseModel):
    """Request schema for MiniMax Music-01 model.

    The Music-01 model generates music with optional lyrics, voice, and instrumental references.
    """

    lyrics: str = Field(
        default="",
        description="Lyrics with optional formatting. Use newline to separate lines, double newline for pause, ## for accompaniment sections. Maximum 350-400 characters",
        max_length=500,
        examples=["Hello world\nThis is a song\n\n##instrumental break##"]
    )

    voice_id: str | None = Field(
        default=None,
        description="Reuse a previously uploaded voice ID"
    )

    voice_file: HttpUrl | None = Field(
        default=None,
        description="Voice reference. Must be a .wav or .mp3 file longer than 15 seconds. If only a voice reference is given, an a cappella vocal hum will be generated",
        examples=["https://example.com/voice.mp3"]
    )

    song_file: HttpUrl | None = Field(
        default=None,
        description="Reference song, should contain music and vocals. Must be a .wav or .mp3 file longer than 15 seconds",
        examples=["https://example.com/song.mp3"]
    )

    instrumental_id: str | None = Field(
        default=None,
        description="Reuse a previously uploaded instrumental ID"
    )

    instrumental_file: HttpUrl | None = Field(
        default=None,
        description="Instrumental reference. Must be a .wav or .mp3 file longer than 15 seconds. If only an instrumental reference is given, a track without vocals will be generated",
        examples=["https://example.com/instrumental.mp3"]
    )

    sample_rate: int = Field(
        default=44100,
        description="Sample rate for the generated music: 16000, 24000, 32000, or 44100",
        examples=[16000, 24000, 32000, 44100]
    )

    bitrate: int = Field(
        default=256000,
        description="Bitrate for the generated music: 32000, 64000, 128000, or 256000",
        examples=[32000, 64000, 128000, 256000]
    )


class StableAudio25Request(BaseModel):
    """Request schema for Stability AI Stable Audio 2.5 model.

    The Stable Audio 2.5 model generates high-quality audio from text prompts.
    """

    prompt: str = Field(
        ...,
        description="Text prompt describing the desired audio",
        min_length=1,
        max_length=2000,
        examples=["A calm acoustic guitar melody with soft piano accompaniment"]
    )

    duration: int = Field(
        default=190,
        description="Duration of generated audio in seconds",
        ge=1,
        le=190,
        examples=[30, 60, 120, 190]
    )

    steps: int = Field(
        default=8,
        description="Number of diffusion steps (higher = better quality but slower)",
        ge=4,
        le=8,
        examples=[4, 6, 8]
    )

    cfg_scale: float = Field(
        default=1,
        description="Classifier-free guidance scale (higher = more prompt adherence)",
        ge=1,
        le=25,
        examples=[1, 5, 10]
    )

    seed: int | None = Field(
        default=None,
        description="Random seed for reproducible results. Leave blank for random seed",
        examples=[42, 12345]
    )


# ============================================================================
# Response Schemas (Async)
# ============================================================================


class AsyncJobResponse(BaseModel):
    """Async job response for Replicate predictions.

    Returns immediately with a job ID that can be used to track progress.
    """

    job_id: str = Field(
        ...,
        description="Unique job identifier for tracking",
        examples=["pred_abc123xyz"]
    )

    status: str = Field(
        default="queued",
        description="Initial status of the job",
        examples=["queued", "starting"]
    )

    message: str | None = Field(
        default=None,
        description="Optional status message",
        examples=["Job created successfully"]
    )


class NanoBananaResponse(BaseModel):
    """Response schema for Nano-Banana model."""

    url: str = Field(
        ...,
        description="URL of the generated output image",
        examples=["https://replicate.delivery/.../output.png"]
    )

    status: str = Field(
        default="success",
        description="Status of the generation",
        examples=["success"]
    )


class NanoBananaErrorResponse(BaseModel):
    """Error response schema for Nano-Banana model."""

    error: str = Field(
        ...,
        description="Error message describing what went wrong",
        examples=["Failed to generate image: API key not configured"]
    )

    status: str = Field(
        default="error",
        description="Status indicating an error occurred",
        examples=["error"]
    )


# ============================================================================
# Webhook Schemas
# ============================================================================


class ReplicateWebhookPayload(BaseModel):
    """Webhook payload from Replicate when a prediction completes."""

    id: str = Field(..., description="Prediction ID")
    status: str = Field(..., description="Status: succeeded, failed, canceled")
    output: list[str] | str | None = Field(None, description="Output URL(s)")
    error: str | None = Field(None, description="Error message if failed")
    logs: str | None = Field(None, description="Generation logs")
    metrics: dict | None = Field(None, description="Performance metrics")
