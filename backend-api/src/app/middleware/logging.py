"""Logging middleware with structured JSON output."""

import random
import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..config import get_settings
from ..logging_config import get_logger

logger = get_logger("api")

# Sensitive headers that should not be logged
SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-auth-token",
    "proxy-authorization",
    "x-csrf-token",
    "x-xsrf-token",
}


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for structured request/response logging with sampling support."""

    def __init__(self, app, **kwargs):
        """Initialize logging middleware.

        Args:
            app: ASGI application
            **kwargs: Additional middleware arguments
        """
        super().__init__(app, **kwargs)
        self.settings = get_settings()

    def _should_log_request(self, path: str) -> bool:
        """Determine if request should be logged based on sampling rate.

        Args:
            path: Request path

        Returns:
            bool: True if request should be logged
        """
        # Never log health checks to reduce noise
        if path.startswith("/health") or path.startswith("/api/v1/health"):
            return False

        # Always log excluded paths (critical paths that bypass sampling)
        if path in self.settings.log_sampling_exclude_paths:
            return True

        # Apply sampling rate to other paths
        return random.random() < self.settings.log_sampling_rate  # noqa: S311

    def _filter_headers(self, headers: dict) -> dict:
        """Filter out sensitive headers from logging.

        Args:
            headers: Request or response headers

        Returns:
            dict: Filtered headers safe for logging
        """
        return {
            key: value for key, value in headers.items() if key.lower() not in SENSITIVE_HEADERS
        }

    async def dispatch(  # noqa: C901
        self, request: Request, call_next: Callable[[Request], Response]
    ) -> Response:
        """Log request and response information with enhanced tracking.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware or route handler

        Returns:
            Response: HTTP response
        """
        start_time = time.time()
        path = request.url.path

        # Check if we should log this request based on sampling
        should_log = self._should_log_request(path)

        # Prepare request log data
        request_log_data = {
            "event": "request_started",
            "method": request.method,
            "path": path,
            "query_params": str(request.query_params) if request.query_params else None,
            "client_host": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }

        # Add headers if enabled
        if should_log and self.settings.log_request_headers:
            request_log_data["headers"] = self._filter_headers(dict(request.headers))

        # Add body size if enabled and available
        if should_log and self.settings.log_request_body_size:
            content_length = request.headers.get("content-length")
            if content_length:
                request_log_data["body_size_bytes"] = int(content_length)

        # Log request if sampling allows
        if should_log:
            logger.info("Request started", extra=request_log_data)

        # Process request
        try:
            response = await call_next(request)
        except Exception as exc:
            # Always log errors regardless of sampling
            duration = time.time() - start_time
            logger.error(
                f"Request error: {exc!s}",
                extra={
                    "event": "request_error",
                    "method": request.method,
                    "path": path,
                    "duration_ms": round(duration * 1000, 2),
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                exc_info=True,
            )
            raise

        # Prepare response log data
        duration = time.time() - start_time
        log_message = f"{request.method} {path} - {response.status_code}"
        log_extra = {
            "event": "request_completed",
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
        }

        # Add response size if enabled
        if should_log and self.settings.log_response_body_size:
            content_length = response.headers.get("content-length")
            if content_length:
                log_extra["response_size_bytes"] = int(content_length)

        # Log response if sampling allows (always log errors and warnings)
        if should_log or response.status_code >= 400:
            # Use different log levels based on status code
            if response.status_code >= 500:
                logger.error(log_message, extra=log_extra)
            elif response.status_code >= 400:
                logger.warning(log_message, extra=log_extra)
            else:
                logger.info(log_message, extra=log_extra)

        return response
