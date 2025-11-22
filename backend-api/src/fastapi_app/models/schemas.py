"""
Pydantic models and schemas for the AI Video Generation API
Block 0: API Skeleton & Core Infrastructure
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, validator


# Shared Enums
class GenerationStatus(str, Enum):
    """Status of a video generation job"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPOSING = "composing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CompositionStatus(str, Enum):
    """Status of a video composition job"""
    QUEUED = "queued"
    ENCODING = "encoding"
    COMPLETED = "completed"
    FAILED = "failed"


class AspectRatio(str, Enum):
    """Supported aspect ratios for video generation"""
    LANDSCAPE_16_9 = "16:9"
    PORTRAIT_9_16 = "9:16"
    SQUARE_1_1 = "1:1"


class VideoFormat(str, Enum):
    """Supported video output formats"""
    MP4 = "mp4"
    WEBM = "webm"


# Base Response Models
class BaseResponse(BaseModel):
    """Base response model with common fields"""
    request_id: Optional[str] = Field(None, description="Request ID for tracing")


class ErrorDetail(BaseModel):
    """Detailed error information"""
    field: Optional[str] = None
    message: str
    code: Optional[str] = None


# Error Response (defined here for consistency, but also in errors.py)
class ErrorResponse(BaseModel):
    """Standardized error response format"""
    error: Dict[str, Any]


# Generation Request/Response Models
class GenerationParameters(BaseModel):
    """Parameters for video generation"""
    duration_seconds: int = Field(..., ge=15, le=60, description="Video duration in seconds (15, 30, 45, or 60)")
    aspect_ratio: AspectRatio = Field(default=AspectRatio.LANDSCAPE_16_9, description="Video aspect ratio")
    style: str = Field(default="professional", description="Style preferences")
    brand: Optional[Dict[str, Any]] = Field(default=None, description="Brand configuration")
    include_cta: bool = Field(default=True, description="Include call-to-action")
    cta_text: Optional[str] = Field(default="Shop Now", description="Call-to-action text")
    music_style: str = Field(default="corporate", description="Music style preference")

    @validator('duration_seconds')
    def validate_duration(cls, v):
        """Validate duration is one of the allowed values"""
        allowed_durations = [15, 30, 45, 60]
        if v not in allowed_durations:
            raise ValueError(f"Duration must be one of: {allowed_durations}")
        return v


class GenerationOptions(BaseModel):
    """Options for video generation"""
    quality: str = Field(default="high", description="Generation quality")
    fast_generation: bool = Field(default=False, description="Use faster but lower quality generation")
    parallelize_generations: bool = Field(default=False, description="Generate clips in parallel (faster but less coherent between clips)")


class GenerationRequest(BaseModel):
    """Request model for creating a new video generation"""
    prompt: str = Field(..., min_length=50, max_length=2000, description="Text prompt for video generation")
    parameters: GenerationParameters
    options: Optional[GenerationOptions] = Field(default_factory=GenerationOptions)

    @validator('prompt')
    def validate_prompt(cls, v):
        """Validate prompt content"""
        if not v.strip():
            raise ValueError("Prompt cannot be empty or whitespace only")

        # Basic content filtering (can be enhanced)
        forbidden_words = ["inappropriate", "offensive"]  # Placeholder
        lower_prompt = v.lower()
        for word in forbidden_words:
            if word in lower_prompt:
                raise ValueError(f"Prompt contains inappropriate content: {word}")

        return v.strip()


class CreateGenerationResponse(BaseModel):
    """Response model for generation creation"""
    generation_id: str = Field(..., description="Unique generation ID")
    status: GenerationStatus = Field(default=GenerationStatus.QUEUED)
    created_at: datetime
    estimated_completion: datetime
    websocket_url: str = Field(..., description="WebSocket URL for real-time progress updates")
    prompt_analysis: Optional[Dict[str, Any]] = Field(
        default=None, description="Result of prompt analysis step"
    )
    brand_config: Optional[Dict[str, Any]] = Field(
        default=None, description="Result of brand analysis step"
    )
    scenes: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Scene decomposition output"
    )
    micro_prompts: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Generated micro-prompts for each scene"
    )


class ClipMetadata(BaseModel):
    """Metadata for an individual video clip"""
    clip_id: str
    url: str
    thumbnail_url: Optional[str] = None
    duration: float
    start_time: float
    end_time: float
    prompt: str


class GenerationProgress(BaseModel):
    """Progress information for a generation"""
    current_step: str
    steps_completed: int
    total_steps: int
    percentage: float = Field(ge=0.0, le=100.0)
    current_clip: Optional[int] = None
    total_clips: Optional[int] = None


class GenerationResponse(BaseModel):
    """Response model for generation status and results"""
    generation_id: str = Field(..., description="Unique generation ID")
    status: GenerationStatus
    progress: Optional[GenerationProgress] = None
    metadata: Dict[str, Any] = Field(..., description="Generation metadata including prompt and parameters")
    created_at: datetime
    updated_at: datetime
    clips_generated: Optional[List[ClipMetadata]] = None

    class Config:
        use_enum_values = True


class ProgressResponse(BaseModel):
    """Response model for operation progress updates"""
    operation_id: str
    operation_type: str  # "generation", "composition", etc.
    status: Union[GenerationStatus, CompositionStatus]
    progress: float = Field(..., ge=0.0, le=100.0)
    current_step: Optional[str] = None
    estimated_time_remaining: Optional[int] = None  # seconds
    message: Optional[str] = None
    updated_at: datetime

    class Config:
        use_enum_values = True


