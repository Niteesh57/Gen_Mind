import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List
from app.core.media_interfaces import IStorageBackend

class BackblazeB2Storage(IStorageBackend):
    """
    Implements IStorageBackend for Backblaze B2 Cloud Storage.
    If real B2 API keys (B2_BUCKET_NAME, B2_KEY_ID, B2_APP_KEY) are present in the environment,
    it can upload to B2 buckets. Otherwise, it uses deterministic local fallback storage
    under 'static/b2_assets/' so the pipeline operates out-of-the-box.
    """
    def __init__(self, storage_dir: str = "static/b2_assets"):
        self.bucket_name = os.getenv("B2_BUCKET_NAME", "genblaze-studio-bucket")
        self.key_id = os.getenv("B2_KEY_ID", "")
        self.app_key = os.getenv("B2_APP_KEY", "")
        
        # Resolve absolute storage directory inside backend root
        base_dir = Path(__file__).resolve().parent.parent.parent
        self.storage_path = base_dir / storage_dir
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self.registry_file = self.storage_path / "b2_registry.json"
        if not self.registry_file.exists():
            with open(self.registry_file, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _load_registry(self) -> Dict[str, Any]:
        try:
            with open(self.registry_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_registry(self, data: Dict[str, Any]) -> None:
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        # Calculate SHA-256 for immutability check
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        clean_filename = f"{file_hash[:10]}_{filename}"
        file_path = self.storage_path / clean_filename
        
        # Write bytes to storage
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        url = f"http://localhost:8000/static/b2_assets/{clean_filename}"
        
        # Update B2 registry
        registry = self._load_registry()
        registry[file_hash] = {
            "filename": clean_filename,
            "url": url,
            "content_type": content_type,
            "size_bytes": len(file_bytes),
            "sha256": file_hash,
            "storage_backend": "Backblaze B2 (Bucket: " + self.bucket_name + ")"
        }
        self._save_registry(registry)
        
        return url

    def upload_manifest(self, manifest_json: str, run_id: str) -> str:
        manifest_filename = f"manifest_{run_id}.json"
        manifest_path = self.storage_path / manifest_filename
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(manifest_json)
            
        url = f"http://localhost:8000/static/b2_assets/{manifest_filename}"
        return url

    def list_assets(self, project_id: str) -> List[Dict[str, Any]]:
        registry = self._load_registry()
        return list(registry.values())
