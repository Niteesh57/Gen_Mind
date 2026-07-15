import sqlite3
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

class UniversalMediaRepository:
    """
    SOLID Dual-Engine Repository supporting both PostgreSQL (`DATABASE_URL`) and SQLite fallback.
    Stores cloud URLs, device-based projects, and granular chronological drag-and-drop event history.
    """
    def __init__(self, sqlite_path: str = "static/b2_assets/genmedia_device_store.db"):
        self.sqlite_path = sqlite_path
        self.pg_url = os.getenv("DATABASE_URL")
        self.use_pg = PSYCOPG2_AVAILABLE and bool(self.pg_url)
        if not self.use_pg:
            os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
        self._init_db()

    def _get_sqlite_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.sqlite_path)

    def _get_pg_conn(self):
        if not self.use_pg:
            return None
        return psycopg2.connect(self.pg_url)

    def _init_db(self) -> None:
        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            CREATE TABLE IF NOT EXISTS device_projects (
                                project_id VARCHAR(255) PRIMARY KEY,
                                device_id VARCHAR(255) NOT NULL,
                                device_name VARCHAR(255) NOT NULL,
                                project_json TEXT NOT NULL,
                                assets_json TEXT NOT NULL,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                            CREATE TABLE IF NOT EXISTS project_events (
                                id SERIAL PRIMARY KEY,
                                device_id VARCHAR(255) NOT NULL,
                                device_name VARCHAR(255) NOT NULL,
                                project_id VARCHAR(255) NOT NULL,
                                event_type VARCHAR(255) NOT NULL,
                                payload_json TEXT NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                            CREATE TABLE IF NOT EXISTS media_assets (
                                asset_id VARCHAR(255) PRIMARY KEY,
                                device_id VARCHAR(255) NOT NULL,
                                project_id VARCHAR(255) NOT NULL,
                                modality VARCHAR(50) NOT NULL,
                                cloud_url TEXT NOT NULL,
                                thumbnail_url TEXT,
                                asset_name VARCHAR(255) NOT NULL,
                                duration_seconds INTEGER DEFAULT 8,
                                asset_json TEXT NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                        """)
                    conn.commit()
                return
            except Exception as e:
                print(f"[UniversalRepository] PG connection failed, falling back to SQLite: {e}")
                self.use_pg = False

        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
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
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS project_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL,
                    device_name TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS media_assets (
                    asset_id TEXT PRIMARY KEY,
                    device_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    modality TEXT NOT NULL,
                    cloud_url TEXT NOT NULL,
                    thumbnail_url TEXT,
                    asset_name TEXT NOT NULL,
                    duration_seconds INTEGER DEFAULT 8,
                    asset_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def log_event(self, device_id: str, device_name: str, project_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        """Captures drag & drop or system events into PostgreSQL / SQLite history log."""
        payload_str = json.dumps(payload)
        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO project_events (device_id, device_name, project_id, event_type, payload_json) VALUES (%s, %s, %s, %s, %s)",
                            (device_id, device_name, project_id, event_type, payload_str)
                        )
                    conn.commit()
                return
            except Exception:
                pass

        try:
            with self._get_sqlite_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO project_events (device_id, device_name, project_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?)",
                    (device_id, device_name, project_id, event_type, payload_str)
                )
                conn.commit()
        except Exception as e:
            print(f"[UniversalRepository] Failed to log event: {e}")

    def get_events(self, project_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves chronological event history for undo/clock tracking."""
        events = []
        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                        cur.execute(
                            "SELECT id, event_type, payload_json, created_at FROM project_events WHERE project_id = %s ORDER BY id DESC LIMIT %s",
                            (project_id, limit)
                        )
                        for row in cur.fetchall():
                            events.append({
                                "id": row["id"],
                                "event_type": row["event_type"],
                                "payload": json.loads(row["payload_json"]),
                                "created_at": str(row["created_at"])
                            })
                return events
            except Exception:
                pass

        try:
            with self._get_sqlite_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, event_type, payload_json, created_at FROM project_events WHERE project_id = ? ORDER BY id DESC LIMIT ?",
                    (project_id, limit)
                )
                for eid, etype, p_json, cat in cursor.fetchall():
                    events.append({
                        "id": eid,
                        "event_type": etype,
                        "payload": json.loads(p_json),
                        "created_at": str(cat)
                    })
        except Exception:
            pass
        return events

    def save_project(self, device_id: str, device_name: str, project_data: Dict[str, Any], assets_data: List[Dict[str, Any]]) -> None:
        project_id = project_data.get("id", "default")
        p_json = json.dumps(project_data)
        a_json = json.dumps(assets_data)

        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO device_projects (project_id, device_id, device_name, project_json, assets_json, updated_at)
                            VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                            ON CONFLICT (project_id) DO UPDATE SET
                                device_id = EXCLUDED.device_id,
                                device_name = EXCLUDED.device_name,
                                project_json = EXCLUDED.project_json,
                                assets_json = EXCLUDED.assets_json,
                                updated_at = CURRENT_TIMESTAMP
                        """, (project_id, device_id, device_name, p_json, a_json))
                    conn.commit()
                return
            except Exception:
                pass

        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO device_projects (project_id, device_id, device_name, project_json, assets_json, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (project_id, device_id, device_name, p_json, a_json))
            for asset in assets_data:
                self.save_asset(device_id, project_id, asset)
            conn.commit()

    def get_projects_by_device(self, device_id: str) -> List[Dict[str, Any]]:
        results = []
        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT project_json, assets_json FROM device_projects WHERE device_id = %s ORDER BY updated_at DESC", (device_id,))
                        for p_json, a_json in cur.fetchall():
                            results.append({"project": json.loads(p_json), "assets": json.loads(a_json)})
                return results
            except Exception:
                pass

        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT project_json, assets_json FROM device_projects WHERE device_id = ? ORDER BY updated_at DESC", (device_id,))
            for p_json, a_json in cursor.fetchall():
                try:
                    results.append({"project": json.loads(p_json), "assets": json.loads(a_json)})
                except Exception:
                    pass
        return results

    def save_asset(self, device_id: str, project_id: str, asset: Dict[str, Any]) -> None:
        asset_id = asset.get("id", f"asset_{datetime.utcnow().timestamp()}")
        modality = asset.get("type", "video")
        cloud_url = asset.get("url") or asset.get("cloud_url") or f"/static/b2_assets/{asset_id}.mp4"
        thumb = asset.get("thumbnailUrl", "")
        name = asset.get("name", "Untitled Media")
        duration = asset.get("durationSeconds", 8)
        a_json = json.dumps(asset)

        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO media_assets (asset_id, device_id, project_id, modality, cloud_url, thumbnail_url, asset_name, duration_seconds, asset_json, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                            ON CONFLICT (asset_id) DO UPDATE SET
                                cloud_url = EXCLUDED.cloud_url,
                                thumbnail_url = EXCLUDED.thumbnail_url,
                                asset_json = EXCLUDED.asset_json
                        """, (asset_id, device_id, project_id, modality, cloud_url, thumb, name, duration, a_json))
                    conn.commit()
                return
            except Exception:
                pass

        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO media_assets (asset_id, device_id, project_id, modality, cloud_url, thumbnail_url, asset_name, duration_seconds, asset_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (asset_id, device_id, project_id, modality, cloud_url, thumb, name, duration, a_json))
            conn.commit()

    def get_assets_by_project(self, project_id: str) -> List[Dict[str, Any]]:
        assets = []
        if self.use_pg:
            try:
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT asset_json FROM media_assets WHERE project_id = %s ORDER BY created_at ASC", (project_id,))
                        for (a_json,) in cur.fetchall():
                            assets.append(json.loads(a_json))
                return assets
            except Exception:
                pass

        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT asset_json FROM media_assets WHERE project_id = ? ORDER BY created_at ASC", (project_id,))
            for (a_json,) in cursor.fetchall():
                try:
                    assets.append(json.loads(a_json))
                except Exception:
                    pass
        return assets
