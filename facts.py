"""Cron Insights — fact database operations.

Thin SQLite wrapper around cron_runs table. Owns schema creation,
single-row inserts, and basic query primitives.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any

from .logger import logger

# Reused connection per thread (SQLite is fine with this for our
# write-light, read-medium workload).
_local = threading.local()

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cron_runs (
    session_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    run_time REAL NOT NULL,
    ended_at REAL,
    duration_seconds REAL,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL,
    actual_cost_usd REAL,
    cost_status TEXT,
    cost_source TEXT,
    billing_provider TEXT,
    api_call_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    end_reason TEXT,
    success BOOLEAN,
    ingested_at REAL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id
    ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_run_time
    ON cron_runs(run_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ingested
    ON cron_runs(ingested_at);
"""

# All columns in order, for convenience when row-mapping from state.db queries.
RUN_COLUMNS: tuple[str, ...] = (
    "session_id",
    "job_id",
    "run_time",
    "ended_at",
    "duration_seconds",
    "model",
    "input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "estimated_cost_usd",
    "actual_cost_usd",
    "cost_status",
    "cost_source",
    "billing_provider",
    "api_call_count",
    "message_count",
    "tool_call_count",
    "end_reason",
    "success",
    "ingested_at",
)

# Mapping: state.db column -> fact DB column.
# Keys are state.db session row dict keys, values are the corresponding
# cron_runs column names (same when identical).
COLUMN_MAP: dict[str, str] = {
    "id": "session_id",
    "model": "model",
    "started_at": "run_time",
    "ended_at": "ended_at",
    "input_tokens": "input_tokens",
    "output_tokens": "output_tokens",
    "reasoning_tokens": "reasoning_tokens",
    "cache_read_tokens": "cache_read_tokens",
    "cache_write_tokens": "cache_write_tokens",
    "estimated_cost_usd": "estimated_cost_usd",
    "actual_cost_usd": "actual_cost_usd",
    "cost_status": "cost_status",
    "cost_source": "cost_source",
    "billing_provider": "billing_provider",
    "api_call_count": "api_call_count",
    "message_count": "message_count",
    "tool_call_count": "tool_call_count",
    "end_reason": "end_reason",
}


def ensure_schema(db_path: Path) -> sqlite3.Connection:
    """Return a connection with WAL mode and schema up-to-date."""
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    return conn


def get_conn(db_path: Path) -> sqlite3.Connection:
    """Thread-local cached connection."""
    key = str(db_path)
    if getattr(_local, "db_path", None) != key:
        _local.db_path = key
        _local.conn = ensure_schema(db_path)
    return _local.conn


def _make_job_id(session_id: str) -> str | None:
    """Parse cron_{job_id}_{timestamp} -> job_id."""
    if not session_id.startswith("cron_"):
        return None
    parts = session_id.split("_")
    # Expected: cron_<job_id>_<timestamp> where job_id may contain underscores
    # but the final part is always the timestamp. So we drop 'cron_' and the last
    # element to recover the original job_id.
    if len(parts) < 3:
        return None
    return "_".join(parts[1:-1])


def ingest_row(
    db_path: Path,
    row: dict[str, Any],
) -> bool:
    """Insert a single session row into the fact DB.

    Args:
        db_path: Path to the plugin-owned SQLite fact DB.
        row: Row dict from Hermes state.db sessions table.

    Returns:
        True if inserted (or already present), False on error.
    """
    conn = get_conn(db_path)
    cursor = conn.cursor()

    session_id: str = row["id"]
    job_id = _make_job_id(session_id)
    if job_id is None:
        logger.warning("[facts] Unparseable session_id: %s", session_id)
        return False

    # Build column list + placeholders + values
    cols: list[str] = []
    placeholders: list[str] = []
    values: list[Any] = []

    for src_col, dst_col in COLUMN_MAP.items():
        if src_col not in row:
            continue
        cols.append(dst_col)
        placeholders.append("?")
        values.append(row[src_col])

    # Computed / derived fields
    run_time = row.get("started_at")
    ended_at = row.get("ended_at")
    if run_time is not None and ended_at is not None:
        cols.append("duration_seconds")
        placeholders.append("?")
        values.append(float(ended_at) - float(run_time))

    cols.append("job_id")
    placeholders.append("?")
    values.append(job_id)

    cols.append("success")
    placeholders.append("?")
    end_reason = row.get("end_reason", "")
    values.append(1 if end_reason in ("cron_complete", "complete") else 0)

    sql = (
        f"INSERT OR IGNORE INTO cron_runs ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)})"
    )

    try:
        cursor.execute(sql, values)
        conn.commit()
        return cursor.rowcount == 1
    except sqlite3.Error as exc:
        logger.warning("[facts] DB error inserting %s: %s", session_id, exc)
        return False


def query_last_ingested(db_path: Path) -> float:
    """Return the max ingested_at timestamp, or 0.0 if table is empty."""
    conn = get_conn(db_path)
    cursor = conn.execute(
        "SELECT COALESCE(MAX(ingested_at), 0) FROM cron_runs"
    )
    row = cursor.fetchone()
    return float(row[0]) if row else 0.0


def row_exists(db_path: Path, session_id: str) -> bool:
    """Check if a session has already been ingested."""
    conn = get_conn(db_path)
    cursor = conn.execute(
        "SELECT 1 FROM cron_runs WHERE session_id = ? LIMIT 1",
        (session_id,),
    )
    return cursor.fetchone() is not None
