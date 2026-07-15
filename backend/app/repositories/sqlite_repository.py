import sqlite3
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

class SQLiteDeviceRepository:
    """
    SOLID repository for SQLite-backed storage of device identities, projects,
    media assets, and system event capturing.
    """
    def __init__(self, db_path: str = "static/b2_assets/genmedia_device_store.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Table for Device Projects
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS device_projects (
                    project_id TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    project_json TEXT NOT NULL,
                    assets_json TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Table for Device Events (Event Capturing)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS device_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Table for Individual Media Assets per Device/Project
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS media_assets (
                    asset_id TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    asset_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def log_event(self, device_id: str, device_name: str, event_type: str, payload: Dict[str, Any]) -> None:
        """Captures and logs any user/system event into SQLite keyed by device ID."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO device_events (device_id, device_name, event_type, payload_json) VALUES (?, ?, ?, ?)",
                    (device_id, device_name, event_type, json.dumps(payload))
                )
                conn.commit()
        except Exception as e:
            print(f"[SQLiteRepository] Failed to log event: {e}")

    def save_project(self, device_id: str, device_name: str, project_data: Dict[str, Any], assets_data: List[Dict[str, Any]]) -> None:
        """Saves or updates a project and its media assets for a unique device ID."""
        project_id = project_data.get("id", "default")
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO device_projects (project_id, device_id, device_name, project_json, assets_json, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (project_id, device_id, device_name, json.dumps(project_data), json.dumps(assets_data)))
            
            # Also sync individual assets into media_assets table
            for asset in assets_data:
                asset_id = asset.get("id", f"asset_{datetime.utcnow().timestamp()}")
                cursor.execute("""
                    INSERT OR REPLACE INTO media_assets (asset_id, device_id, project_id, asset_json, created_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (asset_id, device_id, project_id, json.dumps(asset)))
            conn.commit()

    def get_projects_by_device(self, device_id: str) -> List[Dict[str, Any]]:
        """Retrieves all saved projects and associated media assets for a device ID."""
        results = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT project_json, assets_json FROM device_projects WHERE device_id = ? ORDER BY updated_at DESC",
                (device_id,)
            )
            rows = cursor.fetchall()
            for p_json, a_json in rows:
                try:
                    results.append({
                        "project": json.loads(p_json),
                        "assets": json.loads(a_json)
                    })
                except Exception:
                    pass
        return results

    def save_asset(self, device_id: str, project_id: str, asset: Dict[str, Any]) -> None:
        """Persists a single generated or uploaded media asset for a device/project."""
        asset_id = asset.get("id", f"asset_{datetime.utcnow().timestamp()}")
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO media_assets (asset_id, device_id, project_id, asset_json, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (asset_id, device_id, project_id, json.dumps(asset)))
            conn.commit()

    def get_assets_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        """Retrieves all persisted media assets for a project."""
        assets = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT asset_json FROM media_assets WHERE project_id = ? ORDER BY created_at ASC", (project_id,))
            rows = cursor.fetchall()
            for (a_json,) in rows:
                try:
                    assets.append(json.loads(a_json))
                except Exception:
                    pass
        return assets
