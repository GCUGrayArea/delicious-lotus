"""Application configuration using Pydantic settings."""

import os
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application settings
    app_name: str = "FFmpeg Backend"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = Field(default=False, description="Enable debug mode")
    log_level: str = Field(default="INFO", description="Logging level")

    # Logging middleware settings
    log_request_body_size: bool = Field(default=True, description="Log request body size in bytes")
    log_response_body_size: bool = Field(
        default=True, description="Log response body size in bytes"
    )
    log_request_headers: bool = Field(
        default=True, description="Log request headers (excluding sensitive ones)"
    )
    log_sampling_rate: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Sampling rate for request logging (0.0-1.0, 1.0 = log all)",
    )
    log_sampling_exclude_paths: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["/health", "/health/detailed", "/docs", "/redoc", "/openapi.json"],
        description="Paths to exclude from sampling (always logged)",
    )

    # Log rotation and retention settings
    log_rotation_when: str = Field(
        default="midnight",
        description="When to rotate logs (midnight, H, D, W0-W6)",
    )
    log_rotation_interval: int = Field(
        default=1, description="Rotation interval (e.g., 1 for daily)"
    )
    log_retention_days: int = Field(
        default=30, description="Number of days to keep logs before deletion"
    )
    log_max_bytes: int = Field(
        default=100 * 1024 * 1024, description="Max log file size before rotation (100MB)"
    )
    log_backup_count: int = Field(default=30, description="Number of backup log files to keep")
    log_compress_rotated: bool = Field(
        default=True, description="Compress rotated log files with gzip"
    )
    log_s3_archive_enabled: bool = Field(
        default=False, description="Enable archiving old logs to S3"
    )
    log_disk_usage_threshold: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Disk usage threshold for warnings (0.0-1.0)",
    )

    # API settings
    api_v1_prefix: str = "/api/v1"
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:8000", "http://localhost:5173"],
        description="CORS allowed origins",
    )

    # Database settings
    database_url: PostgresDsn = Field(
        default="postgresql://ai_video_admin:ai_video_admin@localhost:5432/ai_video_pipeline",
        description="PostgreSQL database URL",
    )
    db_pool_size: int = Field(default=10, description="Database connection pool size")
    db_max_overflow: int = Field(
        default=20, description="Max overflow connections beyond pool_size"
    )

    # Redis settings
    redis_url: RedisDsn = Field(
        default="redis://localhost:6379/0", description="Redis connection URL"
    )
    redis_max_connections: int = Field(default=50, description="Redis connection pool size")

    # RQ (Job Queue) settings
    rq_default_timeout: int = Field(
        default=3600, description="Default job timeout in seconds (1 hour)"
    )
    rq_result_ttl: int = Field(default=86400, description="Job result TTL in seconds (24 hours)")
    rq_failure_ttl: int = Field(default=604800, description="Failed job TTL in seconds (7 days)")
    rq_job_retry_count: int = Field(
        default=0, ge=0, description="Number of times to retry failed jobs (0 = no retries)"
    )

    # S3/Object Storage settings
    s3_bucket_name: str = Field(default="", description="S3 bucket name for media storage")
    s3_region: str = Field(default="us-east-1", description="S3 region")
    s3_access_key_id: str = Field(default="", description="AWS access key ID")
    s3_secret_access_key: str = Field(default="", description="AWS secret access key")
    s3_endpoint_url: str | None = Field(
        default=None, description="Custom S3 endpoint URL (for MinIO, etc.)"
    )

    # FFmpeg settings
    ffmpeg_path: str = Field(default="/usr/bin/ffmpeg", description="Path to FFmpeg binary")
    ffprobe_path: str = Field(
        default="/usr/bin/ffprobe", description="Path to ffprobe binary"
    )
    ffmpeg_threads: int = Field(default=0, description="Number of threads for FFmpeg (0 = auto)")
    max_concurrent_jobs: int = Field(default=4, description="Maximum concurrent FFmpeg jobs")

    # Media processing settings
    temp_dir: str = Field(
        default="/tmp/ffmpeg",  # noqa: S108  # nosec B108
        description="Temporary directory for processing",
    )
    max_upload_size: int = Field(
        default=1024 * 1024 * 1024, description="Max upload size in bytes (1GB default)"
    )
    supported_video_formats: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["mp4", "mov", "avi", "mkv", "webm"],
        description="Supported video file formats",
    )
    supported_audio_formats: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["mp3", "wav", "aac", "m4a", "ogg", "flac"],
        description="Supported audio file formats",
    )
    supported_image_formats: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["jpg", "jpeg", "png", "gif", "webp"],
        description="Supported image file formats",
    )

    # Internal API Authentication settings
    internal_api_keys: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        description="Comma-separated list of valid internal API keys",
    )
    jwt_secret_key: str = Field(
        default="",
        description="Secret key for JWT token validation (service-to-service auth)",
    )
    jwt_algorithm: str = Field(
        default="HS256",
        description="JWT token algorithm",
    )
    jwt_expiration_minutes: int = Field(
        default=60,
        description="JWT token expiration time in minutes",
    )

    # Feature Flags
    feature_dev_api_enabled: bool = Field(
        default=False, description="Enable development/debugging API endpoints"
    )
    feature_beat_detection_enabled: bool = Field(
        default=False, description="Enable beat detection for audio sync"
    )
    feature_gpu_encoding_enabled: bool = Field(
        default=False, description="Enable GPU-accelerated encoding (NVENC/QSV)"
    )
    feature_4k_output_enabled: bool = Field(
        default=False, description="Enable 4K resolution output"
    )
    feature_websocket_enabled: bool = Field(
        default=True, description="Enable WebSocket real-time updates"
    )
    feature_metrics_enabled: bool = Field(
        default=True, description="Enable Prometheus metrics collection"
    )
    feature_advanced_filters_enabled: bool = Field(
        default=False, description="Enable advanced video filters and effects"
    )

    @field_validator(
        "allowed_origins",
        "supported_video_formats",
        "supported_audio_formats",
        "supported_image_formats",
        "internal_api_keys",
        "log_sampling_exclude_paths",
        mode="before",
    )
    @classmethod
    def parse_comma_separated(cls, v: str | list[str]) -> list[str]:
        """Parse comma-separated string into list."""
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        """Check if running in staging environment."""
        return self.environment == "staging"

    def validate_configuration(self) -> list[str]:  # noqa: C901
        """Validate configuration and return list of errors.

        Returns:
            List of error messages (empty if valid)
        """
        errors: list[str] = []

        # Validate critical settings in production
        if self.is_production:
            errors.extend(self._validate_production_settings())

        # Validate numeric ranges
        errors.extend(self._validate_numeric_ranges())

        return errors

    def _validate_production_settings(self) -> list[str]:
        """Validate production-specific settings."""
        errors: list[str] = []

        if not self.s3_bucket_name:
            errors.append("S3_BUCKET_NAME is required in production")
        if not self.s3_access_key_id:
            errors.append("S3_ACCESS_KEY_ID is required in production")
        if not self.s3_secret_access_key:
            errors.append("S3_SECRET_ACCESS_KEY is required in production")
        if not self.internal_api_keys:
            errors.append("INTERNAL_API_KEYS is required in production")
        if not self.jwt_secret_key:
            errors.append("JWT_SECRET_KEY is required in production")
        if self.debug:
            errors.append("DEBUG should be False in production")
        if "localhost" in self.allowed_origins:
            errors.append("ALLOWED_ORIGINS should not include localhost in production")

        return errors

    def _validate_numeric_ranges(self) -> list[str]:
        """Validate numeric configuration values."""
        errors: list[str] = []

        if self.db_pool_size < 1:
            errors.append("DB_POOL_SIZE must be at least 1")
        if self.db_max_overflow < 0:
            errors.append("DB_MAX_OVERFLOW must be non-negative")
        if self.redis_max_connections < 1:
            errors.append("REDIS_MAX_CONNECTIONS must be at least 1")
        if self.max_concurrent_jobs < 1:
            errors.append("MAX_CONCURRENT_JOBS must be at least 1")
        if self.log_sampling_rate < 0.0 or self.log_sampling_rate > 1.0:
            errors.append("LOG_SAMPLING_RATE must be between 0.0 and 1.0")

        return errors

    def get_feature_flags(self) -> dict[str, bool]:
        """Get all feature flags as a dictionary.

        Returns:
            Dictionary of feature flag names and their values
        """
        return {
            "dev_api": self.feature_dev_api_enabled,
            "beat_detection": self.feature_beat_detection_enabled,
            "gpu_encoding": self.feature_gpu_encoding_enabled,
            "4k_output": self.feature_4k_output_enabled,
            "websocket": self.feature_websocket_enabled,
            "metrics": self.feature_metrics_enabled,
            "advanced_filters": self.feature_advanced_filters_enabled,
        }

    @field_validator("s3_bucket_name", mode="before")
    @classmethod
    def _fallback_s3_bucket(cls, v: str) -> str:
        """Allow legacy S3_BUCKET env var to populate s3_bucket_name."""
        if v:
            return v
        return os.getenv("S3_BUCKET", "")

    @field_validator("s3_access_key_id", mode="before")
    @classmethod
    def _fallback_s3_access_key(cls, v: str) -> str:
        """Allow legacy AWS_ACCESS_KEY_ID env var to populate s3_access_key_id."""
        if v:
            return v
        return os.getenv("AWS_ACCESS_KEY_ID", "")

    @field_validator("s3_secret_access_key", mode="before")
    @classmethod
    def _fallback_s3_secret_key(cls, v: str) -> str:
        """Allow legacy AWS_SECRET_ACCESS_KEY env var to populate s3_secret_access_key."""
        if v:
            return v
        return os.getenv("AWS_SECRET_ACCESS_KEY", "")

    @field_validator("s3_region", mode="before")
    @classmethod
    def _fallback_s3_region(cls, v: str) -> str:
        """Allow legacy AWS_REGION env var to populate s3_region."""
        if v and v != "us-east-1":
            return v
        return os.getenv("AWS_REGION", v or "us-east-1")


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings.

    Returns:
        Settings: Application configuration
    """
    return Settings()


# Create settings instance for easy import
settings = get_settings()
