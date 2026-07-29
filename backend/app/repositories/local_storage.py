from __future__ import annotations
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List
from app.core.media_interfaces import IStorageBackend

class LocalStorageBackend(IStorageBackend):
    """Clean local public file system storage engine for static media & manifests."""
    def __init__(self, public_dir: str | Path | None = None):
        if public_dir is None:
            base_dir = Path(__file__).resolve().parent.parent.parent
            public_dir = base_dir / "static" / "public"
        self.public_dir = Path(public_dir)
        self.public_dir.mkdir(parents=True, exist_ok=True)

    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        clean_filename = f"{uuid.uuid4().hex[:8]}_{Path(filename).name}"
        target_path = self.public_dir / clean_filename
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        return f"/static/public/{clean_filename}"

    def upload_manifest(self, manifest_json: str, run_id: str) -> str:
        clean_filename = f"manifest_{run_id}.json"
        target_path = self.public_dir / clean_filename
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(manifest_json)
        return f"/static/public/{clean_filename}"

    def list_assets(self, project_id: str) -> List[Dict[str, Any]]:
        results = []
        for file in self.public_dir.glob("*"):
            if file.is_file():
                results.append({
                    "name": file.name,
                    "url": f"/static/public/{file.name}",
                    "size": file.stat().st_size
                })
        return results
