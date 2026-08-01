import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from fastapi.responses import FileResponse

# Load environment variables from .env file
base_dir = Path(__file__).resolve().parent.parent
env_path = base_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

from app.api.routes import router

app = FastAPI(title="Gen Mind Generative Media Studio & API Engine")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local static public serving directory
static_dir = base_dir / "static"
public_dir = static_dir / "public"
public_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(router)

# Mount frontend dist bundle if available (single container deployment)
dist_dir = base_dir / "dist"
if not dist_dir.exists():
    dist_dir = base_dir.parent / "frontend" / "dist"

if dist_dir.exists():
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("static/"):
            return {"error": "Endpoint not found"}
        target_file = dist_dir / full_path
        if full_path and target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(dist_dir / "index.html")
else:
    @app.get("/")
    def read_root():
        return {
            "status": "online",
            "service": "Gen Mind Generative Media Engine",
            "storage": "Local Public Serving (/static/public/)",
            "image_model": os.getenv("DASHSCOPE_IMAGE_MODEL", "z-image-turbo"),
            "text_model": os.getenv("DASHSCOPE_TEXT_MODEL", "qwen3.5-flash")
        }
