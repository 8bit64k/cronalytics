"""Cron Insights plugin — registration.

Phase-0 skeleton: registers on_session_end hook and logs cron completions.
Phase-1 addition: fact DB + deferred ingestion with crash recovery.
"""

from __future__ import annotations

from . import config, facts, ingester


def register(ctx) -> None:
    """Wire hooks and ensure fact DB is ready."""
    # Eager schema creation so the DB exists before any hooks fire.
    facts.ensure_schema(config.FACT_DB)
    # Recover any orphaned pending items from a previous gateway run.
    ingester.start()
    ctx.register_hook("on_session_end", ingester.handle_session_end)
