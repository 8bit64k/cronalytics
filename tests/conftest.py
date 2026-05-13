"""Pytest configuration for cronalytics plugin tests.

The cronalytics plugin files are loaded dynamically by both Hermes gateway
(via package imports) and the dashboard server (via importlib as standalone
modules). This conftest enables pytest to run tests that import plugin modules
correctly regardless of load context.

Strategy:
1. Add the plugin root to sys.path so `import facts` works in test files.
2. Pre-load modules via importlib so they appear as standalone modules,
   matching the dashboard server's import pattern.
3. Provide shared fixtures for temporary fact DBs and watermark files.
"""

import contextlib
import json
import sys
import tempfile
import types
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Mock hermes_constants (not installed as a real package outside Hermes)
# ---------------------------------------------------------------------------

_hermes_constants = types.ModuleType("hermes_constants")
_hermes_constants.get_hermes_home = lambda: str(tempfile.mkdtemp())
sys.modules["hermes_constants"] = _hermes_constants

# ---------------------------------------------------------------------------
# Path setup —  mirror what the dashboard does via importlib
# ---------------------------------------------------------------------------

# Plugin root is the parent of this tests/ directory
_PLUGIN_ROOT = Path(__file__).resolve().parent.parent

# Make `import facts`, `import scanner` work from test files
if str(_PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(_PLUGIN_ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def plugin_root():
    """Return the absolute path to the plugin root directory."""
    return _PLUGIN_ROOT


@pytest.fixture
def temp_db():
    """Yield a path to a fresh temporary SQLite database.

    The file is cleaned up after the test.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = Path(f.name)
    yield path
    with contextlib.suppress(FileNotFoundError):
        path.unlink()


@pytest.fixture
def fact_db(temp_db):
    """Yield a temporary fact DB with schema already created."""
    import facts  # noqa: E402 — imported after sys.path setup above
    facts.ensure_schema(str(temp_db))
    return temp_db


@pytest.fixture
def temp_watermark():
    """Yield a path to a fresh temporary watermark JSON file."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
        json.dump({"last_ended_at": None, "last_sync": None, "rows_synced": 0}, f)
        path = Path(f.name)
    yield path
    with contextlib.suppress(FileNotFoundError):
        path.unlink()


@pytest.fixture
def sample_session_row():
    """Return a dict representing a typical state.db session row."""
    return {
        "id": "cron_841aee933270_20260429_222224",
        "platform": "cron",
        "model": "moonshotai/kimi-k2.6",
        "started_at": 1746450000.0,
        "ended_at": 1746450100.0,
        "duration_seconds": 100,
        "input_tokens": 1200,
        "output_tokens": 300,
        "reasoning_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "estimated_cost_usd": 0.0015,
        "actual_cost_usd": None,
        "cost_status": "calculated",
        "cost_source": "openrouter",
        "billing_provider": "openrouter",
        "api_call_count": 5,
        "message_count": 10,
        "tool_call_count": 2,
        "end_reason": "completed",
        "success": 1,
    }
