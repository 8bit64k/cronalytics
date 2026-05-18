"""Cronalytics — fact database operations.

Thin SQLite wrapper around cron_runs table. Owns schema creation,
single-row inserts, and basic query primitives.
"""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("cronalytics")

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
    job_mode TEXT DEFAULT 'agent',
    ingested_at REAL DEFAULT (unixepoch())
);
"""

INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id
    ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_run_time
    ON cron_runs(run_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ingested
    ON cron_runs(ingested_at);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_mode
    ON cron_runs(job_mode);
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
    "job_mode",
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
    # Migrate: add job_mode if missing (v0.1 -> v0.2)
    try:
        conn.execute("SELECT job_mode FROM cron_runs LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE cron_runs ADD COLUMN job_mode TEXT DEFAULT 'agent'")
        conn.commit()
        logger.info("[facts] Migrated: added job_mode column")
    conn.executescript(INDEX_SQL)
    return conn


def get_conn(db_path: Path) -> sqlite3.Connection:
    """Thread-local cached connection."""
    key = str(db_path)
    if getattr(_local, "db_path", None) != key:
        _local.db_path = key
        _local.conn = ensure_schema(db_path)
    conn: sqlite3.Connection = _local.conn
    return conn


def _make_job_id(session_id: str) -> str | None:
    """Parse cron_{job_id}_{YYYYMMDD}_{HHMMSS} -> job_id."""
    if not session_id.startswith("cron_"):
        return None
    parts = session_id.split("_")
    # Expected: cron_<job_id>_<YYYYMMDD>_<HHMMSS>
    # job_id may contain underscores. We drop 'cron_' and the final two
    # elements (date + time) to recover the original job_id.
    if len(parts) < 4:
        return None
    return "_".join(parts[1:-2])


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

    cols.append("job_mode")
    placeholders.append("?")
    values.append("agent")

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


def ingest_script_row(
    db_path: Path,
    job_id: str,
    run_time: float,
) -> bool:
    """Insert a synthetic row for a no_agent (script-only) cron job run.

    Args:
        db_path: Path to the plugin-owned SQLite fact DB.
        job_id: The cron job ID.
        run_time: Unix timestamp of the run (from output filename).

    Returns:
        True if inserted (or already present), False on error.
    """
    conn = get_conn(db_path)
    cursor = conn.cursor()

    session_id = f"script_{job_id}_{int(run_time)}"

    cols = [
        "session_id", "job_id", "run_time", "ended_at",
        "estimated_cost_usd", "actual_cost_usd",
        "input_tokens", "output_tokens", "reasoning_tokens",
        "cache_read_tokens", "cache_write_tokens",
        "api_call_count", "message_count", "tool_call_count",
        "duration_seconds", "model", "success", "job_mode",
    ]
    placeholders = ["?"] * len(cols)
    values = [
        session_id, job_id, run_time, run_time,
        0.0, None,  # actual_cost_usd = NULL (no billing event for script-only jobs)
        0, 0, 0,
        0, 0,
        0, 0, 0,
        None, None, 1, "no_agent",
    ]

    sql = (
        f"INSERT OR IGNORE INTO cron_runs ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)})"
    )

    try:
        cursor.execute(sql, values)
        conn.commit()
        return cursor.rowcount == 1
    except sqlite3.Error as exc:
        logger.warning("[facts] DB error inserting script row %s: %s", session_id, exc)
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


# ---------------------------------------------------------------------------
# Aggregation queries (Phase 3 API)
# ---------------------------------------------------------------------------

def query_summary(db_path: Path, days: int = 30, outcome: str = "both", mode: str = "all") -> dict[str, Any]:
    """Return aggregate stats for cron runs in the last N days (0 = all time)."""
    conn = get_conn(db_path)

    conditions: list[str] = []
    params: list[Any] = []
    if days > 0:
        conditions.append("run_time >= ?")
        params.append(time.time() - (days * 86400))
    if outcome in ("success", "failure"):
        conditions.append("success = ?")
        params.append(1 if outcome == "success" else 0)
    if mode in ("agent", "no_agent"):
        conditions.append("job_mode = ?")
        params.append(mode)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = conn.execute(
        f"""
        SELECT count(*),
               SUM(estimated_cost_usd),
               SUM(actual_cost_usd),
               COALESCE(SUM(input_tokens), 0),
               COALESCE(SUM(output_tokens), 0),
               COALESCE(SUM(cache_read_tokens), 0),
               COALESCE(SUM(cache_write_tokens), 0),
               SUM(duration_seconds),
               AVG(duration_seconds)
        FROM cron_runs{where}
        """,
        params,
    )
    row = cursor.fetchone()
    total_runs, total_est_cost, total_act_cost, total_in, total_out, total_cr, total_cw, total_dur, avg_dur = row
    total_tokens = (total_in or 0) + (total_out or 0) + (total_cr or 0) + (total_cw or 0)

    # Cost by model (only rows with known cost, respecting outcome+mode filter)
    cost_conds = conditions + ["estimated_cost_usd IS NOT NULL"]
    cost_where = " WHERE " + " AND ".join(cost_conds)

    cursor = conn.execute(
        f"""
        SELECT model, count(*) AS runs, SUM(estimated_cost_usd) AS cost
        FROM cron_runs{cost_where}
        GROUP BY model
        ORDER BY cost DESC
        """,
        params,
    )
    by_model = [
        {"model": r[0] or "unknown", "runs": r[1], "total_cost": round(r[2], 4) if r[2] is not None else None}
        for r in cursor.fetchall()
    ]

    # Previous period for trend (respect outcome+mode filter)
    prev_info = {}
    trend = "→"
    if days > 0:
        prev_cutoff = time.time() - (2 * days * 86400)
        prev_conds = ["run_time >= ?", "run_time < ?"]
        prev_params = [prev_cutoff, params[0] if params else time.time()]
        if outcome in ("success", "failure"):
            prev_conds.append("success = ?")
            prev_params.append(1 if outcome == "success" else 0)
        if mode in ("agent", "no_agent"):
            prev_conds.append("job_mode = ?")
            prev_params.append(mode)
        prev_where = " WHERE " + " AND ".join(prev_conds)
        cursor = conn.execute(
            "SELECT count(*), SUM(estimated_cost_usd) FROM cron_runs" + prev_where,
            prev_params,
        )
        prev_runs, prev_cost = cursor.fetchone()
        prev_info = {
            "runs": prev_runs or 0,
            "cost": round(prev_cost, 4) if prev_cost is not None else None,
        }
        if prev_cost is not None and prev_cost > 0 and total_est_cost is not None:
            delta = (total_est_cost - prev_cost) / prev_cost
            if delta > 0.05:
                trend = "↑"
            elif delta < -0.05:
                trend = "↓"

    # Success / failure split (filtered by outcome+mode when applicable)
    cursor = conn.execute(
        f"""
        SELECT count(CASE WHEN success = 1 THEN 1 END),
               count(CASE WHEN success = 0 THEN 1 END),
               SUM(CASE WHEN success = 1 THEN estimated_cost_usd END),
               SUM(CASE WHEN success = 0 THEN estimated_cost_usd END)
        FROM cron_runs{where}
        """,
        params,
    )
    success_runs, failure_runs, success_cost, failure_cost = cursor.fetchone()

    return {
        "days": days,
        "total_runs": total_runs,
        "total_estimated_cost": round(total_est_cost, 4) if total_est_cost is not None else None,
        "total_actual_cost": None,  # Suppressed: incomplete data is worse than no data. Re-enable when coverage is reliable.
        "total_tokens": total_tokens,
        "total_input_tokens": total_in or 0,
        "total_output_tokens": total_out or 0,
        "total_cache_read_tokens": total_cr or 0,
        "total_cache_write_tokens": total_cw or 0,
        "total_duration_seconds": round(total_dur, 2) if total_dur is not None else None,
        "avg_duration_seconds": round(avg_dur, 2) if avg_dur is not None else None,
        "success_runs": success_runs or 0,
        "failure_runs": failure_runs or 0,
        "success_cost": round(success_cost, 4) if success_cost is not None else None,
        "failure_cost": round(failure_cost, 4) if failure_cost is not None else None,
        "cost_by_model": by_model,
        "previous_period": prev_info if days > 0 else {},
        "trend": trend if days > 0 else "→",
    }


def query_jobs(db_path: Path, days: int = 30, outcome: str = "both", mode: str = "all") -> list[dict[str, Any]]:
    """Return per-job aggregates (0 = all time)."""
    conn = get_conn(db_path)

    conditions: list[str] = []
    params: list[Any] = []
    if days > 0:
        conditions.append("run_time >= ?")
        params.append(time.time() - (days * 86400))
    if outcome in ("success", "failure"):
        conditions.append("success = ?")
        params.append(1 if outcome == "success" else 0)
    if mode in ("agent", "no_agent"):
        conditions.append("job_mode = ?")
        params.append(mode)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = conn.execute(
        f"""
        SELECT job_id,
               count(*) AS runs,
               SUM(estimated_cost_usd) AS total_cost,
               AVG(estimated_cost_usd) AS avg_cost,
               MAX(run_time) AS last_run,
               COALESCE(MIN(run_time), 0) AS first_run,
               MAX(model) AS last_model,
               COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
               COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
               COALESCE(SUM(cache_read_tokens), 0) AS total_cache_read_tokens,
               COALESCE(SUM(cache_write_tokens), 0) AS total_cache_write_tokens,
               SUM(duration_seconds) AS total_duration,
               AVG(duration_seconds) AS avg_duration,
               count(CASE WHEN success = 1 THEN 1 END) AS success_runs,
               count(CASE WHEN success = 0 THEN 1 END) AS failure_runs,
               SUM(CASE WHEN success = 1 THEN estimated_cost_usd END) AS success_cost,
               SUM(CASE WHEN success = 0 THEN estimated_cost_usd END) AS failure_cost,
               MAX(job_mode) AS job_mode
        FROM cron_runs{where}
        GROUP BY job_id
        ORDER BY total_cost DESC
        """,
        params,
    )
    return [
        {
            "job_id": r[0],
            "runs": r[1],
            "total_cost": round(r[2], 4) if r[2] is not None else None,
            "avg_cost": round(r[3], 4) if r[3] is not None else None,
            "last_run": r[4],
            "first_run": r[5],
            "last_model": r[6] or "unknown",
            "total_input_tokens": r[7],
            "total_output_tokens": r[8],
            "total_cache_read_tokens": r[9],
            "total_cache_write_tokens": r[10],
            "total_tokens": (r[7] or 0) + (r[8] or 0) + (r[9] or 0) + (r[10] or 0),
            "total_duration": round(r[11], 2) if r[11] is not None else None,
            "avg_duration": round(r[12], 2) if r[12] is not None else None,
            "success_runs": r[13] or 0,
            "failure_runs": r[14] or 0,
            "success_cost": round(r[15], 4) if r[15] is not None else None,
            "failure_cost": round(r[16], 4) if r[16] is not None else None,
            "job_mode": r[17] or "agent",
        }
        for r in cursor.fetchall()
    ]


def query_job_runs(
    db_path: Path, job_id: str, limit: int = 0, days: int = 0,
    outcome: str = "both", sort_key: str = "run_time", sort_dir: str = "desc",
    mode: str = "all",
) -> list[dict[str, Any]]:
    """Return individual run history for a specific job (0 = all time).

    Supports filtering by outcome (both/success/failure) and custom sorting:
    run_time, estimated_cost_usd, duration_seconds, success, model.
    """
    conn = get_conn(db_path)
    conditions = ["job_id = ?"]
    params: list[Any] = [job_id]

    if days > 0:
        conditions.append("run_time >= ?")
        params.append(time.time() - (days * 86400))

    if outcome in ("success", "failure"):
        conditions.append("success = ?")
        params.append(1 if outcome == "success" else 0)

    if mode in ("agent", "no_agent"):
        conditions.append("job_mode = ?")
        params.append(mode)

    where = " WHERE " + " AND ".join(conditions)

    # Safe column whitelist — only allow known sortable columns
    safe_cols = {"run_time", "estimated_cost_usd", "duration_seconds", "success", "model", "input_tokens"}
    order_col = sort_key if sort_key in safe_cols else "run_time"
    order_dir = "DESC" if sort_dir == "desc" else "ASC"

    cursor = conn.execute(
        f"""
        SELECT session_id, job_id, run_time, ended_at,
               duration_seconds, model,
               input_tokens, output_tokens, reasoning_tokens,
               cache_read_tokens, cache_write_tokens,
               estimated_cost_usd, actual_cost_usd,
               cost_status, billing_provider,
               end_reason, success, job_mode
        FROM cron_runs
        {where}
        ORDER BY {order_col} {order_dir}
        {("LIMIT ?" if limit > 0 else "")}
        """,
        (params + [limit]) if limit > 0 else params,
    )
    cols = [
        "session_id", "job_id", "run_time", "ended_at",
        "duration_seconds", "model",
        "input_tokens", "output_tokens", "reasoning_tokens",
        "cache_read_tokens", "cache_write_tokens",
        "estimated_cost_usd", "actual_cost_usd",
        "cost_status", "billing_provider",
        "end_reason", "success", "job_mode",
    ]
    return [dict(zip(cols, r, strict=True)) for r in cursor.fetchall()]


def query_script_watermark(db_path: Path, job_id: str) -> float:
    """Return the max run_time for a no_agent job, or 0.0 if none."""
    conn = get_conn(db_path)
    cursor = conn.execute(
        "SELECT COALESCE(MAX(run_time), 0) FROM cron_runs WHERE job_id = ? AND job_mode = 'no_agent'",
        (job_id,),
    )
    row = cursor.fetchone()
    return float(row[0]) if row else 0.0


def query_health(db_path: Path) -> dict[str, Any]:
    """Quick health stats for the fact DB."""
    conn = get_conn(db_path)
    cursor = conn.execute("SELECT count(*) FROM cron_runs")
    total = cursor.fetchone()[0]

    cursor = conn.execute(
        "SELECT MAX(ingested_at), MAX(run_time) FROM cron_runs"
    )
    last_ingested, last_run = cursor.fetchone()

    cursor = conn.execute(
        "SELECT count(DISTINCT job_id) FROM cron_runs"
    )
    unique_jobs = cursor.fetchone()[0]

    return {
        "total_runs": total,
        "unique_jobs": unique_jobs,
        "last_ingested_at": last_ingested,
        "last_run_time": last_run,
    }


def query_models(db_path: Path, days: int = 30, outcome: str = "both", mode: str = "all") -> list[dict[str, Any]]:
    """Return per-model usage aggregates (0 = all time)."""
    conn = get_conn(db_path)

    conditions: list[str] = []
    params: list[Any] = []
    if days > 0:
        conditions.append("run_time >= ?")
        params.append(time.time() - (days * 86400))
    if outcome in ("success", "failure"):
        conditions.append("success = ?")
        params.append(1 if outcome == "success" else 0)
    if mode in ("agent", "no_agent"):
        conditions.append("job_mode = ?")
        params.append(mode)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = conn.execute(
        f"""
        SELECT model,
               count(*) AS runs,
               SUM(estimated_cost_usd) AS total_cost,
               AVG(estimated_cost_usd) AS avg_cost,
               COALESCE(SUM(input_tokens), 0) AS total_input,
               COALESCE(SUM(output_tokens), 0) AS total_output,
               MAX(run_time) AS last_run
        FROM cron_runs{where}
        GROUP BY model
        ORDER BY total_cost DESC
        """,
        params,
    )
    return [
        {
            "model": r[0] or "unknown",
            "runs": r[1],
            "total_cost": round(r[2], 4) if r[2] is not None else None,
            "avg_cost": round(r[3], 4) if r[3] is not None else None,
            "total_input_tokens": r[4],
            "total_output_tokens": r[5],
            "last_run": r[6],
        }
        for r in cursor.fetchall()
    ]


def query_trends(db_path: Path, days: int = 30, outcome: str = "both", mode: str = "all") -> list[dict[str, Any]]:
    """Return daily cost and run-count trend (0 = all time)."""
    conn = get_conn(db_path)

    conditions: list[str] = []
    params: list[Any] = []
    if days > 0:
        conditions.append("run_time >= ?")
        params.append(time.time() - (days * 86400))
    if outcome in ("success", "failure"):
        conditions.append("success = ?")
        params.append(1 if outcome == "success" else 0)
    if mode in ("agent", "no_agent"):
        conditions.append("job_mode = ?")
        params.append(mode)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    cursor = conn.execute(
        f"""
        SELECT date(run_time, 'unixepoch') AS day,
               count(*) AS runs,
               SUM(estimated_cost_usd) AS cost,
               COALESCE(SUM(input_tokens), 0) AS input_tokens,
               COALESCE(SUM(output_tokens), 0) AS output_tokens
        FROM cron_runs{where}
        GROUP BY day
        ORDER BY day ASC
        """,
        params,
    )
    return [
        {
            "day": r[0],
            "runs": r[1],
            "cost": round(r[2], 4) if r[2] is not None else None,
            "input_tokens": r[3],
            "output_tokens": r[4],
        }
        for r in cursor.fetchall()
    ]
