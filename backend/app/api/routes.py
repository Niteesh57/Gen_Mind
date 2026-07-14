from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.core.interfaces import INodeService, INodeRepository
from app.repositories.mock_repository import MockNodeRepository
from app.services.data_service import NodeService

router = APIRouter(prefix="/api")

# DIP Dependency Resolvers
def get_node_repository() -> INodeRepository:
    # Easy extension point: return PostgresNodeRepository() if database configured
    return MockNodeRepository()

def get_node_service(repo: INodeRepository = Depends(get_node_repository)) -> INodeService:
    return NodeService(repo)


@router.get("/dashboard")
def get_dashboard(service: INodeService = Depends(get_node_service)) -> Dict[str, Any]:
    """
    Router handles HTTP framing.
    Business logic execution is delegated to INodeService.
    """
    return service.get_dashboard_data()
