import json
import os
import urllib.request
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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

class SourceAddRequest(BaseModel):
    session_id: str
    sources: List[Dict[str, Any]]

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
    source_urls: Optional[List[Optional[str]]] = []
    source_assets: Optional[List[Optional[str]]] = []
    source_context: Optional[List[Optional[str]]] = []

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
    stats = {}
    if is_b2:
        try:
            stats = _storage.get_storage_stats()
        except Exception:
            pass
    return {
        "engine": "Backblaze B2 Cloud Storage (genblaze-s3 S3StorageBackend)" if is_b2 else "Local Storage",
        "sdk": "genblaze-s3" if is_b2 else "local",
        "is_b2": is_b2,
        "bucket": getattr(_storage, "bucket_name", None),
        "endpoint": getattr(_storage, "endpoint_url", None),
        "region": getattr(_storage, "region_name", None),
        "stats": stats,
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

@router.get("/info")
def get_app_info() -> Dict[str, Any]:
    """Comprehensive info endpoint for hackathon submission — lists all AI providers, models, and infrastructure."""
    is_b2 = isinstance(_storage, BackblazeB2StorageBackend)
    return {
        "app": "Gen_Mind — AI-Powered NotebookLM & Generative Media Studio",
        "description": "Multi-modal AI media generation platform: upload sources → generate AI video explanations and podcast discussions → store to Backblaze B2.",
        "version": "2.0.0",
        "hackathon": "Backblaze Generative Media Hackathon 2026",
        "providers": [
            {
                "name": "DashScope (Alibaba Cloud)",
                "type": "Text Generation + Image Generation",
                "models": [
                    os.getenv("DASHSCOPE_TEXT_MODEL", "qwen3.5-flash"),
                    os.getenv("DASHSCOPE_IMAGE_MODEL", "z-image-turbo"),
                ],
                "role": "Script generation, image synthesis for video scenes",
            },
            {
                "name": "Microsoft Edge TTS",
                "type": "Neural Speech Synthesis",
                "models": ["en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural", "en-IN-NeerjaNeural", "en-GB-SoniaNeural"],
                "role": "Multi-speaker podcast voices and video narration",
            },
        ],
        "genblaze": {
            "sdk_version": "0.4.5",
            "storage_sdk": "genblaze-s3 v0.3.6",
            "components_used": [
                "Pipeline — multi-step generative media orchestration",
                "SyncProvider — custom DashScope/Qwen text+image provider",
                "Manifest — provenance tracking for every generated asset",
                "PipelineResult — canonical hash + run metadata",
                "genblaze_s3.S3StorageBackend — native B2 storage backend",
            ],
        },
        "storage": {
            "provider": "Backblaze B2 Cloud Storage" if is_b2 else "Local Storage",
            "sdk": "genblaze-s3 S3StorageBackend",
            "bucket": getattr(_storage, "bucket_name", None),
            "region": getattr(_storage, "region_name", None),
            "endpoint": getattr(_storage, "endpoint_url", None),
            "access": "Private bucket — S3 Presigned URLs (AWS4-HMAC-SHA256, 24h expiry)",
            "prefixes": {"videos": "videos/", "audio": "audio/", "images": "images/", "manifests": "manifests/"},
        },
        "capabilities": [
            "Video Explanation: AI-generated 16:9 images + neural narration → MP4 stored on B2",
            "Podcast Audio: Multi-speaker dialogue with synchronized transcript → MP3 stored on B2",
            "Source Intake: Web scraping, PDF/DOCX parsing → appended to session knowledge base",
            "Provenance Manifests: GenBlaze Manifest JSON for every generation → stored under manifests/ on B2",
            "Session Isolation: Each notebook's media is strictly filtered per session",
            "Depth Modes: Short (2.5min), Critical (5-7min), Deep (20-45min)",
        ],
    }

@router.get("/provenance/{output_id}")
def get_provenance(output_id: str) -> Dict[str, Any]:
    """Retrieve the stored GenBlaze provenance manifest for a generated output."""
    with session_db._connect() as conn:
        row = conn.execute(
            "SELECT provenance_json, output_mode, output_url, created_at FROM session_outputs WHERE id = ?",
            (output_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Output not found.")
    try:
        provenance = json.loads(row["provenance_json"] or "{}")
    except Exception:
        provenance = {}
    return {
        "output_id": output_id,
        "output_mode": row["output_mode"],
        "output_url": row["output_url"],
        "created_at": row["created_at"],
        "provenance": provenance,
    }

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
async def upload_source_document(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    intake: SourceIntakeService = Depends(get_intake)
) -> Dict[str, Any]:
    try:
        data = await file.read()
        res = intake.ingest_document(file.filename or "source", data, file.content_type or "application/octet-stream")
        if session_id and res.get("status") == "ready":
            session_db.add_session_sources(session_id, [res])
        return res
    except SourceIntakeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.post("/studio/sources/add")
def add_sources_to_session(req: SourceAddRequest) -> Dict[str, Any]:
    if req.session_id and req.sources:
        ready = [s for s in req.sources if s.get("status") == "ready"]
        if ready:
            session_db.add_session_sources(req.session_id, ready)
    return {"added": len(req.sources)}

# ─── Studio Generate ──────────────────────────────────────────────────────────

@router.post("/studio/generate")
def generate_learning_media(req: StudioGenerateRequest, studio: LearningStudioPipeline = Depends(get_studio)) -> Dict[str, Any]:
    if req.output_mode == "conversation" and not 1 <= req.participant_count <= 4:
        raise HTTPException(status_code=422, detail="Podcast audio requires between 1 and 4 participants.")

    # Clean and filter out any None or empty items
    clean_urls = [u for u in (req.source_urls or []) if u]
    clean_assets = [a for a in (req.source_assets or []) if a]
    clean_context = [c for c in (req.source_context or []) if c]

    if req.session_id:
        full_content = get_session_content(req.session_id)
        if full_content.strip():
            clean_context = [full_content]

    brief_data = req.model_dump(exclude={"session_id"})
    brief_data["source_urls"] = clean_urls
    brief_data["source_assets"] = clean_assets
    brief_data["source_context"] = clean_context
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
            items=items,
            provenance=result.get("provenance"),
        )

    return result
