from abc import ABC, abstractmethod
from typing import Any, Dict, List

class IStorageBackend(ABC):
    """Storage boundary for B2 assets and provenance packages."""
    @abstractmethod
    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str: pass
    @abstractmethod
    def upload_manifest(self, manifest_json: str, run_id: str) -> str: pass
    @abstractmethod
    def list_assets(self, project_id: str) -> List[Dict[str, Any]]: pass
