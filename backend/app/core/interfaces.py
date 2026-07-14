from abc import ABC, abstractmethod
from typing import Dict, Any, List

class INodeRepository(ABC):
    """
    DIP: Abstraction for node data storage.
    Any concrete storage class (SQL, Mongo, Mock) must implement this.
    """
    @abstractmethod
    def fetch_all_nodes(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def fetch_metrics(self) -> Dict[str, Any]:
        pass


class INodeService(ABC):
    """
    DIP: Abstraction for high-level business logic.
    Controllers/Routers depend on this interface instead of concrete services.
    """
    @abstractmethod
    def get_dashboard_data(self) -> Dict[str, Any]:
        pass
