"""Cronalytics — plugin configuration.

Static settings and path resolution. No user-editable config file yet (v0.2);
all values are hardcoded defaults.
"""

from __future__ import annotations

from pathlib import Path

try:
    from hermes_constants import get_hermes_home
    _HERMES_HOME = Path(get_hermes_home())
except Exception:
    import os
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

# Plugin-owned fact DB  —  stores derived cron run data.
# Lives inside the plugin directory so it survives migrations,
# but is .gitignored so the repo stays clean.
PLUGIN_DIR: Path = HERMES_HOME / "plugins" / "cronalytics"
FACT_DB: Path = PLUGIN_DIR / "facts.db"

# Watermark file for reconciliation scanner (Phase 2).
WATERMARK_FILE: Path = PLUGIN_DIR / "watermark.json"

# Pending queue backing file — survives gateway restarts.
PENDING_FILE: Path = PLUGIN_DIR / "pending.jsonl"

# Cron output directory — no_agent jobs write .md artifacts here.
OUTPUT_DIR: Path = HERMES_HOME / "cron" / "output"
