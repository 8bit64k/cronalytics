"""Cronalytics — plugin configuration.

Static settings and path resolution. No user-editable config file yet (v0.2);
all values are hardcoded defaults.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from hermes_constants import get_hermes_home
    _HERMES_HOME = Path(get_hermes_home())
except Exception:
    hermes_home = os.environ.get("HERMES_HOME", "")
    if hermes_home:
        _HERMES_HOME = Path(hermes_home)
    else:
        _HERMES_HOME = Path.home() / ".hermes"

# ---------------------------------------------------------------------------
# Polling / retry schedule
# ---------------------------------------------------------------------------

RETRY_DELAYS: list[float] = [3.0, 8.0, 15.0]  # seconds before each attempt
JITTER_MAX: float = 2.0                            # random(0, JITTER_MAX) added
MAX_RETRIES: int = len(RETRY_DELAYS)             # 3 attempts total

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

HERMES_HOME: Path = _HERMES_HOME

# Operational session store (Hermes core) — the source of truth for cost data.
STATE_DB: Path = HERMES_HOME / "state.db"

# Plugin code directory (read-only at runtime).
PLUGIN_DIR: Path = HERMES_HOME / "plugins" / "cronalytics"

# Runtime state lives in Hermes' native per-profile plugin data dir, NOT in the plugin
# directory: Hermes' package manager hashes every file of a Python plugin member into the
# dependency stamp, so a DB/watermark written next to the code flips the stamp on every
# sync and makes each `hermes` start rebuild a full dependency generation (and snapshot a
# live SQLite mid-transaction). Override with CRONALYTICS_DATA_DIR.
DATA_DIR: Path = Path(os.environ.get("CRONALYTICS_DATA_DIR")
                      or HERMES_HOME / "plugin-data" / "cronalytics")

# Plugin-owned fact DB  —  stores derived cron run data.
FACT_DB: Path = DATA_DIR / "facts.db"

# Watermark file for reconciliation scanner (Phase 2).
WATERMARK_FILE: Path = DATA_DIR / "watermark.json"

# Pending queue backing file — survives gateway restarts.
PENDING_FILE: Path = DATA_DIR / "pending.jsonl"

_LEGACY_FILES = ("facts.db", "facts.db-wal", "facts.db-shm", "facts.db-journal",
                 "watermark.json", "pending.jsonl")


def _migrate_legacy_state() -> None:
    """Move pre-DATA_DIR state out of the plugin directory (idempotent, best effort).

    First run copies the fact DB via the SQLite backup API (consistent even with a
    live -wal) and the JSON files; afterwards every legacy file is moved aside to
    DATA_DIR/legacy-<ts>/ so the plugin directory holds code only. Facts are derived
    from state.db, so anything written meanwhile is recovered by the scanner.
    """
    legacy = [PLUGIN_DIR / n for n in _LEGACY_FILES if (PLUGIN_DIR / n).exists()]
    if not legacy or PLUGIN_DIR.resolve() == DATA_DIR.resolve():
        return
    import fcntl
    import shutil
    import sqlite3
    import time

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_DIR / ".migrate.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old_db = PLUGIN_DIR / "facts.db"
        if not FACT_DB.exists() and old_db.exists():
            src = sqlite3.connect(f"file:{old_db}?mode=ro", uri=True)
            dst = sqlite3.connect(FACT_DB)
            try:
                src.backup(dst)
            finally:
                dst.close()
                src.close()
        for name in ("watermark.json", "pending.jsonl"):
            if not (DATA_DIR / name).exists() and (PLUGIN_DIR / name).exists():
                shutil.copy2(PLUGIN_DIR / name, DATA_DIR / name)
        aside = DATA_DIR / f"legacy-{time.strftime('%Y%m%d-%H%M%S')}"
        # Re-scan: opening a WAL database (even read-only) recreates its -wal/-shm files.
        for path in (PLUGIN_DIR / n for n in _LEGACY_FILES):
            if path.exists():
                aside.mkdir(exist_ok=True)
                shutil.move(str(path), aside / path.name)


try:
    _migrate_legacy_state()
except Exception:  # never block plugin load on migration
    import logging as _logging
    _logging.getLogger("cronalytics").warning("legacy state migration failed", exc_info=True)

# Cron output directory — no_agent jobs write .md artifacts here.
OUTPUT_DIR: Path = HERMES_HOME / "cron" / "output"
