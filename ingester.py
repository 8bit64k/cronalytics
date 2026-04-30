"""Cron Insights — session ingestion handler.

Fires on every on_session_end, filters for platform=="cron",
and logs the session ID for capture.
"""

from __future__ import annotations

from typing import Any

from .logger import logger


def handle_session_end(
    session_id: str = "",
    completed: bool = True,
    interrupted: bool = False,
    model: str = "",
    platform: str = "",
    **_: Any,
) -> None:
    """Hook handler: capture cron job completions.

    Args:
        session_id: Hermes session identifier.
        completed: Whether the session ran to completion.
        interrupted: Whether the session was interrupted.
        model: Model slug used for the session.
        platform: Platform source ("cron", "cli", "telegram", etc.).
    """
    if platform != "cron":
        return

    logger.info("Captured: %s (model=%s, completed=%s)", session_id, model, completed)
