"""Tests for facts.py — ingestion, querying, and schema migration."""

from __future__ import annotations

import sqlite3
import time

import pytest

from facts import (
    ensure_schema,
    ingest_row,
    ingest_script_row,
    query_job_runs,
    query_jobs,
    query_summary,
)

_NOW = time.time()
_1H = 3600.0
_1D = 86400.0


class TestIngestRow:
    """Exercise the core ingestion helpers."""

    def test_insert_and_idempotency(self, fact_db):
        """First insert returns True; duplicate insert returns False (already present)."""
        row = {
            "id": "cron_test_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
            "input_tokens": 1000,
            "output_tokens": 200,
            "reasoning_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
            "estimated_cost_usd": 0.005,
            "actual_cost_usd": None,
            "cost_status": "calculated",
            "cost_source": "openrouter",
            "billing_provider": "openrouter",
            "api_call_count": 3,
            "message_count": 5,
            "tool_call_count": 1,
            "end_reason": "completed",
            "success": 1,
        }
        assert ingest_row(fact_db, row) is True
        assert ingest_row(fact_db, row) is False  # duplicate

    def test_unparseable_session_id(self, fact_db):
        """A session_id that does not match cron_ prefix should be rejected."""
        row = {"id": "not_a_cron_id"}
        assert ingest_row(fact_db, row) is False

    def test_script_row_zero_cost(self, fact_db):
        """Script rows have zero cost and no_agent mode."""
        run_time = _NOW - _1D
        assert ingest_script_row(fact_db, "backup_20260101_120000", run_time) is True
        conn = sqlite3.connect(str(fact_db))
        cursor = conn.cursor()
        session_id = f"script_backup_20260101_120000_{int(run_time)}"
        cursor.execute(
            "SELECT estimated_cost_usd, job_mode FROM cron_runs WHERE session_id = ?",
            (session_id,),
        )
        row = cursor.fetchone()
        assert row is not None
        cost, mode = row
        assert cost == 0.0
        assert mode == "no_agent"


class TestQuerySummary:
    """Exercise query_summary filtering and aggregation."""

    def test_empty_db(self, fact_db):
        """An empty DB should return zeroes across the board."""
        result = query_summary(fact_db, days=30)
        assert result["total_runs"] == 0
        assert result["total_estimated_cost"] is None

    def test_outcome_filtering(self, fact_db):
        """Outcome=success should only count successful runs."""
        ingest_row(fact_db, {
            "id": "cron_a_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
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
            "end_reason": "complete",
            "success": 1,
        })
        ingest_row(fact_db, {
            "id": "cron_b_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
            "input_tokens": 1000,
            "output_tokens": 200,
            "reasoning_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
            "estimated_cost_usd": 0.02,
            "actual_cost_usd": None,
            "cost_status": "calculated",
            "cost_source": "openrouter",
            "billing_provider": "openrouter",
            "api_call_count": 1,
            "message_count": 1,
            "tool_call_count": 0,
            "end_reason": "timeout",
            "success": 0,
        })
        result = query_summary(fact_db, days=30, outcome="success")
        assert result["total_runs"] == 1
        assert result["total_estimated_cost"] == pytest.approx(0.01)

    def test_mode_filtering(self, fact_db):
        """Mode=agent should exclude no_agent rows."""
        ingest_script_row(fact_db, "script_20260101_120000", _NOW - _1D)
        result = query_summary(fact_db, days=30, mode="agent")
        assert result["total_runs"] == 0


class TestQueryJobs:
    """Exercise query_jobs aggregation and combined filters."""

    def test_per_job_aggregation(self, fact_db):
        """Two runs for the same job should aggregate into one row."""
        base = {
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
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
            "end_reason": "complete",
            "success": 1,
        }
        ingest_row(fact_db, {**base, "id": "cron_job_a_20260101_120000"})
        ingest_row(fact_db, {**base, "id": "cron_job_a_20260101_130000"})
        jobs = query_jobs(fact_db, days=30)
        assert len(jobs) == 1
        assert jobs[0]["runs"] == 2

    def test_combined_filter(self, fact_db):
        """Outcome + mode filters intersect correctly."""
        ingest_row(fact_db, {
            "id": "cron_job_a_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
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
            "end_reason": "complete",
            "success": 1,
        })
        ingest_script_row(fact_db, "script_20260101_120000", _NOW - _1D)
        jobs = query_jobs(fact_db, days=30, outcome="success", mode="agent")
        assert len(jobs) == 1
        assert jobs[0]["job_id"] == "job_a"


class TestQueryJobRuns:
    """Exercise query_job_runs sorting and limit behaviour."""

    def test_sorting_and_limit(self, fact_db):
        """Sorting by estimated_cost_usd desc should return highest-cost first."""
        base = {
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
            "input_tokens": 1000,
            "output_tokens": 200,
            "reasoning_tokens": 0,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
            "actual_cost_usd": None,
            "cost_status": "calculated",
            "cost_source": "openrouter",
            "billing_provider": "openrouter",
            "api_call_count": 1,
            "message_count": 1,
            "tool_call_count": 0,
            "end_reason": "complete",
            "success": 1,
        }
        ingest_row(fact_db, {**base, "id": "cron_job_a_20260101_120000", "estimated_cost_usd": 0.01})
        ingest_row(fact_db, {**base, "id": "cron_job_a_20260101_130000", "estimated_cost_usd": 0.05})
        runs = query_job_runs(fact_db, "job_a", limit=10, sort_key="estimated_cost_usd", sort_dir="desc")
        assert runs[0]["estimated_cost_usd"] == pytest.approx(0.05)

    def test_invalid_sort_key_fallback(self, fact_db):
        """An unknown sort_key falls back to run_time."""
        ingest_row(fact_db, {
            "id": "cron_job_a_20260101_120000",
            "source": "cron",
            "model": "gpt-4o",
            "started_at": _NOW - _1D,
            "ended_at": _NOW - _1D + 100.0,
            "duration_seconds": 100,
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
            "end_reason": "complete",
            "success": 1,
        })
        # Should not raise despite bogus sort_key
        runs = query_job_runs(fact_db, "job_a", limit=10, sort_key="bogus", sort_dir="asc")
        assert len(runs) == 1


class TestSchemaMigration:
    """Verify forward-compatibility of schema changes."""

    def test_adds_job_mode_column(self, tmp_path):
        """ensure_schema should add job_mode to an existing table missing it."""
        db_path = tmp_path / "legacy.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            """
            CREATE TABLE cron_runs (
                session_id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                run_time REAL NOT NULL,
                ended_at REAL,
                duration_seconds REAL,
                model TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                reasoning_tokens INTEGER DEFAULT 0,
                cache_read_tokens INTEGER DEFAULT 0,
                cache_write_tokens INTEGER DEFAULT 0,
                estimated_cost_usd REAL,
                actual_cost_usd REAL,
                cost_status TEXT,
                cost_source TEXT,
                billing_provider TEXT,
                api_call_count INTEGER DEFAULT 0,
                message_count INTEGER DEFAULT 0,
                tool_call_count INTEGER DEFAULT 0,
                end_reason TEXT,
                success BOOLEAN,
                ingested_at REAL DEFAULT (unixepoch())
            )
            """
        )
        conn.commit()
        conn.close()

        ensure_schema(db_path)

        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(cron_runs)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        assert "job_mode" in columns
