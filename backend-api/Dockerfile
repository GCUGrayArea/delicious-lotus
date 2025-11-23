# Multi-stage Dockerfile for production

# ============================================================================
# Stage 1: Build Frontend
# ============================================================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend-app/package.json frontend-app/package-lock.json ./
RUN npm ci
COPY frontend-app/ .
RUN npm run build

# ============================================================================
# Stage 2: Build dependencies
# ============================================================================
FROM python:3.13-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    build-essential \
    curl \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files and minimal source structure for installation
# NOTE: paths are relative to project root because build context is root
COPY backend-api/pyproject.toml ./
COPY backend-api/src/ ./src/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir .

# ============================================================================
# Stage 3: Runtime image
# ============================================================================
FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FFMPEG_VERSION=7.1 \
    PATH="/usr/local/bin:${PATH}" \
    FRONTEND_PATH="/app/src/frontend/dist"

WORKDIR /app

# Install runtime dependencies and FFmpeg static build
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    xz-utils \
    ca-certificates \
    && curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
    -o /tmp/ffmpeg.tar.xz \
    && mkdir -p /tmp/ffmpeg \
    && tar -xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 \
    && cp /tmp/ffmpeg/ffmpeg /usr/local/bin/ \
    && cp /tmp/ffmpeg/ffprobe /usr/local/bin/ \
    && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
    && rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz \
    && apt-get purge -y curl xz-utils \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Verify FFmpeg installation
RUN ffmpeg -version && ffprobe -version

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash appuser \
    && mkdir -p /app /tmp/ffmpeg \
    && chown -R appuser:appuser /app /tmp/ffmpeg

# Copy Python dependencies from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser backend-api/src/ /app/src/
COPY --chown=appuser:appuser backend-api/alembic.ini /app/alembic.ini
COPY --chown=appuser:appuser backend-api/migrations/ /app/migrations/

# Copy frontend build artifacts
RUN mkdir -p /app/src/frontend/dist && \
    chown -R appuser:appuser /app/src/frontend
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist /app/src/frontend/dist

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health').read()"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
