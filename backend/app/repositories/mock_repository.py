from typing import Dict, Any, List
from app.core.interfaces import INodeRepository

class MockNodeRepository(INodeRepository):
    """
    LSP/DIP: Concrete implementation of INodeRepository.
    Can be substituted for any real database repository.
    """
    def fetch_all_nodes(self) -> List[Dict[str, Any]]:
        return [
            {"id": "1", "name": "Alex Rivera", "role": "Lead Architect", "efficiency": 98, "status": "active"},
            {"id": "2", "name": "Sophia Chen", "role": "Senior Frontend Engineer", "efficiency": 95, "status": "active"},
            {"id": "3", "name": "Marcus Vance", "role": "DevOps Engineer", "efficiency": 89, "status": "idle"},
            {"id": "4", "name": "Elena Rostova", "role": "Security Engineer", "efficiency": 96, "status": "active"},
            {"id": "5", "name": "Akiro Tanaka", "role": "Data Scientist", "efficiency": 91, "status": "offline"},
        ]

    def fetch_metrics(self) -> Dict[str, Any]:
        return {
            "totalUsers": 1420,
            "activeSessions": 843,
            "averageEfficiency": 94.6
        }
