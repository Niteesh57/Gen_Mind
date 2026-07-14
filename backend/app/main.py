from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(title="GenMind AI Core Service API")

# Configure CORS to permit calls from Vite Dev Server (usually http://localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific domains in production environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount SOLID-based routing endpoints
app.include_router(router)

@app.get("/")
def read_root():
    return {"status": "online", "service": "GenMind AI Core API"}
