# Stage 1: Build Frontend (Vite + React)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Final Runtime Image (Python 3.11 + FastAPI + MoviePy/ffmpeg)
FROM python:3.11-slim AS runner

# Install system dependencies (ffmpeg required for MoviePy video generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy python requirements & install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./

# Copy built frontend assets from Stage 1 into backend/dist for single-container serving
COPY --from=frontend-builder /app/frontend/dist ./dist

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
