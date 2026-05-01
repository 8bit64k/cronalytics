"""Cron Insights plugin — registration.

Phase-0 skeleton: registers on_session_end hook and logs cron completions.
Phase-1 addition: fact DB + deferred ingestion with crash recovery.
"""

from __future__ import annotations

import logging
import threading

from . import config, facts, ingester


def register(ctx) -> None:
    """Wire hooks and ensure fact DB is ready."""
    # Eager schema creation so the DB exists before any hooks fire.
    facts.ensure_schema(config.FACT_DB)
    # Recover any orphaned pending items from a previous gateway run.
    ingester.start()
    ctx.register_hook("on_session_end", ingester.handle_session_end)

    # Background: backfill any cron sessions that completed while the
    # gateway was down or the plugin was disabled.
    def _bootstrap():
        try:
            from . import scanner
            result = scanner.run_sync(config.STATE_DB, config.FACT_DB, config.WATERMARK_FILE)
            if result.get("inserted") or result.get("skipped"):
                logging.getLogger("cron-insights").info(
                    "Bootstrap scanner: %d inserted, %d skipped",
                    result.get("inserted", 0), result.get("skipped", 0),
                )
        except Exception as exc:
            logging.getLogger("cron-insights").warning("Bootstrap scanner failed: %s", exc)

    threading.Thread(target=_bootstrap, name="cron-insights-bootstrap", daemon=True).start()
