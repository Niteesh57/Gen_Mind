"""
Backblaze B2 Cloud Storage engine using the official GenBlaze SDK (genblaze-s3).
Uses genblaze_s3.S3StorageBackend — the GenBlaze-native S3-compatible backend —
for all object uploads, presigned URL generation, and asset listing.
Private bucket access only: all URLs are S3 Presigned (AWS4-HMAC-SHA256).
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from genblaze_s3 import S3StorageBackend

from app.core.media_interfaces import IStorageBackend

# Load .env
base_dir = Path(__file__).resolve().parent.parent.parent
env_path = base_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)


class BackblazeB2StorageBackend(IStorageBackend):
    """
    Production-grade Backblaze B2 private bucket storage engine.

    Built on the official GenBlaze SDK (genblaze_s3.S3StorageBackend),
    which is the S3-compatible storage backend for GenBlaze — supporting
    Backblaze B2, Cloudflare R2, MinIO, and AWS S3 via endpoint_url.

    All assets remain 100% private. URLs are time-limited S3 Presigned URLs
    (AWS4-HMAC-SHA256) accessible only within this application.
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
            raise ValueError(
                "Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME) are required."
            )

        # Official GenBlaze SDK S3-compatible storage backend
        self._backend = S3StorageBackend(
            bucket=self.bucket_name,
            endpoint_url=self.endpoint_url,
            region=self.region_name,
            access_key_id=self.key_id,
            secret_access_key=self.application_key,
        )

    # ── Public helpers ────────────────────────────────────────────────────────

    def get_presigned_url(self, key: str, expires_in: int = 86400) -> str:
        """
        Generate a secure S3 Presigned URL for a private B2 object via genblaze-s3.
        Default expiration: 24 hours (86,400 seconds).
        """
        clean_key = key.lstrip("/")
        return self._backend.presigned_get_url(clean_key, expires_in=expires_in)

    # ── IStorageBackend interface ─────────────────────────────────────────────

    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """
        Upload binary asset (MP4, MP3, PNG) to private B2 bucket via genblaze-s3.
        Returns a secure S3 Presigned URL for in-app media playback.
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

        # Use genblaze-s3 S3StorageBackend.put() for upload
        self._backend.put(key, file_bytes, content_type=content_type)
        return self.get_presigned_url(key)

    def upload_manifest(self, manifest_json: str, run_id: str) -> str:
        """
        Upload a GenBlaze provenance JSON manifest to B2 under /manifests prefix.
        Returns a secure S3 Presigned URL for in-app retrieval.
        """
        key = f"manifests/manifest_{run_id}.json"
        self._backend.put(key, manifest_json.encode("utf-8"), content_type="application/json")
        return self.get_presigned_url(key)

    def list_assets(self, project_id: str) -> List[Dict[str, Any]]:
        """
        List stored assets from private B2 bucket via genblaze-s3, with Presigned URLs.
        """
        results = []
        try:
            page = self._backend.list(max_keys=100)
            for entry in page.entries:
                results.append({
                    "name": Path(entry.key).name,
                    "key": entry.key,
                    "url": self.get_presigned_url(entry.key),
                    "size": entry.size or 0,
                    "last_modified": entry.last_modified.isoformat() if entry.last_modified else "",
                })
        except Exception:
            pass
        return results

    def get_storage_stats(self) -> Dict[str, Any]:
        """Return bucket stats for the B2 storage dashboard."""
        try:
            page = self._backend.list(max_keys=1000)
            entries = page.entries
            total_size = sum(e.size or 0 for e in entries)
            by_type = {"videos": 0, "audio": 0, "images": 0, "manifests": 0, "assets": 0}
            for e in entries:
                prefix = e.key.split("/")[0] if "/" in e.key else "assets"
                by_type[prefix] = by_type.get(prefix, 0) + 1
            return {
                "total_objects": len(entries),
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "by_type": by_type,
            }
        except Exception:
            return {"total_objects": 0, "total_size_bytes": 0, "total_size_mb": 0, "by_type": {}}
