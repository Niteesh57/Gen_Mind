"""Backblaze B2 S3-Compatible Private Cloud Storage Engine with Presigned URL Authorization for GenBlaze Media Assets."""
from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
import boto3
from dotenv import load_dotenv

from app.core.media_interfaces import IStorageBackend

# Load .env
base_dir = Path(__file__).resolve().parent.parent.parent
env_path = base_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

class BackblazeB2StorageBackend(IStorageBackend):
    """
    Production-grade Backblaze B2 private bucket storage engine using S3-compatible API.
    Supports secure S3 Presigned URLs (Auth Key based) so assets remain 100% private
    and are accessible strictly within your application.
    """
    def __init__(
        self,
        key_id: Optional[str] = None,
        application_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        region_name: Optional[str] = None,
    ):
        self.key_id = key_id or os.getenv("B2_KEY_ID", "")
        self.application_key = application_key or os.getenv("B2_APPLICATION_KEY", "")
        self.bucket_name = bucket_name or os.getenv("B2_BUCKET_NAME", "")
        self.endpoint_url = endpoint_url or os.getenv("B2_ENDPOINT_URL", "https://s3.eu-central-003.backblazeb2.com")
        self.region_name = region_name or os.getenv("B2_REGION_NAME", "eu-central-003")

        if not self.key_id or not self.application_key or not self.bucket_name:
            raise ValueError("Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME) are required.")

        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=self.key_id,
            aws_secret_access_key=self.application_key,
            endpoint_url=self.endpoint_url,
            region_name=self.region_name,
        )

    def get_presigned_url(self, key: str, expires_in: int = 86400) -> str:
        """
        Generate a secure AWS4-HMAC-SHA256 S3 Presigned URL for private Backblaze B2 bucket object.
        Default expiration: 24 hours (86,400 seconds).
        """
        clean_key = key.lstrip("/")
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": clean_key},
            ExpiresIn=expires_in
        )

    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """
        Upload binary asset (MP4, MP3, PNG) to private Backblaze B2 bucket under directory prefix.
        Returns secure S3 Presigned URL for in-app media playback and viewing.
        """
        clean_name = Path(filename).name
        uid = uuid.uuid4().hex[:8]

        if content_type.startswith("video/") or clean_name.endswith(".mp4"):
            prefix = "videos"
        elif content_type.startswith("audio/") or clean_name.endswith(".mp3"):
            prefix = "audio"
        elif content_type.startswith("image/") or clean_name.endswith((".png", ".jpg", ".jpeg")):
            prefix = "images"
        else:
            prefix = "assets"

        key = f"{prefix}/{uid}_{clean_name}"

        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return self.get_presigned_url(key)

    def upload_manifest(self, manifest_json: str, run_id: str) -> str:
        """
        Upload GenBlaze provenance JSON manifest to private Backblaze B2 bucket under /manifests prefix.
        Returns secure S3 Presigned URL.
        """
        key = f"manifests/manifest_{run_id}.json"
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=manifest_json.encode("utf-8"),
            ContentType="application/json",
        )
        return self.get_presigned_url(key)

    def list_assets(self, project_id: str) -> List[Dict[str, Any]]:
        """
        List stored assets from private Backblaze B2 bucket with S3 Presigned URLs.
        """
        results = []
        try:
            resp = self.s3_client.list_objects_v2(Bucket=self.bucket_name, MaxKeys=100)
            contents = resp.get("Contents", [])
            for item in contents:
                key = item["Key"]
                results.append({
                    "name": Path(key).name,
                    "key": key,
                    "url": self.get_presigned_url(key),
                    "size": item.get("Size", 0),
                    "last_modified": item.get("LastModified", "").isoformat() if hasattr(item.get("LastModified"), "isoformat") else str(item.get("LastModified", "")),
                })
        except Exception:
            pass
        return results
