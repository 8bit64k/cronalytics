"""Tests for dashboard/plugin_api.py — FastAPI endpoints.

Strategy: create a temporary plugin directory with mock config/logger and
real copies of facts/scanner/schedule. Load plugin_api from the temp dir so
its internal _load_module resolves against the temp copies.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import sqlite3
import time
from pathlib import Path

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent


def _seed_db(db_path: Path):
    """Insert sample rows into a fresh fact DB using recent timestamps."""
    now = time.time()
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        INSERT INTO cron_runs (
            session_id, job_id, run_time, ended_at, duration_seconds,
            model, input_tokens, output_tokens, reasoning_tokens,
            cache_read_tokens, cache_write_tokens,
            estimated_cost_usd, actual_cost_usd,
            cost_status, cost_source, billing_provider,
            api_call_count, message_count, tool_call_count,
            end_reason, success, job_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "cron_job_a_20260101_120000", "job_a", now - 86_400.0, now - 86_300.0, 100.0,
            "gpt-4o", 1000, 200, 0, 0, 0,
            0.01, None,
            "calculated", "openrouter", "openrouter",
            1, 1, 0,
            "completed", 1, "agent",
        ),
    )
    conn.execute(
        """
        INSERT INTO cron_runs (
            session_id, job_id, run_time, ended_at, duration_seconds,
            model, input_tokens, output_tokens, reasoning_tokens,
            cache_read_tokens, cache_write_tokens,
            estimated_cost_usd, actual_cost_usd,
            cost_status, cost_source, billing_provider,
            api_call_count, message_count, tool_call_count,
            end_reason, success, job_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "cron_job_a_20260101_130000", "job_a", now - 43_200.0, now - 43_100.0, 100.0,
            "gpt-4o", 1000, 200, 0, 0, 0,
            0.02, None,
            "calculated", "openrouter", "openrouter",
            1, 1, 0,
            "completed", 1, "agent",
        ),
    )
    conn.execute(
        """
        INSERT INTO cron_runs (
            session_id, job_id, run_time, ended_at, duration_seconds,
            model, input_tokens, output_tokens, reasoning_tokens,
            cache_read_tokens, cache_write_tokens,
            estimated_cost_usd, actual_cost_usd,
            cost_status, cost_source, billing_provider,
            api_call_count, message_count, tool_call_count,
            end_reason, success, job_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "cron_job_b_20260101_120000", "job_b", now - 86_400.0, now - 86_200.0, 200.0,
            "claude-sonnet", 2000, 400, 0, 0, 0,
            0.05, None,
            "calculated", "openrouter", "openrouter",
            2, 2, 1,
            "timeout", 0, "agent",
        ),
    )
    conn.commit()
    conn.close()


@pytest.fixture
def api_module(tmp_path: Path):
    """Yield a loaded plugin_api module pointing at a temp DB."""
    plugin_dir = tmp_path / "cronalytics_plugin"
    plugin_dir.mkdir()
    dashboard_dir = plugin_dir / "dashboard"
    dashboard_dir.mkdir()

    # Mock config.py — sets all paths inside tmp_path
    cronalytics_pkg = plugin_dir / "cronalytics"
    cronalytics_pkg.mkdir(exist_ok=True)
    (cronalytics_pkg / "config.py").write_text(
        f"""
from pathlib import Path
RETRY_DELAYS = [3.0, 8.0, 15.0]
JITTER_MAX = 2.0
MAX_RETRIES = 3
HERMES_HOME = Path("{tmp_path}")
STATE_DB = HERMES_HOME / "state.db"
FACT_DB = HERMES_HOME / "fact.db"
WATERMARK_FILE = HERMES_HOME / "watermark.json"
PENDING_FILE = HERMES_HOME / "pending.jsonl"
OUTPUT_DIR = HERMES_HOME / "cron" / "output"
PLUGIN_DIR = Path("{plugin_dir}")
"""
    )

    # Mock logger.py
    (cronalytics_pkg / "logger.py").write_text(
        """
import logging
logger = logging.getLogger("cronalytics")
"""
    )

    # Copy real modules (stdlib-only imports, safe in temp dir)
    for fname in ("__init__.py", "facts.py", "scanner.py", "schedule.py"):
        if (_PLUGIN_ROOT / "cronalytics" / fname).exists():
            shutil.copy(_PLUGIN_ROOT / "cronalytics" / fname, cronalytics_pkg / fname)

    # Copy plugin_api.py
    shutil.copy(
        _PLUGIN_ROOT / "dashboard" / "plugin_api.py",
        dashboard_dir / "plugin_api.py",
    )

    # Seed a real fact DB via the temp copy of facts.py
    spec = importlib.util.spec_from_file_location(
        "_test_facts", cronalytics_pkg / "facts.py"
    )
    facts_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(facts_mod)
    facts_mod.ensure_schema(tmp_path / "fact.db")
    _seed_db(tmp_path / "fact.db")

    # Create jobs.json for name resolution
    (tmp_path / "jobs.json").write_text(
        json.dumps(
            {
                "jobs": [
                    {
                        "id": "job_a",
                        "name": "Job A",
                        "schedule": {
                            "kind": "cron",
                            "expr": "0 9 * * *",
                            "display": "Daily at 9am",
                        },
                    },
                    {
                        "id": "job_b",
                        "name": "Job B",
                        "schedule": {
                            "kind": "cron",
                            "expr": "0 10 * * *",
                            "display": "Daily at 10am",
                        },
                    },
                ]
            }
        )
    )

    # Load plugin_api from the temp directory
    spec = importlib.util.spec_from_file_location(
        "_test_plugin_api",
        dashboard_dir / "plugin_api.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # Override jobs.json path to our temp file
    mod._JOBS_PATH = tmp_path / "jobs.json"

    # Mock scanner.run_sync to avoid needing a real Hermes state.db
    mod._scanner_mod.run_sync = lambda *_a, **_k: {
        "inserted": 0,
        "skipped": 0,
        "agent_rows": 0,
        "script_rows": 0,
    }

    return mod


@pytest.fixture
def client(api_module):
    """Build a TestClient for the plugin router."""
    app = FastAPI()
    app.include_router(api_module.router)
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_ok(self, client):
        """GET /health should return status=ok and version."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert data["status"] == "ok"
        assert data["version"] == "1.1.0"
        assert "fact_db" in data
        assert "sync" in data


class TestSummary:
    def test_default_params(self, client):
        """GET /summary with defaults should include aggregates."""
        response = client.get("/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert data["total_runs"] == 3
        assert data["total_estimated_cost"] > 0
        assert "nominal_monthly_total" in data
        assert "trend_monthly_total" in data
        assert "pace" in data

    def test_outcome_filter(self, client):
        """outcome=success should exclude failures."""
        response = client.get("/summary?outcome=success")
        assert response.status_code == 200
        data = response.json()
        assert data["total_runs"] == 2
        assert data["failure_runs"] == 0

    def test_zero_runs(self, client):
        """A very restrictive filter should return zero runs."""
        response = client.get("/summary?days=0&outcome=success&mode=no_agent")
        assert response.status_code == 200
        data = response.json()
        assert data["total_runs"] == 0


class TestJobs:
    def test_list_shape(self, client):
        """GET /jobs should return a list with enriched metadata."""
        response = client.get("/jobs")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert isinstance(data["jobs"], list)
        assert len(data["jobs"]) == 2

        job_a = next(j for j in data["jobs"] if j["job_id"] == "job_a")
        assert job_a["name"] == "Job A"
        assert job_a["runs"] == 2
        assert "projections" in job_a

    def test_skip_projections(self, client):
        """skip_projections=true should omit the projections key."""
        response = client.get("/jobs?skip_projections=true")
        assert response.status_code == 200
        data = response.json()
        for j in data["jobs"]:
            assert "projections" not in j


class TestJobRuns:
    def test_valid_job(self, client):
        """GET /jobs/{id}/runs should return run history."""
        response = client.get("/jobs/job_a/runs")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert data["job_id"] == "job_a"
        assert len(data["runs"]) == 2

    def test_unknown_job_404(self, client):
        """GET /jobs/{id}/runs for an unknown job should 404."""
        response = client.get("/jobs/nonexistent/runs")
        assert response.status_code == 404


class TestModels:
    def test_returns_breakdown(self, client):
        """GET /models should return per-model aggregates."""
        response = client.get("/models")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert isinstance(data["models"], list)
        assert len(data["models"]) >= 1


class TestTrends:
    def test_returns_daily_trend(self, client):
        """GET /trends should return daily cost trend data."""
        response = client.get("/trends")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert isinstance(data["trend"], list)


class TestSync:
    def test_triggers_sync(self, client):
        """POST /sync should trigger scanner and return result."""
        response = client.post("/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["plugin"] == "cronalytics"
        assert data["synced"] is True
        assert "result" in data
