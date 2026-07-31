"""SQLite session repository — device-scoped session persistence using built-in sqlite3."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sessions.db"

def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Create tables if they don't exist yet."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id           TEXT PRIMARY KEY,
                device_id    TEXT NOT NULL,
                title        TEXT NOT NULL DEFAULT 'New Media',
                mode         TEXT NOT NULL DEFAULT 'video',
                source_count INTEGER NOT NULL DEFAULT 0,
                word_count   INTEGER NOT NULL DEFAULT 0,
                content      TEXT NOT NULL DEFAULT '',
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                output_url   TEXT,
                output_mode  TEXT,
                narration    TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);

            CREATE TABLE IF NOT EXISTS session_sources (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                kind        TEXT NOT NULL DEFAULT 'url',
                mode        TEXT,
                name        TEXT,
                headline    TEXT,
                overview    TEXT,
                source_url  TEXT,
                favicon_url TEXT,
                archive_url TEXT,
                excerpt     TEXT,
                word_count  INTEGER DEFAULT 0,
                is_subpage  INTEGER DEFAULT 0,
                parent_url  TEXT,
                deep_pages  TEXT,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS session_outputs (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                output_mode TEXT NOT NULL,
                output_url  TEXT,
                narration   TEXT,
                stages      TEXT,
                items_json  TEXT,
                created_at  TEXT NOT NULL
            );
        """)
        conn.commit()
    # Migrate existing DBs that don't have the content column yet
    _migrate()

def _migrate() -> None:
    """Add any missing columns to existing databases without wiping data."""
    with _connect() as conn:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
        if "content" not in existing:
            conn.execute("ALTER TABLE sessions ADD COLUMN content TEXT NOT NULL DEFAULT ''")
        src_cols = {row[1] for row in conn.execute("PRAGMA table_info(session_sources)").fetchall()}
        for col, typ in [
            ("mode", "TEXT"), ("headline", "TEXT"), ("overview", "TEXT"),
            ("favicon_url", "TEXT"), ("is_subpage", "INTEGER DEFAULT 0"),
            ("parent_url", "TEXT"), ("deep_pages", "TEXT"),
        ]:
            if col not in src_cols:
                conn.execute(f"ALTER TABLE session_sources ADD COLUMN {col} {typ}")
        existing_out = {row[1] for row in conn.execute("PRAGMA table_info(session_outputs)").fetchall()}
        if "items_json" not in existing_out:
            conn.execute("ALTER TABLE session_outputs ADD COLUMN items_json TEXT")
        conn.commit()

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(device_id: str, title: str = "New Media", mode: str = "video") -> Dict[str, Any]:
    session_id = str(uuid.uuid4())
    now = _now()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO sessions (id, device_id, title, mode, source_count, word_count, content, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, '', ?, ?)",
            (session_id, device_id, title, mode, now, now)
        )
        conn.commit()
    return get_session(session_id)  # type: ignore

def list_sessions(device_id: str) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE device_id = ? ORDER BY updated_at DESC",
            (device_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    return dict(row) if row else None

def update_session(session_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
    allowed = {"title", "mode", "source_count", "word_count", "output_url", "output_mode", "narration"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_session(session_id)
    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    vals = list(updates.values()) + [session_id]
    with _connect() as conn:
        conn.execute(f"UPDATE sessions SET {set_clause} WHERE id = ?", vals)
        conn.commit()
    return get_session(session_id)

def delete_session(session_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
    return cur.rowcount > 0

def get_session_content(session_id: str) -> str:
    """Return the full accumulated raw content for a session."""
    with _connect() as conn:
        row = conn.execute("SELECT content FROM sessions WHERE id = ?", (session_id,)).fetchone()
    return row["content"] if row else ""

# ── Sources + content accumulation ───────────────────────────────────────────

def add_session_sources(session_id: str, sources: List[Dict[str, Any]]) -> None:
    """
    Persist each source record and APPEND the full raw content of every
    ready source into sessions.content (never overwrite — always append).
    """
    now = _now()
    new_text_parts: List[str] = []

    with _connect() as conn:
        for s in sources:
            conn.execute(
                """INSERT OR REPLACE INTO session_sources
                   (id, session_id, kind, mode, name, headline, overview, source_url, favicon_url,
                    archive_url, excerpt, word_count, is_subpage, parent_url, deep_pages, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    s.get("id", str(uuid.uuid4())),
                    session_id,
                    s.get("kind", "url"),
                    s.get("mode", "normal"),
                    s.get("name", ""),
                    s.get("headline", ""),
                    s.get("overview", ""),
                    s.get("source_url", ""),
                    s.get("favicon_url", ""),
                    s.get("archive_url", ""),
                    (s.get("excerpt") or "")[:500],
                    s.get("word_count", 0),
                    1 if s.get("is_subpage") else 0,
                    s.get("parent_url", ""),
                    json.dumps(s.get("deep_pages", [])),
                    now,
                )
            )
            # Collect full raw content for accumulation
            raw = (s.get("content") or "").strip()
            if raw and s.get("status") == "ready":
                label = s.get("headline") or s.get("name") or "Source"
                src_url = s.get("source_url") or ""
                header = f"\n\n=== SOURCE: {label}" + (f" ({src_url})" if src_url else "") + " ===\n"
                new_text_parts.append(header + raw)

        # Append to existing session content
        if new_text_parts:
            appended = "\n".join(new_text_parts)
            conn.execute(
                "UPDATE sessions SET content = content || ?, updated_at = ? WHERE id = ?",
                (appended, now, session_id)
            )

        # Update source_count and word_count from all sources in session
        existing = conn.execute(
            "SELECT COUNT(*), SUM(word_count) FROM session_sources WHERE session_id = ?",
            (session_id,)
        ).fetchone()
        total_count = existing[0] or 0
        total_words = existing[1] or 0
        conn.execute(
            "UPDATE sessions SET source_count = ?, word_count = ?, updated_at = ? WHERE id = ?",
            (total_count, total_words, now, session_id)
        )
        conn.commit()

# ── Outputs ───────────────────────────────────────────────────────────────────

def save_session_output(
    session_id: str,
    output_mode: str,
    output_url: str,
    narration: str,
    stages: List[str],
    items: Optional[List[Dict[str, Any]]] = None
) -> None:
    now = _now()
    items_str = json.dumps(items or [])
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO session_outputs (id, session_id, output_mode, output_url, narration, stages, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), session_id, output_mode, output_url, narration[:5000], json.dumps(stages), items_str, now)
        )
        conn.execute(
            "UPDATE sessions SET output_url = ?, output_mode = ?, narration = ?, updated_at = ? WHERE id = ?",
            (output_url, output_mode, narration[:500], now, session_id)
        )
        conn.commit()

def get_session_sources(session_id: str) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM session_sources WHERE session_id = ? ORDER BY created_at",
            (session_id,)
        ).fetchall()
    return [dict(r) for r in rows]

def get_session_outputs(session_id: str) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM session_outputs WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,)
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["stages"] = json.loads(d.get("stages") or "[]")
        except Exception:
            d["stages"] = []
        try:
            d["items"] = json.loads(d.get("items_json") or "[]")
        except Exception:
            d["items"] = []
        results.append(d)
    return results



# Initialize + migrate on import
init_db()
