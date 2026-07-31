import os
import urllib.request
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.media_interfaces import IStorageBackend
from app.repositories.local_storage import LocalStorageBackend
from app.repositories.b2_storage import BackblazeB2StorageBackend
from app.repositories import session_db
from app.repositories.session_db import get_session_content
from app.services.source_intake import SourceIntakeError, SourceIntakeService
from app.services.studio_pipeline import AZURE_VOICES, LearningStudioPipeline, StudioBrief

router = APIRouter(prefix="/api")

def get_storage_backend() -> IStorageBackend:
    b2_key = os.getenv("B2_KEY_ID", "")
    b2_bucket = os.getenv("B2_BUCKET_NAME", "")
    if b2_key and b2_bucket:
        try:
            return BackblazeB2StorageBackend()
        except Exception:
            pass
    return LocalStorageBackend()

_storage = get_storage_backend()
_studio = LearningStudioPipeline(_storage)
_intake = SourceIntakeService(_storage)

def get_studio() -> LearningStudioPipeline: return _studio
def get_intake() -> SourceIntakeService: return _intake

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class StudioGenerateRequest(BaseModel):
    project_id: str = "learning_studio"
    session_id: Optional[str] = None
    topic: str
    image_count: int = 6
    depth_level: Literal["short", "critical", "depth"] = "critical"
    image_style: str = "Clean Editorial"
    language: str = "en-US"
    output_mode: Literal["video", "conversation"] = "video"
    voice: str = "en-US-JennyNeural"
    podcast_tone: Literal["friendly", "serious", "deep_dive"] = "friendly"
    participant_count: int = 2
    participant_voices: List[str] = []
    source_urls: List[str] = []
    source_assets: List[str] = []
    source_context: List[str] = []

class SourceInspectRequest(BaseModel):
    urls: List[str]
    deep_research: bool = False
    session_id: Optional[str] = None

class SessionCreateRequest(BaseModel):
    device_id: str
    title: str = "New Media"
    mode: str = "video"

class SessionUpdateRequest(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None

# ─── Studio Voices ────────────────────────────────────────────────────────────

@router.get("/storage/info")
def get_storage_info() -> Dict[str, Any]:
    is_b2 = isinstance(_storage, BackblazeB2StorageBackend)
    return {
        "engine": "Backblaze B2 Cloud Storage" if is_b2 else "Local Storage",
        "is_b2": is_b2,
        "bucket": getattr(_storage, "bucket_name", None),
        "endpoint": getattr(_storage, "endpoint_url", None),
        "active": True
    }

@router.get("/media/stream")
def stream_media(url: str):
    """Secure streaming proxy for Backblaze B2 presigned URLs and static assets."""
    if not url:
        raise HTTPException(status_code=400, detail="URL query parameter is required.")
    try:
        if url.startswith("/static/"):
            url = f"http://localhost:8000{url}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=30)
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        return StreamingResponse(resp, media_type=content_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to stream media asset: {exc}")

@router.get("/studio/voices")
def list_studio_voices() -> List[Dict[str, str]]:
    return AZURE_VOICES

# ─── Sessions CRUD ────────────────────────────────────────────────────────────

@router.post("/sessions")
def create_session(req: SessionCreateRequest) -> Dict[str, Any]:
    return session_db.create_session(req.device_id, req.title, req.mode)

@router.get("/sessions")
def list_sessions(device_id: str) -> List[Dict[str, Any]]:
    if not device_id:
        raise HTTPException(status_code=422, detail="device_id is required.")
    return session_db.list_sessions(device_id)

@router.get("/sessions/{session_id}")
def get_session(session_id: str) -> Dict[str, Any]:
    s = session_db.get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found.")
    raw_sources = session_db.get_session_sources(session_id)
    sources = []
    for src in raw_sources:
        try:
            src["deep_pages"] = json.loads(src.get("deep_pages") or "[]")
        except Exception:
            src["deep_pages"] = []
        src["is_subpage"] = bool(src.get("is_subpage"))
        src["status"] = "ready"
        sources.append(src)
    s["sources"] = sources
    s["outputs"] = session_db.get_session_outputs(session_id)
    return s

@router.patch("/sessions/{session_id}")
def update_session(session_id: str, req: SessionUpdateRequest) -> Dict[str, Any]:
    updates = req.model_dump(exclude_none=True)
    result = session_db.update_session(session_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found.")
    return result

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str) -> Dict[str, Any]:
    ok = session_db.delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"deleted": session_id}

# ─── Sources ──────────────────────────────────────────────────────────────────

@router.post("/studio/sources/inspect")
def inspect_sources(req: SourceInspectRequest, intake: SourceIntakeService = Depends(get_intake)) -> List[Dict[str, Any]]:
    if not 1 <= len(req.urls) <= 10:
        raise HTTPException(status_code=422, detail="Provide between 1 and 10 source URLs.")
    results = intake.inspect_urls(req.urls, deep_research=req.deep_research)
    if req.session_id:
        ready = [s for s in results if s.get("status") == "ready"]
        if ready:
            session_db.add_session_sources(req.session_id, ready)
    return results

@router.post("/studio/sources/upload")
async def upload_source_document(file: UploadFile = File(...), intake: SourceIntakeService = Depends(get_intake)) -> Dict[str, Any]:
    try:
        data = await file.read()
        return intake.ingest_document(file.filename or "source", data, file.content_type or "application/octet-stream")
    except SourceIntakeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

# ─── Studio Generate ──────────────────────────────────────────────────────────

@router.post("/studio/generate")
def generate_learning_media(req: StudioGenerateRequest, studio: LearningStudioPipeline = Depends(get_studio)) -> Dict[str, Any]:
    if req.output_mode == "conversation" and not 1 <= req.participant_count <= 4:
        raise HTTPException(status_code=422, detail="Podcast audio requires between 1 and 4 participants.")

    # Use full accumulated session content as the knowledge base when available
    source_context = req.source_context
    if req.session_id:
        full_content = get_session_content(req.session_id)
        if full_content.strip():
            source_context = [full_content]

    brief_data = req.model_dump(exclude={"session_id"})
    brief_data["source_context"] = source_context
    result = studio.run(StudioBrief(**brief_data))

    # Persist to SQLite session if session_id provided
    if req.session_id:
        session_db.update_session(req.session_id, title=req.topic, mode=req.output_mode)
        items = result.get("turns") or result.get("scenes") or result.get("images") or []
        session_db.save_session_output(
            session_id=req.session_id,
            output_mode=result.get("mode", req.output_mode),
            output_url=result.get("output_url", ""),
            narration=result.get("narration", ""),
            stages=result.get("stages", []),
            items=items
        )


    return result
