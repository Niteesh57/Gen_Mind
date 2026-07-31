# Gen_Mind — AI-Powered NotebookLM & Generative Media Studio

> **Backblaze Generative Media Hackathon 2026 Submission**  
> Build the next generation of AI media apps. Generate with GenBlaze. Store on Backblaze B2.

[![GenBlaze SDK](https://img.shields.io/badge/GenBlaze-v0.4.5-blue)](https://github.com/backblaze-labs/genblaze)
[![Backblaze B2](https://img.shields.io/badge/Storage-Backblaze%20B2-red)](https://www.backblaze.com/b2/cloud-storage.html)
[![Python](https://img.shields.io/badge/Python-3.11+-green)](https://python.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)

---

## What is Gen_Mind?

**Gen_Mind** is an AI-powered learning studio — like NotebookLM — that transforms any source material (web pages, PDFs, documents, or raw text) into rich generative media:

- 🎬 **AI Video Explanations** — AI-scripted, AI-illustrated 16:9 videos with neural narration
- 🎙 **AI Podcast Audio** — Multi-speaker dialogue podcasts with real-time synchronized transcripts
- 📚 **Smart Source Intake** — URL scraping, deep-crawl mode, PDF/DOCX parsing → accumulated session knowledge base
- ☁️ **Backblaze B2 Storage** — All generated media (MP4, MP3, PNG, manifests) stored privately on B2
- 🔍 **Provenance Manifests** — GenBlaze-native Manifest JSON for every generation, stored on B2

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Gen_Mind Studio                          │
│                                                                 │
│  React Frontend (Vite)                                          │
│  ┌────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Sources   │  │  Studio Options  │  │  Media History    │  │
│  │  Sidebar   │  │  (depth, mode,   │  │  (session-scoped) │  │
│  │            │  │   voice, style)  │  │  + Provenance     │  │
│  └────────────┘  └──────────────────┘  └───────────────────┘  │
│                                                                 │
│  FastAPI Backend                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  SourceIntakeService     LearningStudioPipeline          │  │
│  │  (URL/PDF ingestion)     (GenBlaze Pipeline + Steps)     │  │
│  │                                                          │  │
│  │  GenBlaze SDK v0.4.5                                     │  │
│  │  ├── Pipeline + Step orchestration                       │  │
│  │  ├── SyncProvider (DashScope/Qwen text + image)          │  │
│  │  ├── Manifest provenance tracking                        │  │
│  │  └── genblaze-s3 S3StorageBackend → Backblaze B2         │  │
│  │                                                          │  │
│  │  Edge TTS (Microsoft Neural Voices)                      │  │
│  │  MoviePy (video assembly)                                │  │
│  │  SQLite (session persistence)                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Backblaze B2 (Private Bucket)                                  │
│  ├── videos/     → MP4 video explanations                       │
│  ├── audio/      → MP3 podcast episodes                         │
│  ├── images/     → AI-generated scene frames (PNG)              │
│  └── manifests/  → GenBlaze provenance JSON                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## AI Providers & Models

| Provider | Type | Models Used | Role |
|---|---|---|---|
| **DashScope (Alibaba Cloud)** | Text Generation | `qwen3.5-flash` | Script writing, section outlines |
| **DashScope (Alibaba Cloud)** | Image Generation | `z-image-turbo` | 16:9 AI scene images |
| **Microsoft Edge TTS** | Neural Speech | `en-US-JennyNeural`, `en-US-GuyNeural`, `en-US-AriaNeural`, `en-IN-NeerjaNeural`, `en-GB-SoniaNeural`, + 3 more | Multi-speaker podcast voices & video narration |

---

## GenBlaze & B2 Usage

### GenBlaze SDK Components Used
- **`Pipeline`** — Orchestrates multi-step generative media workflows (script → image → audio → video)
- **`SyncProvider`** — Custom `DashScopeGenblazeProvider` integrating DashScope/Qwen text and image APIs
- **`Manifest`** — GenBlaze provenance manifest capturing run ID, canonical hash, providers, timestamps
- **`PipelineResult`** — Extracts `canonical_hash` and `manifest` from every pipeline execution
- **`genblaze_s3.S3StorageBackend`** — Official GenBlaze S3-compatible backend for all Backblaze B2 operations

### Backblaze B2 Storage
- All generated MP4 videos, MP3 podcasts, PNG scene images, and provenance manifests are uploaded to a **private B2 bucket**
- Access via **S3 Presigned URLs** (AWS4-HMAC-SHA256, 24h expiry) — assets are never publicly accessible
- Organized under prefixes: `videos/`, `audio/`, `images/`, `manifests/`
- The **GenBlaze `S3StorageBackend`** handles all uploads, presigned URL generation, and asset listing

---

## Features

### 📥 Source Intake
- Add web URLs (normal or deep-crawl mode for subpage extraction)
- Upload PDF, Word (.docx), or PowerPoint files
- Paste raw text directly
- Sources are accumulated into a session knowledge base — every generation uses the full context

### 🎬 AI Video Explanations
- **Short** (~2.5–3 min): 3 scenes, ~150 words/scene
- **Critical** (~5–7 min): 5 scenes, ~220 words/scene
- **In-Depth** (~10 min): 8 scenes, ~300 words/scene
- Each scene: GenBlaze Pipeline → AI image (z-image-turbo 1280×720) + neural narration → combined via MoviePy → uploaded to B2

### 🎙 AI Podcast Audio
- **Short** (~3 min): 10–14 dialogue turns
- **Critical** (~5–7 min): 25–35 turns across 2 sections (multi-step GenBlaze Pipeline)
- **Deep** (~20–45 min): 70–100 turns across 4 thematic modules
- 1–4 speakers, 3 tones (friendly, serious, deep dive), synchronized transcript UI with click-to-seek

### 🔍 Provenance Tracking
- Every generation produces a **GenBlaze Manifest** stored as JSON on Backblaze B2 under `manifests/`
- Manifest includes: run_id, canonical_hash, providers, models, SDK version, timestamp
- Click **🔍 Provenance** on any media history item to view the full manifest in-app

### 📊 Session Isolation
- Each notebook (session) shows only its own generated media in the Media History panel
- All metadata (turns, scenes, provenance) persisted in SQLite

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- Backblaze B2 account + private bucket
- DashScope API key

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start server
uvicorn app.main:app --port 8000 --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DASHSCOPE_API_KEY` | DashScope API key for Qwen text + image | ✅ |
| `DASHSCOPE_TEXT_MODEL` | Text model (default: `qwen3.5-flash`) | Optional |
| `DASHSCOPE_IMAGE_MODEL` | Image model (default: `z-image-turbo`) | Optional |
| `B2_KEY_ID` | Backblaze B2 Application Key ID | ✅ |
| `B2_APPLICATION_KEY` | Backblaze B2 Application Key | ✅ |
| `B2_BUCKET_NAME` | B2 bucket name | ✅ |
| `B2_ENDPOINT_URL` | B2 S3 endpoint (e.g. `https://s3.eu-central-003.backblazeb2.com`) | ✅ |
| `B2_REGION_NAME` | B2 region (e.g. `eu-central-003`) | ✅ |

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/info` | GET | App info, providers, models, SDK details |
| `/api/storage/info` | GET | B2 storage engine status + asset counts |
| `/api/studio/generate` | POST | Generate video or podcast from brief |
| `/api/studio/voices` | GET | List available neural voices |
| `/api/studio/sources/inspect` | POST | Scrape & analyze URLs |
| `/api/studio/sources/upload` | POST | Upload PDF/DOCX |
| `/api/sessions` | GET/POST | List or create sessions |
| `/api/provenance/{output_id}` | GET | Get GenBlaze provenance manifest for an output |
| `/api/media/stream` | GET | Secure proxy for B2 presigned URLs |

---

## License

MIT License — see [LICENSE](LICENSE)

---

## Hackathon Submission

- **Event**: Backblaze Generative AI Media Hackathon 2026
- **GitHub**: https://github.com/Niteesh57/Gen_Mind
- **Providers**: DashScope (Qwen), Microsoft Edge TTS
- **B2 Usage**: All generated media assets and provenance manifests stored on private Backblaze B2 bucket via `genblaze-s3 S3StorageBackend`
- **GenBlaze Usage**: `Pipeline`, `SyncProvider`, `Manifest`, `PipelineResult`, `genblaze_s3.S3StorageBackend`
