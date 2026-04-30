"""Auto-checkpoint for active project development.

Lightweight state serialization that survives gateway restarts.
Writes a YAML snapshot after every significant turn so the next
session can pick up where the last one left off.

Usage (called manually at end of turns during active dev):
    from checkpoint import checkpoint_save, checkpoint_load, checkpoint_enabled
    checkpoint_save({
        "phase": "Phase 1",
        "last_commit": "abc123",
        "next_step": "Restart gateway and test hook",
    })

On restart:
    state = checkpoint_load()
    # state is a dict with the last saved checkpoint
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("cron-insights.checkpoint")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Enable/disable auto-checkpointing. Controlled via env var so it survives
# across sessions without touching config.yaml.
CHECKPOINT_ENV_VAR = "CRON_INSIGHTS_CHECKPOINT"

# Where the checkpoint lives. Outside the git repo so it isn't committed.
DEFAULT_CHECKPOINT_PATH: Path = Path.home() / ".hermes" / "sessions" / "cron-insights-checkpoint.json"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def checkpoint_enabled() -> bool:
    """Return True if auto-checkpointing is active for this project."""
    return os.getenv(CHECKPOINT_ENV_VAR, "").lower() in ("1", "true", "yes", "on")


def checkpoint_enable() -> None:
    """Enable auto-checkpointing for this project."""
    os.environ[CHECKPOINT_ENV_VAR] = "1"
    logger.info("[checkpoint] Auto-checkpointing ENABLED for cron-insights")


def checkpoint_disable() -> None:
    """Disable auto-checkpointing for this project."""
    os.environ[CHECKPOINT_ENV_VAR] = "0"
    logger.info("[checkpoint] Auto-checkpointing DISABLED for cron-insights")


def checkpoint_save(
    state: dict[str, Any],
    path: Path | None = None,
) -> None:
    """Write the current project state to disk.

    Args:
        state: Arbitrary dict. Recommended keys:
            - phase: str
            - phase_status: str ("in_progress", "complete", "blocked")
            - last_commit: str
            - next_step: str
            - files_touched: list[str]
            - open_decisions: list[str]
            - context_summary: str (one-paragraph mental model)
        path: Override checkpoint file location.
    """
    if not checkpoint_enabled():
        return

    target = path or DEFAULT_CHECKPOINT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "project": "cron-insights",
        "timestamp": time.time(),
        "iso_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "state": state,
    }

    try:
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, default=str)
            fh.write("\n")
            fh.flush()
        logger.debug("[checkpoint] Saved to %s", target)
    except Exception as exc:
        logger.warning("[checkpoint] Failed to save: %s", exc)


def checkpoint_load(
    path: Path | None = None,
) -> dict[str, Any] | None:
    """Read the last saved checkpoint, if any.

    Returns the inner 'state' dict, or None if no checkpoint exists.
    """
    target = path or DEFAULT_CHECKPOINT_PATH
    if not target.exists():
        return None

    try:
        with open(target, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        logger.info(
            "[checkpoint] Loaded checkpoint from %s (saved %s)",
            target, payload.get("iso_time", "unknown"),
        )
        return payload.get("state")
    except Exception as exc:
        logger.warning("[checkpoint] Failed to load: %s", exc)
        return None


def checkpoint_clear(
    path: Path | None = None,
) -> None:
    """Delete the checkpoint file. Use when the project is done or paused."""
    target = path or DEFAULT_CHECKPOINT_PATH
    if target.exists():
        try:
            target.unlink()
            logger.info("[checkpoint] Cleared %s", target)
        except Exception as exc:
            logger.warning("[checkpoint] Failed to clear: %s", exc)
