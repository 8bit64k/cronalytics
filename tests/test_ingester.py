"""Tests for ingester.py — hook handler, pending queue, worker loop.

Uses importlib with fake package context so relative imports resolve.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Load ingester with fake package context (relative imports)
# ---------------------------------------------------------------------------

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
_PKG_NAME = "cronalytics_test_pkg"


def _load_module(name: str):
    """Load a sibling module from the plugin root into the fake package."""
    mod_path = _PLUGIN_ROOT / "cronalytics" / f"{name}.py"
    full_name = f"{_PKG_NAME}.{name}"
    spec = importlib.util.spec_from_file_location(full_name, mod_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = mod
    spec.loader.exec_module(mod)
    return mod


# Ensure fake package exists
if _PKG_NAME not in sys.modules:
    pkg = type(sys)(_PKG_NAME)
    pkg.__path__ = [str(_PLUGIN_ROOT)]
    sys.modules[_PKG_NAME] = pkg

# Pre-load dependencies so ingester's relative imports resolve
for _dep in ("facts", "config", "logger"):
    _load_module(_dep)

# Load ingester itself
_ingester_spec = importlib.util.spec_from_file_location(
    f"{_PKG_NAME}.ingester", _PLUGIN_ROOT / "cronalytics" / "ingester.py"
)
ingester = importlib.util.module_from_spec(_ingester_spec)
ingester.__package__ = _PKG_NAME
sys.modules[f"{_PKG_NAME}.ingester"] = ingester
_ingester_spec.loader.exec_module(ingester)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_globals():
    """Reset module-level mutable state between tests."""
    with ingester._queue_lock:
        ingester._queue.clear()
    ingester._worker_stop.set()
    ingester._worker_thread = None
    yield
    # Teardown
    ingester._worker_stop.set()
    ingester._worker_thread = None
    with ingester._queue_lock:
        ingester._queue.clear()


@pytest.fixture
def temp_pending(tmp_path: Path):
    """Yield a temp pending file path and patch PENDING_FILE."""
    pending = tmp_path / "pending.jsonl"
    orig = ingester.PENDING_FILE
    ingester.PENDING_FILE = pending
    yield pending
    ingester.PENDING_FILE = orig


@pytest.fixture
def mock_fact_db(tmp_path: Path):
    """Create a temp fact DB and patch FACT_DB."""
    db_path = tmp_path / "facts.db"
    from cronalytics import facts  # noqa: E402 — conftest has this on sys.path
    facts.ensure_schema(db_path)
    orig = ingester.FACT_DB
    ingester.FACT_DB = db_path
    yield db_path
    ingester.FACT_DB = orig


# ---------------------------------------------------------------------------
# handle_session_end
# ---------------------------------------------------------------------------

class TestHandleSessionEnd:
    def test_skips_non_cron_platform(self, temp_pending):
        """Telegram sessions should be ignored."""
        ingester.handle_session_end(
            session_id="telegram_abc_20260101_120000",
            platform="telegram",
            model="gpt-4o",
        )
        assert not temp_pending.exists() or temp_pending.read_text() == ""
        assert len(ingester._queue) == 0

    def test_enqueues_cron_session(self, temp_pending):
        """Cron sessions should be written to pending and enqueued."""
        with patch.object(ingester, "_ensure_worker"):
            ingester.handle_session_end(
                session_id="cron_job_a_20260101_120000",
                platform="cron",
                model="gpt-4o",
                completed=True,
            )
        # Pending file should have one line
        lines = temp_pending.read_text().strip().split("\n")
        assert len(lines) == 1
        data = json.loads(lines[0])
        assert data["session_id"] == "cron_job_a_20260101_120000"
        assert data["model"] == "gpt-4o"
        assert data["completed"] is True
        # Queue should have one item (worker not started)
        assert len(ingester._queue) == 1

    def test_cli_sessions_ignored(self, temp_pending):
        """CLI sessions should return immediately."""
        ingester.handle_session_end(
            session_id="cli_abc_20260101_120000",
            platform="cli",
            model="gpt-4o",
        )
        assert not temp_pending.exists() or temp_pending.read_text() == ""


# ---------------------------------------------------------------------------
# Pending file helpers
# ---------------------------------------------------------------------------

class TestPendingFileOps:
    def test_append_pending_creates_file(self, temp_pending):
        """_append_pending should create the file if absent."""
        assert not temp_pending.exists()
        ingester._append_pending({"session_id": "x", "model": "m"})
        assert temp_pending.exists()

    def test_append_pending_multiple_items(self, temp_pending):
        """Multiple appends should produce separate lines."""
        ingester._append_pending({"session_id": "a", "model": "m1"})
        ingester._append_pending({"session_id": "b", "model": "m2"})
        lines = temp_pending.read_text().strip().split("\n")
        assert len(lines) == 2

    def test_remove_pending_drops_session(self, temp_pending):
        """_remove_pending should rewrite file without the target session."""
        for sid in ("a", "b", "c"):
            ingester._append_pending({"session_id": sid, "model": "m"})
        ingester._remove_pending("b")
        lines = temp_pending.read_text().strip().split("\n")
        sids = {json.loads(line)["session_id"] for line in lines}
        assert sids == {"a", "c"}

    def test_remove_pending_noop_if_missing(self, temp_pending):
        """Removing from a non-existent file should not crash."""
        ingester._remove_pending("nonexistent")  # no crash

    def test_recover_pending_loads_orphans(self, temp_pending):
        """_recover_pending should load items back into the queue."""
        for sid in ("x", "y"):
            ingester._append_pending({"session_id": sid, "model": "m", "retries": 0})
        ingester._queue.clear()  # Simulate fresh start
        count = ingester._recover_pending()
        assert count == 2
        assert len(ingester._queue) == 2

    def test_recover_pending_ignores_garbage(self, temp_pending):
        """Malformed lines should be skipped."""
        temp_pending.write_text("not json\n{\"session_id\": \"good\", \"model\": \"m\"}\n")
        count = ingester._recover_pending()
        assert count == 1

    def test_recover_pending_empty_file(self, temp_pending):
        """Empty file should return 0."""
        temp_pending.write_text("")
        assert ingester._recover_pending() == 0

    def test_recover_pending_missing_file(self):
        """Missing file should return 0."""
        # Point to a non-existent path temporarily
        orig = ingester.PENDING_FILE
        ingester.PENDING_FILE = Path("/tmp/does_not_exist_12345.jsonl")
        try:
            assert ingester._recover_pending() == 0
        finally:
            ingester.PENDING_FILE = orig


# ---------------------------------------------------------------------------
# _query_state_db
# ---------------------------------------------------------------------------

class TestQueryStateDb:
    def test_returns_row_when_present(self, tmp_path: Path):
        """Should return a dict when the session exists in state.db."""
        db_path = tmp_path / "state.db"
        import sqlite3  # noqa: E402
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE sessions (
                id TEXT, source TEXT, model TEXT, started_at REAL, ended_at REAL,
                duration_seconds REAL, input_tokens INTEGER, output_tokens INTEGER,
                reasoning_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER,
                estimated_cost_usd REAL, actual_cost_usd REAL, cost_status TEXT,
                cost_source TEXT, billing_provider TEXT, api_call_count INTEGER,
                message_count INTEGER, tool_call_count INTEGER, end_reason TEXT, success INTEGER
            )
            """
        )
        conn.execute(
            "INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ("cron_a_20260101_120000", "cron", "gpt-4o", 1_000_000.0, 1_000_100.0,
             100, 1000, 200, 0, 0, 0, 0.01, None, "calculated", "openrouter", "openrouter",
             1, 1, 0, "completed", 1),
        )
        conn.commit()
        conn.close()

        orig = ingester.STATE_DB
        ingester.STATE_DB = db_path
        try:
            row = ingester._query_state_db("cron_a_20260101_120000")
            assert row is not None
            assert row["id"] == "cron_a_20260101_120000"
            assert row["model"] == "gpt-4o"
        finally:
            ingester.STATE_DB = orig

    def test_returns_none_when_missing(self, tmp_path: Path):
        """Should return None when session is not in state.db."""
        db_path = tmp_path / "state.db"
        import sqlite3  # noqa: E402
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            "CREATE TABLE sessions (id TEXT PRIMARY KEY, model TEXT)"
        )
        conn.commit()
        conn.close()

        orig = ingester.STATE_DB
        ingester.STATE_DB = db_path
        try:
            assert ingester._query_state_db("missing") is None
        finally:
            ingester.STATE_DB = orig

    def test_returns_none_on_sqlite_error(self):
        """Should return None (not raise) when state.db query fails."""
        orig = ingester.STATE_DB
        ingester.STATE_DB = Path("/tmp/does_not_exist_12345.db")
        try:
            assert ingester._query_state_db("any") is None
        finally:
            ingester.STATE_DB = orig


