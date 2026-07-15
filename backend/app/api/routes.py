from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Header
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json

from app.core.media_interfaces import IMediaPipelineService, IStorageBackend, Modality
from app.repositories.b2_storage import BackblazeB2Storage
from app.services.genblaze_service import GenblazePipelineService
from app.repositories.db_repository import UniversalMediaRepository

router = APIRouter(prefix="/api")

# DIP Dependency Resolvers
_b2_storage_singleton = BackblazeB2Storage()
_genblaze_service_singleton = GenblazePipelineService(_b2_storage_singleton)
_db_repo = UniversalMediaRepository()

def get_b2_storage() -> IStorageBackend:
    return _b2_storage_singleton

def get_media_pipeline_service() -> IMediaPipelineService:
    return _genblaze_service_singleton

def get_db_repo() -> UniversalMediaRepository:
    return _db_repo

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
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service),
    db_repo: UniversalMediaRepository = Depends(get_db_repo),
    device_id: Optional[str] = Header("DEV_DEFAULT", alias="X-Device-Id"),
    device_name: Optional[str] = Header("Workstation-PC", alias="X-Device-Name")
) -> Dict[str, Any]:
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

    db_repo.log_event(
        device_id=device_id or "DEV_DEFAULT",
        device_name=device_name or "Workstation-PC",
        project_id=req.project_id,
        event_type="MEDIA_GENERATE",
        payload={"prompt": req.prompt, "modality": req.modality, "asset": result["asset_record"]}
    )

    db_repo.save_asset(
        device_id=device_id or "DEV_DEFAULT",
        project_id=req.project_id,
        asset=result["asset_record"]
    )

    return result

@router.post("/media/upload")
async def upload_media_endpoint(
    file: UploadFile = File(...),
    project_id: str = Form("default_project"),
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service),
    db_repo: UniversalMediaRepository = Depends(get_db_repo),
    device_id: Optional[str] = Header("DEV_DEFAULT", alias="X-Device-Id"),
    device_name: Optional[str] = Header("Workstation-PC", alias="X-Device-Name")
) -> Dict[str, Any]:
    file_bytes = await file.read()
    asset_record = pipeline.upload_media(
        project_id=project_id,
        file_bytes=file_bytes,
        filename=file.filename or "uploaded_clip.mp4",
        content_type=file.content_type or "application/octet-stream"
    )

    db_repo.log_event(
        device_id=device_id or "DEV_DEFAULT",
        device_name=device_name or "Workstation-PC",
        project_id=project_id,
        event_type="MEDIA_UPLOAD",
        payload={"filename": file.filename, "asset": asset_record}
    )

    db_repo.save_asset(
        device_id=device_id or "DEV_DEFAULT",
        project_id=project_id,
        asset=asset_record
    )

    return {"status": "success", "asset": asset_record}

@router.get("/media/{project_id}")
def list_media_endpoint(
    project_id: str,
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service),
    db_repo: UniversalMediaRepository = Depends(get_db_repo)
) -> List[Dict[str, Any]]:
    db_assets = db_repo.get_assets_by_project(project_id)
    try:
        pipeline_assets = pipeline.list_project_media(project_id)
    except Exception:
        pipeline_assets = []
    
    merged = {a["id"]: a for a in pipeline_assets}
    for a in db_assets:
        if a.get("id") not in merged:
            merged[a["id"]] = a
    return list(merged.values())

@router.get("/media/verify/{manifest_hash}")
def verify_manifest_endpoint(
    manifest_hash: str,
    pipeline: IMediaPipelineService = Depends(get_media_pipeline_service)
) -> Dict[str, Any]:
    return pipeline.verify_provenance(manifest_hash)

class DeviceProjectSaveRequest(BaseModel):
    device_id: str
    device_name: str
    project: Dict[str, Any]
    assets: List[Dict[str, Any]]

@router.get("/device/projects")
def get_device_projects_endpoint(
    device_id: str = "DEV_DEFAULT",
    db_repo: UniversalMediaRepository = Depends(get_db_repo)
) -> List[Dict[str, Any]]:
    return db_repo.get_projects_by_device(device_id)

@router.post("/device/projects")
def save_device_project_endpoint(
    req: DeviceProjectSaveRequest,
    db_repo: UniversalMediaRepository = Depends(get_db_repo)
) -> Dict[str, str]:
    db_repo.save_project(req.device_id, req.device_name, req.project, req.assets)
    db_repo.log_event(
        device_id=req.device_id,
        device_name=req.device_name,
        project_id=req.project.get("id", "default"),
        event_type="PROJECT_SAVE",
        payload={"project_name": req.project.get("name"), "assets_count": len(req.assets)}
    )
    return {"status": "saved"}

class LogEventRequest(BaseModel):
    event_type: str
    payload: Dict[str, Any]

@router.get("/project/{project_id}/events")
def get_project_events_endpoint(
    project_id: str,
    db_repo: UniversalMediaRepository = Depends(get_db_repo)
) -> List[Dict[str, Any]]:
    """Retrieves all chronological drag/drop and editing events for this project."""
    return db_repo.get_events(project_id)

@router.post("/project/{project_id}/events")
def log_project_event_endpoint(
    project_id: str,
    req: LogEventRequest,
    db_repo: UniversalMediaRepository = Depends(get_db_repo),
    device_id: Optional[str] = Header("DEV_DEFAULT", alias="X-Device-Id"),
    device_name: Optional[str] = Header("Workstation-PC", alias="X-Device-Name")
) -> Dict[str, str]:
    db_repo.log_event(
        device_id=device_id or "DEV_DEFAULT",
        device_name=device_name or "Workstation-PC",
        project_id=project_id,
        event_type=req.event_type,
        payload=req.payload
    )
    return {"status": "logged"}
