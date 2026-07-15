from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any, List, Optional

class Modality(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT_TO_SPEECH = "text_to_speech"
    UPSCALE = "upscale"
    CLASSIFY = "classify"

class IStorageBackend(ABC):
    """
    DIP: Abstraction for Object Storage (e.g. Backblaze B2, S3, or Local Verifiable Fallback).
    """
    @abstractmethod
    def upload_asset(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        pass

    @abstractmethod
    def upload_manifest(self, manifest_json: str, run_id: str) -> str:
        pass

    @abstractmethod
    def list_assets(self, project_id: str) -> List[Dict[str, Any]]:
        pass

class IMediaPipelineService(ABC):
    """
    DIP: Abstraction for Genblaze Generative Media Pipeline.
    Supports single-step or multi-step chained runs with SHA-256 verifiable manifests.
    """
    @abstractmethod
    def generate_media(
        self,
        project_id: str,
        prompt: str,
        modality: Modality,
        model_name: str,
        chain: bool = False,
        parent_url: str = ""
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def upload_media(
        self,
        project_id: str,
        file_bytes: bytes,
        filename: str,
        content_type: str
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def list_project_media(self, project_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def verify_provenance(self, manifest_hash: str) -> Dict[str, Any]:
        pass
