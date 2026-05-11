"""Tests for scanner.py — watermark management and batch ingestion."""

from __future__ import annotations

import json
from pathlib import Path

import scanner


class TestWatermark:
    """Exercise _read_watermark and _write_watermark."""

    def test_read_missing_watermark(self, tmp_path: Path):
        """A missing watermark file should return the default structure."""
        missing = tmp_path / "missing.json"
        result = scanner._read_watermark(missing)
        assert result["last_ended_at"] == 0.0
        assert result["rows_synced"] == 0

    def test_round_trip(self, tmp_path: Path):
        """Write then read should preserve values."""
        path = tmp_path / "wm.json"
        scanner._write_watermark(path, 1_000.0, 42)
        result = scanner._read_watermark(path)
        assert result["last_ended_at"] == 1_000.0
        assert result["rows_synced"] == 42

    def test_corrupt_watermark_reset(self, tmp_path: Path):
        """Corrupt JSON should reset to defaults."""
        path = tmp_path / "bad.json"
        path.write_text("not json")
        result = scanner._read_watermark(path)
        assert result["last_ended_at"] == 0.0


class TestIngestBatch:
    """Exercise _ingest_batch idempotency."""

    def test_idempotency(self, fact_db):
        """Re-ingesting the same rows should skip without error."""
        rows = [
            {
                "id": "cron_test_20260101_120000",
                "source": "cron",
                "model": "gpt-4o",
                "started_at": 1_000_000.0,
                "ended_at": 1_000_100.0,
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
                "end_reason": "completed",
                "success": 1,
            }
        ]
        inserted1, skipped1 = scanner._ingest_batch(fact_db, rows)
        assert inserted1 == 1
        inserted2, skipped2 = scanner._ingest_batch(fact_db, rows)
        assert inserted2 == 0
        assert skipped2 == 1


class TestFetchNewSessions:
    """Exercise _fetch_new_sessions filtering."""

    def test_respects_watermark(self, tmp_path: Path):
        """Rows with ended_at <= since should be excluded."""
        db_path = tmp_path / "state.db"
        conn = scanner.sqlite3.connect(str(db_path))
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
            ("cron_old_20260101_120000", "cron", "gpt-4o", 1_000_000.0, 1_000_100.0,
             100, 1000, 200, 0, 0, 0, 0.01, None, "calculated", "openrouter", "openrouter",
             1, 1, 0, "completed", 1),
        )
        conn.commit()
        conn.close()

        rows = scanner._fetch_new_sessions(db_path, since=1_000_100.0)
        assert len(rows) == 0

    def test_ignores_non_cron(self, tmp_path: Path):
        """Non-cron source rows should be skipped."""
        db_path = tmp_path / "state.db"
        conn = scanner.sqlite3.connect(str(db_path))
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
            ("user_session", "api", "gpt-4o", 1_000_000.0, 1_000_100.0,
             100, 1000, 200, 0, 0, 0, 0.01, None, "calculated", "openrouter", "openrouter",
             1, 1, 0, "completed", 1),
        )
        conn.commit()
        conn.close()

        rows = scanner._fetch_new_sessions(db_path, since=0.0)
        assert len(rows) == 0


class TestLoadJobsJson:
    """Exercise _load_jobs_json helper."""

    def test_filters_no_agent(self, tmp_path: Path):
        """Only jobs with no_agent=True should be returned."""
        jobs_json = tmp_path / "jobs.json"
        jobs_json.write_text(
            json.dumps({
                "jobs": [
                    {"id": "agent_job", "name": "Agent Job", "no_agent": False},
                    {"id": "script_job", "name": "Script Job", "no_agent": True},
                ]
            })
        )
        jobs = scanner._load_jobs_json(jobs_json)
        assert len(jobs) == 1
        assert jobs[0]["id"] == "script_job"

    def test_missing_file(self, tmp_path: Path):
        """A missing jobs.json should return an empty list."""
        jobs = scanner._load_jobs_json(tmp_path / "missing.json")
        assert jobs == []
