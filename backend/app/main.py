import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import router

app = FastAPI(title="GenMind & Genblaze Media Core API")

# Configure CORS to permit calls from Vite Dev Server (http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static/b2_assets directory exists and mount static serving
base_dir = Path(__file__).resolve().parent.parent
static_dir = base_dir / "static"
static_dir.mkdir(parents=True, exist_ok=True)
(static_dir / "b2_assets").mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Mount SOLID-based routing endpoints
app.include_router(router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "GenMind AI Core API + Genblaze Media Pipeline SDK",
        "storage_sink": "Backblaze B2 Object Lock Registry"
    }