class CreateVideoFromImagesRequest(BaseModel):
    """Request model for creating a video from a sequence of images with Ken Burns effect."""
    image_urls: List[str] = Field(..., min_items=1, description="List of image URLs to include in the video")
    duration: float = Field(..., ge=1.0, le=300.0, description="Target duration of the video in seconds")
    user_id: str = Field(..., description="User ID for asset ownership")
    width: Optional[int] = Field(None, ge=100, le=3840, description="Target video width (optional, defaults to first image width)")
    height: Optional[int] = Field(None, ge=100, le=2160, description="Target video height (optional, defaults to first image height)")


class CreateVideoFromImagesResponse(BaseModel):
    """Response model for video creation request."""
    job_id: str = Field(..., description="Job ID for tracking progress")
    status: str = Field(default="queued", description="Initial status of the job")


class JobStatusResponse(BaseModel):
    """Response model for job status check."""
    status: str = Field(..., description="Current status of the job (queued, started, finished, failed)")
    result: Optional[Dict[str, Any]] = Field(None, description="Job result data (if finished)")
    error: Optional[str] = Field(None, description="Error message (if failed)")
    progress: Optional[Any] = Field(None, description="Progress information (if available)")


# Health Check Models
class HealthCheckResponse(BaseModel):
    """Response model for health checks"""
    status: str
    service: str
    version: str
    timestamp: datetime
    checks: Optional[Dict[str, str]] = None


class DetailedHealthResponse(BaseModel):
    """Detailed health check response"""
    status: str
    service: str
    version: str
    timestamp: datetime
    request_id: Optional[str] = None
    checks: Dict[str, str]


# Validation Models
class ValidationResult(BaseModel):
    """Result of input validation"""
    is_valid: bool
    errors: List[ErrorDetail] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# Pagination Models
class PaginationMeta(BaseModel):
    """Pagination metadata"""
    page: int
    limit: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper"""
    data: List[Any]
    pagination: PaginationMeta


# Internal Service Models (for FFmpeg integration)
class AudioAnalysisRequest(BaseModel):
    """Request model for audio analysis (post-MVP feature)"""
    job_id: str = Field(..., description="Unique job identifier")
    audio: Dict[str, str] = Field(..., description="Audio source information")
    options: Dict[str, Any] = Field(default_factory=dict, description="Analysis options")


class AudioAnalysisResponse(BaseModel):
    """Response model for audio analysis results"""
    job_id: str
    beat_analysis: Dict[str, Any] = Field(default_factory=dict)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    energy_curve: Dict[str, Any] = Field(default_factory=dict)


class ClipInstruction(BaseModel):
    """Instructions for video composition"""
    target_duration: float = Field(..., description="Target video duration in seconds")
    transitions: List[str] = Field(default_factory=list, description="Transition types to use")
    audio_sync: bool = Field(default=True, description="Whether to sync audio")
    color_correction: bool = Field(default=True, description="Apply color correction")
    stabilization: bool = Field(default=False, description="Apply stabilization")


class ProcessClipsRequest(BaseModel):
    """Request model for sending clips to FFmpeg backend"""
    job_id: str = Field(..., description="Unique job identifier")
    clips: List[Dict[str, Any]] = Field(..., description="List of clips to process")
    instructions: ClipInstruction = Field(..., description="Processing instructions")
    callback_url: str = Field(..., description="URL to call when processing is complete")


class ProcessClipsResponse(BaseModel):
    """Response model for clip processing submission"""
    processing_id: str = Field(..., description="Unique processing identifier")
    status: str = Field(default="accepted", description="Processing status")
    estimated_completion: int = Field(..., description="Estimated completion time in seconds")


class ProcessingCompleteRequest(BaseModel):
    """Request model for processing completion callback"""
    job_id: str = Field(..., description="Original job identifier")
    processing_id: str = Field(..., description="Processing identifier")
    status: str = Field(..., description="Completion status")
    output: Dict[str, Any] = Field(default_factory=dict, description="Output information")


class ProcessingCompleteResponse(BaseModel):
    """Response model for processing completion acknowledgment"""
    acknowledged: bool = Field(default=True, description="Whether the completion was acknowledged")
    job_id: str
    processing_id: str


# Utility functions for validation
def validate_generation_request(request: GenerationRequest) -> ValidationResult:
    """Centralized validation for generation requests"""
    errors = []
    warnings = []

    # Check prompt length
    if len(request.prompt) < 10:
        warnings.append("Prompt is quite short, results may be less detailed")

    if len(request.prompt) > 500:
        warnings.append("Prompt is very long, consider simplifying for better results")

    # Check for brand colors format
    if request.brand_colors:
        for color in request.brand_colors:
            if not color.startswith('#') or len(color) != 7:
                errors.append(ErrorDetail(
                    field="brand_colors",
                    message=f"Invalid color format: {color}. Use hex format like #FF0000"
                ))

    # Validate duration constraints
    if request.duration and request.duration < 3.0:
        warnings.append("Duration is very short, video may feel rushed")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )


def validate_prompt_safety(prompt: str) -> ValidationResult:
    """Validate prompt for safety and content guidelines"""
    errors = []
    warnings = []

    # Basic safety checks (can be enhanced with ML models)
    unsafe_patterns = [
        "violence", "harm", "illegal",
        "inappropriate content", "nsfw"
    ]

    lower_prompt = prompt.lower()
    for pattern in unsafe_patterns:
        if pattern in lower_prompt:
            errors.append(ErrorDetail(
                field="prompt",
                message=f"Prompt may contain unsafe content: {pattern}",
                code="UNSAFE_CONTENT"
            ))

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )
