from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_lists_supported_microsoft_voices():
    response = client.get("/api/studio/voices")
    assert response.status_code == 200
    assert any(voice["id"] == "en-US-JennyNeural" for voice in response.json())

def test_creates_video_explanation_package():
    response = client.post("/api/studio/generate", json={
        "project_id": "studio_test",
        "topic": "Why the sky is blue",
        "image_count": 5,
        "depth_level": "short",
        "image_style": "Clean Editorial",
        "language": "en-US",
        "output_mode": "video",
        "voice": "en-US-JennyNeural"
    })
    assert response.status_code == 200
    body = response.json()
    assert len(body["scenes"]) > 0
    assert len(body["images"]) > 0
    assert "output_url" in body and body["output_url"]

def test_rejects_unsafe_media_limits():
    response = client.post("/api/studio/generate", json={"topic": "test", "depth_level": "invalid_depth_name"})
    assert response.status_code == 422

def test_creates_podcast_audio_package():
    payload = {
        "project_id": "podcast_test",
        "topic": "How a solar eclipse works",
        "depth_level": "short",
        "language": "en-US",
        "output_mode": "conversation",
        "voice": "en-US-JennyNeural",
        "podcast_tone": "friendly",
        "participant_count": 2,
        "participant_voices": ["en-US-JennyNeural", "en-US-GuyNeural"]
    }
    response = client.post("/api/studio/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["mode"] == "conversation"
    assert "output_url" in response.json() and response.json()["output_url"]
