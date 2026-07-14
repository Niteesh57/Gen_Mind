from fastapi.testclient import TestClient
from app.main import app
from app.api.routes import get_node_repository
from app.core.interfaces import INodeRepository

client = TestClient(app)

# LSP/DIP: Test repository to verify substitution works seamlessly
class TestNodeRepository(INodeRepository):
    def fetch_all_nodes(self):
        return [{"id": "99", "name": "Test User", "role": "QA", "efficiency": 100, "status": "active"}]

    def fetch_metrics(self):
        return {"totalUsers": 1, "activeSessions": 1, "averageEfficiency": 100.0}


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_dashboard_endpoint_with_override():
    # DIP: Override the repository dependency at runtime for testing
    app.dependency_overrides[get_node_repository] = lambda: TestNodeRepository()
    
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    
    data = response.json()
    assert data["metrics"]["totalUsers"] == 1
    assert data["users"][0]["name"] == "Test User"
    
    # Clean up dependency overrides
    app.dependency_overrides.clear()