# ---------------------------------------------------------------------------
# _delay_for_attempt
# ---------------------------------------------------------------------------

class TestDelayForAttempt:
    def test_first_attempt(self):
        """Attempt 0 should use RETRY_DELAYS[0] + jitter."""
        delay = ingester._delay_for_attempt(0)
        assert delay >= ingester.RETRY_DELAYS[0]
        assert delay <= ingester.RETRY_DELAYS[0] + ingester.JITTER_MAX

    def test_last_defined_attempt(self):
        """Attempt at the end of the list should still be valid."""
        last = len(ingester.RETRY_DELAYS) - 1
        delay = ingester._delay_for_attempt(last)
        assert delay >= ingester.RETRY_DELAYS[last]

    def test_overflow_uses_last_plus_jitter(self):
        """Attempts beyond the list should clamp to last + jitter."""
        delay = ingester._delay_for_attempt(999)
        assert delay >= ingester.RETRY_DELAYS[-1]
        assert delay <= ingester.RETRY_DELAYS[-1] + ingester.JITTER_MAX


# ---------------------------------------------------------------------------
# _process_one
# ---------------------------------------------------------------------------

class TestProcessOne:
    def test_successful_ingestion(self, mock_fact_db, temp_pending):
        """When state.db row exists, should ingest and remove from pending."""
        # Mock _query_state_db to return a valid row
        fake_row = {
            "id": "cron_job_a_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": 1_000_000.0,
            "ended_at": 1_000_100.0,
            "input_tokens": 1000,
            "output_tokens": 200,
            "reasoning_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
            "estimated_cost_usd": 0.01,
            "actual_cost_usd": None,
            "cost_status": "calculated",
            "cost_source": "openrouter",
            "billing_provider": "openrouter",
            "api_call_count": 1,
            "message_count": 1,
            "tool_call_count": 0,
            "end_reason": "completed",
            "success": 1,
        }
        with patch.object(ingester, "_query_state_db", return_value=fake_row):
            ingester._append_pending({"session_id": "cron_job_a_20260101_120000", "model": "gpt-4o", "retries": 0})
            item = {"session_id": "cron_job_a_20260101_120000", "model": "gpt-4o", "retries": 0}
            resolved = ingester._process_one(item)

        assert resolved is True
        # Should be removed from pending
        if temp_pending.exists():
            text = temp_pending.read_text()
            assert "cron_job_a_20260101_120000" not in text

    def test_retry_when_row_not_found(self, temp_pending):
        """When state.db row is absent, should re-enqueue for retry."""
        with patch.object(ingester, "_query_state_db", return_value=None):
            with patch.object(ingester, "_delay_for_attempt", return_value=0.01):
                item = {"session_id": "missing", "model": "gpt-4o", "retries": 0}
                resolved = ingester._process_one(item)

        assert resolved is False
        assert item["retries"] == 1
        assert len(ingester._queue) == 1  # re-enqueued

    def test_drop_after_max_retries(self, temp_pending):
        """After exhausting retries, should drop and remove from pending."""
        with patch.object(ingester, "_query_state_db", return_value=None):
            with patch.object(ingester, "_delay_for_attempt", return_value=0.01):
                item = {"session_id": "missing", "model": "gpt-4o", "retries": len(ingester.RETRY_DELAYS)}
                resolved = ingester._process_one(item)

        assert resolved is True  # marked as resolved (dropped)


