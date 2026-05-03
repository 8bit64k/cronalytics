"""Cronalytics — plugin configuration.

Static settings and path resolution. No user-editable config file yet (v0.2);
all values are hardcoded defaults.
"""

from __future__ import annotations

import os
from pathlib import Path

from hermes_constants import get_hermes_home

# ---------------------------------------------------------------------------
# Polling / retry schedule
# ---------------------------------------------------------------------------

RETRY_DELAYS: list[float] = [3.0, 8.0, 15.0]  # seconds before each attempt
JITTER_MAX: float = 2.0                            # random(0, JITTER_MAX) added
MAX_RETRIES: int = len(RETRY_DELAYS)             # 3 attempts total

# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

HERMES_HOME: Path = Path(get_hermes_home())

# Operational session store (Hermes core) — the source of truth for cost data.
STATE_DB: Path = HERMES_HOME / "state.db"

# Plugin-owned fact DB  —  stores derived cron run data.
# Lives inside the plugin directory so it survives migrations,
# but is .gitignored so the repo stays clean.
PLUGIN_DIR: Path = Path(__file__).parent.resolve()
FACT_DB: Path = PLUGIN_DIR / "facts.db"

# Watermark file for reconciliation scanner (Phase 2).
WATERMARK_FILE: Path = PLUGIN_DIR / "watermark.json"

# Pending queue backing file — survives gateway restarts.
PENDING_FILE: Path = PLUGIN_DIR / "pending.jsonl"
