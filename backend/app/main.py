import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import router

app = FastAPI(title="GenMind NotebookLM & Media Core API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local static public serving directory
base_dir = Path(__file__).resolve().parent.parent
static_dir = base_dir / "static"
public_dir = static_dir / "public"
public_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "GenMind NotebookLM & Media Generation Engine",
        "storage": "Local Public Serving (/static/public/)"
    }
