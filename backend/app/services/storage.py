"""MinIO object storage helpers — centralised for reuse across modules."""
import io
from datetime import timedelta
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.config import get_settings

settings = get_settings()
_client: Optional[Minio] = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket(bucket: str) -> None:
    client = get_minio()
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def upload_bytes(
    bucket: str,
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> None:
    client = get_minio()
    ensure_bucket(bucket)
    client.put_object(
        bucket,
        object_name,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )


def presigned_get_url(
    bucket: str,
    object_name: str,
    expires_seconds: int = 3600,
) -> str:
    client = get_minio()
    url = client.presigned_get_object(
        bucket, object_name, expires=timedelta(seconds=expires_seconds)
    )
    # If a public-facing base URL is configured, rewrite the internal Docker
    # hostname so that browsers outside the Docker network can access the URL.
    if settings.minio_public_url:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(url)
        public = urlparse(settings.minio_public_url)
        # Replace scheme, netloc and inject the public base path
        new_path = public.path.rstrip("/") + "/" + bucket + "/" + object_name.lstrip("/")
        # Preserve the query string (presigned signature params)
        url = urlunparse((public.scheme, public.netloc, new_path, "", parsed.query, ""))
    return url


def download_bytes(bucket: str, object_name: str) -> bytes:
    client = get_minio()
    response = client.get_object(bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_object(bucket: str, object_name: str) -> None:
    try:
        get_minio().remove_object(bucket, object_name)
    except S3Error:
        pass
