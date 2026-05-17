"""Cronalytics plugin — registration.

Phase-0 skeleton: registers on_session_end hook and logs cron completions.
Phase-1 addition: fact DB + deferred ingestion with crash recovery.
Phase-2 addition: skill symlink for agent discoverability.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from .cronalytics import config, facts, ingester


def _ensure_skill_linked() -> None:
    """Symlink the skill into ~/.hermes/skills/ so agents can discover it.

    This runs during plugin registration so the skill is available before
    the user ever invokes the CLI. The symlink points into the plugin
    directory so it stays in sync when the plugin is updated via git pull.
    """
    try:
        from hermes_constants import get_hermes_home
        home = get_hermes_home()
    except Exception:
        # Fallback for standalone usage outside Hermes context.
        import os
        hermes_home = os.environ.get("HERMES_HOME", "")
        if hermes_home:
            home = Path(hermes_home)
        else:
            home = Path.home() / ".hermes"

    plugin_dir = Path(__file__).parent
    skill_src_dir = plugin_dir / "skills" / "devops" / "cronalytics"
    if not skill_src_dir.exists():
        return

    skill_dst_dir = home / "skills" / "devops"
    skill_dst = skill_dst_dir / "cronalytics"

    # Idempotent: if already linked or a real directory exists, do nothing
    if skill_dst.exists() or skill_dst.is_symlink():
        return

    skill_dst_dir.mkdir(parents=True, exist_ok=True)
    skill_dst.symlink_to(skill_src_dir)


def register(ctx) -> None:
    """Wire hooks and ensure fact DB is ready."""
    # Make the skill discoverable by agents before any hooks fire.
    _ensure_skill_linked()
    # Eager schema creation so the DB exists before any hooks fire.
    facts.ensure_schema(config.FACT_DB)
    # Recover any orphaned pending items from a previous gateway run.
    ingester.start()
    ctx.register_hook("on_session_end", ingester.handle_session_end)

    # Background: backfill any cron sessions that completed while the
    # gateway was down or the plugin was disabled.
    def _bootstrap():
        try:
            from .cronalytics import scanner
            result = scanner.run_sync(config.STATE_DB, config.FACT_DB, config.WATERMARK_FILE)
            if result.get("inserted") or result.get("skipped"):
                logging.getLogger("cronalytics").info(
                    "Bootstrap scanner: %d inserted, %d skipped",
                    result.get("inserted", 0), result.get("skipped", 0),
                )
        except Exception:
            logging.getLogger("cronalytics").error(
                "Bootstrap scanner failed", exc_info=True,
            )

    threading.Thread(target=_bootstrap, name="cronalytics-bootstrap", daemon=True).start()
