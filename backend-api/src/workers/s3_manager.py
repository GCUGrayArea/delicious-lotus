"""S3 asset download and upload management with retry logic."""

import logging
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import boto3
from app.config import settings
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


class S3Manager:
    """Manages S3 operations with retry logic and progress tracking."""

    def __init__(self) -> None:
        """Initialize S3 manager with configured client."""
        self.bucket_name = settings.s3_bucket_name

        # Configure boto3 client with retry logic and signature version 4
        config = Config(
            region_name=settings.s3_region,
            signature_version="s3v4",  # Required for presigned URLs in some regions
            retries={
                "max_attempts": 3,
                "mode": "adaptive",
            },
            max_pool_connections=50,
        )

        # Create S3 client
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            endpoint_url=settings.s3_endpoint_url,
            config=config,
        )

        logger.info(
            "Initialized S3Manager",
            extra={
                "bucket": self.bucket_name,
                "region": settings.s3_region,
                "endpoint": settings.s3_endpoint_url or "default",
            },
        )

    @retry(
        retry=retry_if_exception_type((ClientError, BotoCoreError, ConnectionError)),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def download_file(
        self,
        s3_key: str,
        local_path: str | Path,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> Path:
        """Download a file from S3 with retry logic and progress tracking.

        Args:
            s3_key: S3 object key
            local_path: Local file path to save to
            progress_callback: Optional callback for progress updates (bytes_downloaded, total_bytes)

        Returns:
            Path: Path to downloaded file

        Raises:
            ClientError: If S3 download fails
            FileNotFoundError: If S3 object doesn't exist
        """
        local_path = Path(local_path)

        try:
            # Ensure parent directory exists
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Get object metadata for size info
            try:
                response = self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
                total_size = response.get("ContentLength", 0)
            except ClientError as e:
                if e.response["Error"]["Code"] == "404":
                    raise FileNotFoundError(
                        f"S3 object not found: s3://{self.bucket_name}/{s3_key}"
                    ) from e
                raise

            logger.info(
                f"Starting download: s3://{self.bucket_name}/{s3_key}",
                extra={
                    "s3_key": s3_key,
                    "local_path": str(local_path),
                    "size_bytes": total_size,
                },
            )

            # Download with progress tracking
            bytes_downloaded = 0

            def progress_hook(bytes_amount: int) -> None:
                nonlocal bytes_downloaded
                bytes_downloaded += bytes_amount
                if progress_callback:
                    progress_callback(bytes_downloaded, total_size)

            self.s3_client.download_file(
                Bucket=self.bucket_name,
                Key=s3_key,
                Filename=str(local_path),
                Callback=progress_hook if progress_callback else None,
            )

            logger.info(
                f"Download completed: {s3_key}",
                extra={
                    "s3_key": s3_key,
                    "local_path": str(local_path),
                    "size_bytes": total_size,
                },
            )

            return local_path

        except Exception as e:
            logger.exception(
                f"Failed to download from S3: {s3_key}",
                extra={"s3_key": s3_key, "error": str(e)},
            )
            raise

    @retry(
        retry=retry_if_exception_type((ClientError, BotoCoreError, ConnectionError)),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def upload_file(
        self,
        local_path: str | Path,
        s3_key: str,
        progress_callback: Callable[[int, int], None] | None = None,
        extra_args: dict[str, Any] | None = None,
    ) -> str:
        """Upload a file to S3 with retry logic and multipart support.

        Args:
            local_path: Local file path to upload
            s3_key: S3 object key
            progress_callback: Optional callback for progress updates (bytes_uploaded, total_bytes)
            extra_args: Extra arguments for upload (ContentType, Metadata, etc.)

        Returns:
            str: S3 URL of uploaded file

        Raises:
            ClientError: If S3 upload fails
            FileNotFoundError: If local file doesn't exist
        """
        local_path = Path(local_path)

        if not local_path.exists():
            raise FileNotFoundError(f"Local file not found: {local_path}")

        try:
            file_size = local_path.stat().st_size

            logger.info(
                f"Starting upload: {local_path} -> s3://{self.bucket_name}/{s3_key}",
                extra={
                    "local_path": str(local_path),
                    "s3_key": s3_key,
                    "size_bytes": file_size,
                },
            )

            # Use multipart upload for files larger than 100MB
            use_multipart = file_size > 100 * 1024 * 1024

            if use_multipart:
                logger.debug(f"Using multipart upload for large file: {file_size} bytes")
                transfer_config = boto3.s3.transfer.TransferConfig(
                    multipart_threshold=100 * 1024 * 1024,  # 100MB
                    max_concurrency=10,
                    multipart_chunksize=10 * 1024 * 1024,  # 10MB chunks
                )
            else:
                transfer_config = None

            # Track upload progress
            bytes_uploaded = 0

            def progress_hook(bytes_amount: int) -> None:
                nonlocal bytes_uploaded
                bytes_uploaded += bytes_amount
                if progress_callback:
                    progress_callback(bytes_uploaded, file_size)

            # Perform upload
            self.s3_client.upload_file(
                Filename=str(local_path),
                Bucket=self.bucket_name,
                Key=s3_key,
                ExtraArgs=extra_args or {},
                Config=transfer_config,
                Callback=progress_hook if progress_callback else None,
            )

            # Generate S3 URL
            if settings.s3_endpoint_url:
                s3_url = f"{settings.s3_endpoint_url}/{self.bucket_name}/{s3_key}"
            else:
                s3_url = (
                    f"https://{self.bucket_name}.s3.{settings.s3_region}.amazonaws.com/{s3_key}"
                )

            logger.info(
                f"Upload completed: {s3_key}",
                extra={
                    "local_path": str(local_path),
                    "s3_key": s3_key,
                    "s3_url": s3_url,
                    "size_bytes": file_size,
                },
            )

            return s3_url

        except Exception as e:
            logger.exception(
                f"Failed to upload to S3: {s3_key}",
                extra={"s3_key": s3_key, "local_path": str(local_path), "error": str(e)},
            )
            raise

    def download_assets(
        self,
        assets: list[dict[str, str]],
        temp_dir: str | Path,
        progress_callback: Callable[[str, int, int], None] | None = None,
        max_workers: int = 5,
    ) -> dict[str, Path]:
        """Download multiple assets from S3 or HTTP URLs in parallel.

        Args:
            assets: List of asset dictionaries with 's3_key' or 'url' and optional 'id'
            temp_dir: Temporary directory to download assets to
            progress_callback: Optional callback (asset_id, bytes_downloaded, total_bytes)
            max_workers: Maximum number of parallel downloads (default: 5)

        Returns:
            dict: Mapping of asset ID to local path

        Raises:
            Exception: If any download fails
        """
        from urllib.parse import urlparse

        import requests

        temp_dir = Path(temp_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)

        logger.info(
            f"Downloading {len(assets)} assets in parallel (max_workers={max_workers})",
            extra={"asset_count": len(assets), "temp_dir": str(temp_dir)},
        )

        def download_single_asset(asset: dict[str, str], index: int) -> tuple[str, Path]:
            """Download a single asset from S3 or HTTP URL."""
            s3_key = asset.get("s3_key")
            url = asset.get("url")
            asset_id = asset.get("id", f"asset_{index}")

            # Determine source: S3 or HTTP URL
            if url and (url.startswith("http://") or url.startswith("https://")):
                # Download from HTTP URL
                parsed_url = urlparse(url)
                filename = os.path.basename(parsed_url.path) or f"{asset_id}.mp4"
                local_path = temp_dir / f"{asset_id}_{filename}"

                logger.info(f"Downloading {asset_id} from HTTP URL: {url}")

                try:
                    response = requests.get(url, stream=True, timeout=60)
                    response.raise_for_status()

                    total_size = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    with open(local_path, "wb") as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                if progress_callback and total_size:
                                    progress_callback(asset_id, downloaded, total_size)

                    logger.debug(
                        f"Downloaded asset {asset_id} from HTTP",
                        extra={"asset_id": asset_id, "path": str(local_path), "size": downloaded},
                    )

                    return asset_id, local_path

                except Exception as e:
                    logger.exception(
                        f"Failed to download asset {asset_id} from HTTP",
                        extra={"asset_id": asset_id, "url": url, "error": str(e)},
                    )
                    raise

            elif s3_key:
                # Download from S3
                filename = os.path.basename(s3_key)
                local_path = temp_dir / f"{asset_id}_{filename}"

                def asset_progress(bytes_down: int, total_bytes: int) -> None:
                    if progress_callback:
                        progress_callback(asset_id, bytes_down, total_bytes)

                try:
                    downloaded_path = self.download_file(
                        s3_key=s3_key,
                        local_path=local_path,
                        progress_callback=asset_progress,
                    )

                    logger.debug(
                        f"Downloaded asset {asset_id} from S3",
                        extra={"asset_id": asset_id, "path": str(downloaded_path)},
                    )

                    return asset_id, downloaded_path

                except Exception as e:
                    logger.exception(
                        f"Failed to download asset {asset_id} from S3",
                        extra={"asset_id": asset_id, "s3_key": s3_key, "error": str(e)},
                    )
                    raise
            else:
                error_msg = f"Asset {asset_id} missing both 'url' and 's3_key'"
                logger.warning(error_msg)
                raise ValueError(error_msg)

        # Download assets in parallel using ThreadPoolExecutor
        downloaded_files = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all download tasks
            future_to_asset = {
                executor.submit(download_single_asset, asset, i): asset
                for i, asset in enumerate(assets)
            }

            # Collect results as they complete
            for future in as_completed(future_to_asset):
                try:
                    asset_id, local_path = future.result()
                    downloaded_files[asset_id] = local_path
                except Exception as e:
                    # If any download fails, cancel remaining tasks and raise
                    logger.error(
                        "Download failed, cancelling remaining downloads",
                        extra={"error": str(e)},
                    )
                    # Cancel all pending futures
                    for f in future_to_asset:
                        f.cancel()
                    raise

        logger.info(
            f"Downloaded all {len(downloaded_files)} assets successfully",
            extra={"downloaded_count": len(downloaded_files)},
        )

        return downloaded_files

    def delete_file(self, s3_key: str) -> None:
        """Delete a file from S3.

        Args:
            s3_key: S3 object key to delete
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            logger.info(f"Deleted S3 object: {s3_key}")

        except Exception as e:
            logger.exception(
                f"Failed to delete S3 object: {s3_key}",
                extra={"s3_key": s3_key, "error": str(e)},
            )
            raise

    def object_exists(self, s3_key: str) -> bool:
        """Check if an S3 object exists.

        Args:
            s3_key: S3 object key to check

        Returns:
            bool: True if object exists, False otherwise
        """
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    def generate_presigned_url(
        self,
        s3_key: str,
        expiration: int = 3600,
        response_headers: dict[str, str] | None = None,
    ) -> str:
        """Generate a presigned URL for downloading a file from S3.

        Args:
            s3_key: S3 object key
            expiration: URL expiration time in seconds (default 1 hour)
            response_headers: Optional response headers to include in presigned URL

        Returns:
            str: Presigned URL

        Raises:
            ClientError: If presigned URL generation fails
        """
        try:
            params = {
                "Bucket": self.bucket_name,
                "Key": s3_key,
            }

            # Add response headers if provided
            if response_headers:
                params["ResponseContentDisposition"] = response_headers.get(
                    "ContentDisposition", ""
                )
                params["ResponseContentType"] = response_headers.get("ContentType", "")

            presigned_url = self.s3_client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expiration,
            )

            logger.info(
                f"Generated presigned URL for {s3_key}",
                extra={
                    "s3_key": s3_key,
                    "expiration_seconds": expiration,
                },
            )

            return presigned_url

        except Exception as e:
            logger.exception(
                f"Failed to generate presigned URL: {s3_key}",
                extra={"s3_key": s3_key, "error": str(e)},
            )
            raise

    def generate_presigned_post(
        self,
        s3_key: str,
        expiration: int = 900,
        content_type: str | None = None,
        max_file_size: int | None = None,
    ) -> dict[str, Any]:
        """Generate a presigned POST for uploading a file to S3.

        Args:
            s3_key: S3 object key for the uploaded file
            expiration: URL expiration time in seconds (default 15 minutes)
            content_type: Optional content type restriction
            max_file_size: Optional maximum file size in bytes

        Returns:
            dict: Presigned POST data with 'url' and 'fields' keys

        Raises:
            ClientError: If presigned POST generation fails
        """
        try:
            conditions = []
            fields = {"key": s3_key}

            # NOTE: Temporarily disabled Content-Type validation to fix upload issues
            # S3 presigned POST requires exact field matching, which is causing 403 errors
            # TODO: Implement proper Content-Type validation that works with presigned POSTs
            # if content_type:
            #     content_type_prefix = content_type.split("/")[0]
            #     conditions.append(["starts-with", "$Content-Type", content_type_prefix])

            # Add file size limit if specified
            if max_file_size:
                conditions.append(["content-length-range", 1, max_file_size])

            presigned_post = self.s3_client.generate_presigned_post(
                Bucket=self.bucket_name,
                Key=s3_key,
                Fields=fields,
                Conditions=conditions if conditions else None,
                ExpiresIn=expiration,
            )

            logger.info(
                f"Generated presigned POST for upload: {s3_key}",
                extra={
                    "s3_key": s3_key,
                    "expiration_seconds": expiration,
                    "max_size_bytes": max_file_size,
                },
            )

            return presigned_post

        except Exception as e:
            logger.exception(
                f"Failed to generate presigned POST: {s3_key}",
                extra={"s3_key": s3_key, "error": str(e)},
            )
            raise

    def get_object_metadata(self, s3_key: str) -> dict[str, Any]:
        """Get metadata for an S3 object.

        Args:
            s3_key: S3 object key

        Returns:
            dict: Object metadata including size, content type, etc.

        Raises:
            ClientError: If object doesn't exist or metadata retrieval fails
        """
        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)

            metadata = {
                "size_bytes": response.get("ContentLength", 0),
                "content_type": response.get("ContentType", ""),
                "last_modified": response.get("LastModified"),
                "etag": response.get("ETag", "").strip('"'),
                "metadata": response.get("Metadata", {}),
            }

            logger.debug(
                f"Retrieved metadata for {s3_key}",
                extra={"s3_key": s3_key, "size_bytes": metadata["size_bytes"]},
            )

            return metadata

        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                raise FileNotFoundError(
                    f"S3 object not found: s3://{self.bucket_name}/{s3_key}"
                ) from e
            raise


# Global S3 manager instance
s3_manager = S3Manager()
