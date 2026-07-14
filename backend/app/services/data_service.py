from typing import Dict, Any
from app.core.interfaces import INodeService, INodeRepository

class NodeService(INodeService):
    """
    SRP/DIP: Business logic service for nodes.
    Depends on INodeRepository abstraction, not a concrete implementation.
    """
    def __init__(self, repo: INodeRepository):
        self.repo = repo

    def get_dashboard_data(self) -> Dict[str, Any]:
        metrics = self.repo.fetch_metrics()
        users = self.repo.fetch_all_nodes()
        return {
            "metrics": metrics,
            "users": users
        }
