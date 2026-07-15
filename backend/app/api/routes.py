from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional



from app.core.media_interfaces import IMediaPipelineService, IStorageBackend, Modality
from app.repositories.b2_storage import BackblazeB2Storage
from app.services.genblaze_service import GenblazePipelineService

router = APIRouter(prefix="/api")



# DIP Dependency Resolvers for Genblaze & B2 Storage
_b2_storage_singleton = BackblazeB2Storage()
_genblaze_service_singleton = GenblazePipelineService(_b2_storage_singleton)

def get_b2_storage() -> IStorageBackend:
    return _b2_storage_singleton

def get_media_pipeline_service() -> IMediaPipelineService:
    return _genblaze_service_singleton

class GenerateMediaRequest(BaseModel):
    project_id: str
    prompt: str
    modality: str = "video"
    model_name: str = "Kling-Image2Video-V2.1-Master"
    chain: bool = True
    parent_url: str = ""

@router.post("/media/generate")
def generate_media_endpoint(
    req: GenerateMediaRequest,
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service)
) -> Dict[str, Any]:
    """
    Runs Genblaze Generative Media Pipeline across providers (`Seedream`, `Kling`, `MiniMax`, `Veo`),
    supports step chaining (`chain=True`), generates SHA-256 verifiable manifest,
    and stores output inside Backblaze B2 Object Lock storage.
    """
    try:
        modality_enum = Modality(req.modality.lower())
    except ValueError:
        modality_enum = Modality.VIDEO

    result = pipeline.generate_media(
        project_id=req.project_id,
        prompt=req.prompt,
        modality=modality_enum,
        model_name=req.model_name,
        chain=req.chain,
        parent_url=req.parent_url
    )
    return result

@router.post("/media/upload")
async def upload_media_endpoint(
    file: UploadFile = File(...),
    project_id: str = Form("default_project"),
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service)
) -> Dict[str, Any]:
    """
    Clipchamp-inspired Drag & Drop upload directly to Backblaze B2 Object Lock storage.
    """
    file_bytes = await file.read()
    asset_record = pipeline.upload_media(
        project_id=project_id,
        file_bytes=file_bytes,
        filename=file.filename or "uploaded_clip.mp4",
        content_type=file.content_type or "application/octet-stream"
    )
    return {"status": "success", "asset": asset_record}

@router.get("/media/{project_id}")
def list_media_endpoint(
    project_id: str,
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service)
) -> List[Dict[str, Any]]:
    """Lists all generated AI assets and B2 uploaded files for a project."""
    return pipeline.list_project_media(project_id)

@router.get("/media/verify/{manifest_hash}")
def verify_manifest_endpoint(
    manifest_hash: str,
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service)
) -> Dict[str, Any]:
    """
    Verifies the cryptographic SHA-256 provenance manifest stored in Backblaze B2 Object Lock registry.
    """
    return pipeline.verify_provenance(manifest_hash)