# ---------------------------------------------------------------------------
# _ensure_worker
# ---------------------------------------------------------------------------

class TestEnsureWorker:
    def test_starts_worker_once(self):
        """Multiple calls should start only one thread."""
        ingester._ensure_worker()
        t1 = ingester._worker_thread
        ingester._ensure_worker()
        t2 = ingester._worker_thread
        assert t1 is t2
        assert t1.is_alive()
        # Stop it
        ingester._worker_stop.set()
        t1.join(timeout=2.0)

    def test_restarts_after_stop(self):
        """After the worker stops, a fresh call should start a new thread."""
        ingester._ensure_worker()
        t1 = ingester._worker_thread
        ingester._worker_stop.set()
        t1.join(timeout=2.0)
        ingester._worker_thread = None
        ingester._worker_stop.clear()

        ingester._ensure_worker()
        t2 = ingester._worker_thread
        assert t2 is not None
        assert t2 is not t1
        assert t2.is_alive()
        ingester._worker_stop.set()
        t2.join(timeout=2.0)


# ---------------------------------------------------------------------------
# start()
# ---------------------------------------------------------------------------

class TestStart:
    def test_recovers_and_starts_worker(self, temp_pending):
        """start() should recover pending items and start the worker."""
        ingester._append_pending({"session_id": "orphan", "model": "gpt-4o", "retries": 0})
        ingester._queue.clear()
        ingester._worker_thread = None

        with patch.object(ingester, "_ensure_worker"):
            ingester.start()
        # Items recovered even without worker start
        assert len(ingester._queue) == 1
        # Worker should NOT have been started by the mock
        assert ingester._worker_thread is None

    def test_noop_when_no_pending(self, temp_pending):
        """start() with no pending items should not start a worker."""
        ingester._worker_thread = None
        ingester.start()
        assert ingester._worker_thread is None
