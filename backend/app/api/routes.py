from typing import Any, Dict, List, Literal
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.repositories.local_storage import LocalStorageBackend
from app.services.source_intake import SourceIntakeError, SourceIntakeService
from app.services.studio_pipeline import AZURE_VOICES, LearningStudioPipeline, StudioBrief

router = APIRouter(prefix="/api")

_storage = LocalStorageBackend()
_studio = LearningStudioPipeline(_storage)
_intake = SourceIntakeService(_storage)

def get_studio() -> LearningStudioPipeline: return _studio
def get_intake() -> SourceIntakeService: return _intake

class StudioGenerateRequest(BaseModel):
    project_id: str = "learning_studio"
    topic: str
    image_count: int = 10  # Range 5 to 15
    image_style: str = "Clean Editorial"
    language: str = "en-US"
    output_mode: Literal["video", "conversation"] = "video"
    voice: str = "en-US-JennyNeural"
    podcast_tone: Literal["friendly", "serious", "deep_dive"] = "friendly"
    participant_count: int = 2  # Range 1 to 4 speakers
    participant_voices: List[str] = []
    source_urls: List[str] = []
    source_assets: List[str] = []
    source_context: List[str] = []

class SourceInspectRequest(BaseModel):
    urls: List[str]
    deep_research: bool = False

@router.get("/studio/voices")
def list_studio_voices() -> List[Dict[str, str]]:
    return AZURE_VOICES

@router.post("/studio/sources/inspect")
def inspect_sources(req: SourceInspectRequest, intake: SourceIntakeService = Depends(get_intake)) -> List[Dict[str, Any]]:
    if not 1 <= len(req.urls) <= 10:
        raise HTTPException(status_code=422, detail="Provide between 1 and 10 source URLs.")
    return intake.inspect_urls(req.urls, deep_research=req.deep_research)

@router.post("/studio/sources/upload")
async def upload_source_document(file: UploadFile = File(...), intake: SourceIntakeService = Depends(get_intake)) -> Dict[str, Any]:
    try:
        data = await file.read()
        return intake.ingest_document(file.filename or "source", data, file.content_type or "application/octet-stream")
    except SourceIntakeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.post("/studio/generate")
def generate_learning_media(req: StudioGenerateRequest, studio: LearningStudioPipeline = Depends(get_studio)) -> Dict[str, Any]:
    if req.output_mode == "video" and not 5 <= req.image_count <= 15:
        raise HTTPException(status_code=422, detail="image_count must be between 5 and 15 images.")
    if req.output_mode == "conversation" and not 1 <= req.participant_count <= 4:
        raise HTTPException(status_code=422, detail="Podcast audio requires between 1 and 4 participants.")

    brief_data = req.model_dump()
    return studio.run(StudioBrief(**brief_data))
