"""Cron Insights plugin — registration.

Phase-0 skeleton: registers on_session_end hook and logs cron completions.
"""

from __future__ import annotations

from . import ingester


def register(ctx) -> None:
    """Wire hooks."""
    ctx.register_hook("on_session_end", ingester.handle_session_end)
