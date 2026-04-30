"""Cron Insights — reconciliation scanner (Phase 2).

Backfills historical cron sessions from state.db into facts.db.
Uses a timestamp watermark to track progress and avoid duplicate work.

Called:
  - On first dashboard load after install
  - On explicit POST /api/plugins/cron-insights/sync
  - Periodically (default every 6h) while gateway stays up
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Any

from . import facts
from .logger import logger

# ---------------------------------------------------------------------------
# Watermark I/O
# ---------------------------------------------------------------------------

Watermark = dict[str, Any]  # {"last_ended_at": float, "last_sync": str}


def _read_watermark(path: Path) -> Watermark:
    if not path.exists():
        return {"last_ended_at": 0.0, "last_sync": None}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        logger.warning("[scanner] Corrupt watermark, resetting")
        return {"last_ended_at": 0.0, "last_sync": None}


def _write_watermark(path: Path, last_ended_at: float) -> None:
    payload: Watermark = {
        "last_ended_at": last_ended_at,
        "last_sync": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")
        fh.flush()


# ---------------------------------------------------------------------------
# State DB query
# ---------------------------------------------------------------------------

def _fetch_new_sessions(
    state_db: Path,
    since: float,
) -> list[dict[str, Any]]:
    """Pull cron sessions from state.db with ended_at > watermark."""
    conn = sqlite3.connect(str(state_db))
    conn.row_factory = sqlite3.Row
    cursor = conn.execute(
        """
        SELECT id, source, model, started_at, ended_at,
               input_tokens, output_tokens, reasoning_tokens,
               cache_read_tokens, cache_write_tokens,
               estimated_cost_usd, actual_cost_usd,
               cost_status, cost_source, billing_provider,
               api_call_count, message_count, tool_call_count,
               end_reason
        FROM sessions
        WHERE source = 'cron'
          AND ended_at IS NOT NULL
          AND ended_at > ?
        ORDER BY ended_at ASC
        """,
        (since,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


# ---------------------------------------------------------------------------
# Batch ingestion
# ---------------------------------------------------------------------------

def _ingest_batch(
    fact_db: Path,
    rows: list[dict[str, Any]],
) -> tuple[int, int]:
    """Insert rows into fact DB, return (inserted, skipped)."""
    # Ensure schema exists once before batch processing
    facts.ensure_schema(fact_db)
    inserted = 0
    skipped = 0

    for row in rows:
        if facts.row_exists(fact_db, row["id"]):
            skipped += 1
            continue
        if facts.ingest_row(fact_db, row):
            inserted += 1
        else:
            skipped += 1

    return inserted, skipped


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_sync(
    state_db: Path,
    fact_db: Path,
    watermark_path: Path,
) -> dict[str, Any]:
    """Run one reconciliation pass.

    Returns a summary dict with counts and timestamps.
    """
    wm = _read_watermark(watermark_path)
    since = float(wm.get("last_ended_at", 0.0))

    logger.info("[scanner] Starting sync since ended_at=%s", since)
    started = time.time()

    rows = _fetch_new_sessions(state_db, since)
    if not rows:
        logger.info("[scanner] No new cron sessions found")
        return {
            "inserted": 0,
            "skipped": 0,
            "new_watermark": since,
            "elapsed_ms": round((time.time() - started) * 1000, 1),
        }

    inserted, skipped = _ingest_batch(fact_db, rows)
    new_watermark = max(
        since,
        *(float(r["ended_at"] or 0) for r in rows),
    )

    _write_watermark(watermark_path, new_watermark)

    elapsed = time.time() - started
    logger.info(
        "[scanner] Sync complete: %d inserted, %d skipped, "
        "watermark=%s, %.2fs",
        inserted, skipped, new_watermark, elapsed,
    )

    return {
        "inserted": inserted,
        "skipped": skipped,
        "total_candidates": len(rows),
        "new_watermark": new_watermark,
        "elapsed_ms": round(elapsed * 1000, 1),
    }


def get_status(watermark_path: Path) -> dict[str, Any]:
    """Return scanner metadata for health checks."""
    wm = _read_watermark(watermark_path)
    return {
        "last_sync": wm.get("last_sync"),
        "last_ended_at": wm.get("last_ended_at"),
        "watermark_file_exists": watermark_path.exists(),
        "watermark_file_path": str(watermark_path),
    }
