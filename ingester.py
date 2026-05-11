"""Cronalytics — session ingestion handler (Phase 1 + crash recovery).

Fires on every on_session_end, filters for platform=="cron", persists
the session_id to a durable pending file, then a background worker retries
state.db lookup with exponential-backoff-like delays and capped jitter.

The pending file (~/.hermes/plugins/cronalytics/pending.jsonl) survives
gateway restarts so no captured session is lost between plugin reloads.
"""

from __future__ import annotations

import json
import random
import sqlite3
import threading
import time
from typing import Any

from . import facts
from .config import FACT_DB, JITTER_MAX, PENDING_FILE, RETRY_DELAYS, STATE_DB
from .logger import logger

# In-memory work queue. Each item is a dict:
#   {"session_id": str, "model": str, "completed": bool, "retries": int}
# The queue is drained by a single background thread.
_queue: list[dict] = []
_queue_lock = threading.Lock()
_worker_thread: threading.Thread | None = None
_worker_stop = threading.Event()

# Serialize access to the pending file — hook (main thread) and worker
# both touch it.
_pending_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Public lifecycle
# ---------------------------------------------------------------------------

def start() -> None:
    """Called once from register().

    Recovers any orphaned pending items from disk and starts the worker
    if there is work to do.
    """
    recovered = _recover_pending()
    if recovered:
        _ensure_worker()
        logger.info(
            "[ingester] Recovered %d pending item(s) from %s",
            recovered, PENDING_FILE.name,
        )


def handle_session_end(
    session_id: str = "",
    completed: bool = True,
    interrupted: bool = False,  # noqa: ARG001 — reserved for future use
    model: str = "",
    platform: str = "",
    **_: Any,
) -> None:
    """Hook handler: capture cron job completions.

    Non-blocking. Immediately persists to the pending file and enqueues
    for deferred processing.
    """
    if platform != "cron":
        return

    item = {
        "session_id": session_id,
        "model": model,
        "completed": completed,
        "retries": 0,
    }

    # Durability first: write to disk before memory.
    _append_pending(item)

    with _queue_lock:
        _queue.append(item)
    _ensure_worker()

    logger.info(
        "Captured: %s (model=%s, completed=%s)",
        session_id, model, completed,
    )


# ---------------------------------------------------------------------------
# Pending-file helpers
# ---------------------------------------------------------------------------

def _append_pending(item: dict) -> None:
    """Atomically append a single item to the pending file."""
    with _pending_lock:
        try:
            with open(PENDING_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(item, separators=(",", ":")) + "\n")
                fh.flush()
        except OSError:
            logger.error("[ingester] Failed to write pending file", exc_info=True)


def _remove_pending(session_id: str) -> None:
    """Rewrite the pending file, dropping the resolved session_id."""
    with _pending_lock:
        if not PENDING_FILE.exists():
            return
        try:
            with open(PENDING_FILE, encoding="utf-8") as fh:
                lines = fh.readlines()

            kept: list[str] = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("session_id") != session_id:
                        kept.append(line + "\n")
                except json.JSONDecodeError:
                    kept.append(line + "\n")

            with open(PENDING_FILE, "w", encoding="utf-8") as fh:
                fh.writelines(kept)
                fh.flush()
        except OSError:
            logger.error(
                "[ingester] Failed to remove %s from pending file",
                session_id, exc_info=True,
            )


def _recover_pending() -> int:
    """Load any orphaned items from the pending file into the in-memory queue.

    Returns the number of items recovered.
    """
    if not PENDING_FILE.exists():
        return 0

    recovered: list[dict] = []
    try:
        with open(PENDING_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if isinstance(data, dict) and data.get("session_id"):
                        recovered.append(data)
                except json.JSONDecodeError:
                    continue
    except OSError:
        logger.error("[ingester] Failed to read pending file", exc_info=True)
        return 0

    if recovered:
        with _queue_lock:
            _queue.extend(recovered)

    return len(recovered)


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

def _query_state_db(session_id: str) -> dict[str, Any] | None:
    """Query the Hermes operational state.db for a single session row."""
    try:
        conn = sqlite3.connect(str(STATE_DB), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,),
        )
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    except sqlite3.Error as exc:
        logger.warning("[ingester] state.db query error for %s: %s", session_id, exc)
        return None


def _delay_for_attempt(attempt_number: int) -> float:
    """Compute total sleep before the next attempt (0-indexed)."""
    if attempt_number >= len(RETRY_DELAYS):
        return RETRY_DELAYS[-1] + random.uniform(0, JITTER_MAX)
    base = RETRY_DELAYS[attempt_number]
    return base + random.uniform(0, JITTER_MAX)


def _process_one(item: dict) -> bool:
    """Process a single queue item. Return True if resolved (ingested or dropped)."""
    session_id = item["session_id"]
    retries = item["retries"]

    row = _query_state_db(session_id)

    if row is not None:
        # Success path
        inserted = facts.ingest_row(FACT_DB, row)
        if inserted:
            logger.info(
                "[ingester] Ingested %s (attempt %d)", session_id, retries + 1,
            )
        else:
            logger.debug(
                "[ingester] Duplicate or DB error %s (attempt %d)",
                session_id, retries + 1,
            )
        _remove_pending(session_id)
        return True

    # Row not found yet. Retry or drop.
    if retries < len(RETRY_DELAYS):
        sleep_for = _delay_for_attempt(retries)
        logger.debug(
            "[ingester] %s not in state.db yet; retry %d/%d after %.1fs",
            session_id, retries + 1, len(RETRY_DELAYS), sleep_for,
        )
        time.sleep(sleep_for)
        item["retries"] = retries + 1
        with _queue_lock:
            _queue.append(item)
        return False

    # Exhausted retries.
    logger.warning(
        "[ingester] Dropped %s after %d attempts — "
        "state.db row never materialised. Scanner will backfill if present.",
        session_id, retries,
    )
    _remove_pending(session_id)
    return True


def _worker_loop() -> None:
    """Background thread: drain the queue until told to stop."""
    while not _worker_stop.is_set():
        item: dict | None = None
        with _queue_lock:
            if _queue:
                item = _queue.pop(0)

        if item is None:
            time.sleep(1.0)
            continue

        _process_one(item)

    logger.debug("[ingester] Worker thread exit")


def _ensure_worker() -> None:
    """Start the background worker thread if not already running."""
    global _worker_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        return

    _worker_stop.clear()
    _worker_thread = threading.Thread(
        target=_worker_loop,
        name="cronalytics-ingester",
        daemon=True,
    )
    _worker_thread.start()
    logger.debug("[ingester] Worker thread started")
