import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.media_interfaces import Modality

client = TestClient(app)

def test_generate_video_with_chaining():
    payload = {
        "project_id": "test_proj_001",
        "prompt": "Cinematic neon cyberpunk street in dense fog at sunset",
        "modality": "video",
        "model_name": "Kling-Image2Video-V2.1-Master",
        "chain": True,
        "parent_url": ""
    }
    response = client.post("/api/media/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["project_id"] == "test_proj_001"
    assert "manifest" in data
    assert data["manifest"]["verified"] is True
    
    # Verify chain=True produced two steps (Step 1: Storyboard Image, Step 2: Kling Video)
    steps = data["steps_executed"]
    assert len(steps) == 2
    assert steps[0]["modality"] == Modality.IMAGE.value
    assert steps[0]["provider"] == "GMICloudImageProvider"
    assert steps[1]["modality"] == Modality.VIDEO.value
    assert steps[1]["provider"] == "GMICloudVideoProvider (Kling/Veo/Wan)"

def test_verify_manifest():
    # First generate media to get a sha256 hash
    payload = {
        "project_id": "test_proj_002",
        "prompt": "Epic orchestra theme for brand film",
        "modality": "audio",
        "model_name": "minimax-music-2.5",
        "chain": False
    }
    gen_resp = client.post("/api/media/generate", json=payload)
    assert gen_resp.status_code == 200
    asset_record = gen_resp.json()["asset_record"]
    sha256_hash = asset_record["sha256"]
    
    # Now verify the provenance manifest
    verify_resp = client.get(f"/api/media/verify/{sha256_hash}")
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["verified"] is True
    assert verify_data["manifest"]["sha256"] == sha256_hash
    assert verify_data["manifest"]["storage_sink"] == "Backblaze B2 Object Lock Bucket (`genblaze-studio-bucket`)"

def test_list_project_media():
    response = client.get("/api/media/test_proj_001")
    assert response.status_code == 200
    assets = response.json()
    assert isinstance(assets, list)
    assert len(assets) >= 1
