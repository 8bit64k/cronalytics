"""Tests for schedule.py — cron interval counting and job projections."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from schedule import _count_occurrences, get_job_projections


class TestCountOccurrences:
    """Exercise _count_occurrences for various schedule kinds."""

    def test_interval_every_5_minutes(self):
        """A 5-minute interval over 1 day should produce ~288 occurrences."""
        now = datetime.now()
        assert _count_occurrences("interval", None, 5, now, now + timedelta(days=1)) == 288

    def test_interval_zero_minutes(self):
        """Zero-minute interval must not divide-by-zero; return 0."""
        now = datetime.now()
        assert _count_occurrences("interval", None, 0, now, now + timedelta(days=1)) == 0

    def test_cron_hourly(self):
        """An hourly cron over 7 days = 168 occurrences."""
        now = datetime.now()
        assert _count_occurrences("cron", "0 * * * *", None, now, now + timedelta(days=7)) == 168

    def test_cron_daily(self):
        """A daily cron over 30 days = 30 occurrences."""
        now = datetime.now()
        assert _count_occurrences("cron", "0 9 * * *", None, now, now + timedelta(days=30)) == 30

    def test_cron_weekly(self):
        """A weekly cron over 28 days = 4 occurrences."""
        now = datetime.now()
        assert _count_occurrences("cron", "0 9 * * 1", None, now, now + timedelta(days=28)) == 4

    def test_unknown_kind(self):
        """An unknown schedule kind falls back to 0."""
        now = datetime.now()
        assert _count_occurrences("unknown", None, None, now, now + timedelta(days=7)) == 0

    def test_safety_valve(self):
        """Cron safety valve caps at 100k; interval has no cap (raw math)."""
        now = datetime.now()
        # 1-minute interval for 365 days = 525,600 occurrences (no cap)
        assert _count_occurrences("interval", None, 1, now, now + timedelta(days=365)) == 525_600
        # Cron with * * * * * would be capped at 100k by the safety valve
        assert _count_occurrences("cron", "* * * * *", None, now, now + timedelta(days=365)) == 100_000


class TestGetJobProjections:
    """Exercise get_job_projections with synthetic job definitions."""

    @pytest.fixture
    def jobs_json(self, tmp_path: Path):
        """Write a minimal jobs.json and return its path."""
        path = tmp_path / "jobs.json"
        path.write_text(
            '{"jobs": [{"id": "daily_digest", "name": "Daily Digest", '
            '"schedule": {"kind": "cron", "expr": "0 9 * * *", "display": "Daily at 9am"}}]}'
        )
        return path

    def test_pace_ratio(self, jobs_json: Path):
        """When nominal == trend, pace should be exactly 1.0."""
        result = get_job_projections(
            "daily_digest",
            avg_cost=0.10,
            total_cost=3.00,
            runs=30,
            first_run=1_000_000.0,
            last_run=1_002_592.0,
            days_filter=30,
            jobs_json_path=jobs_json,
        )
        assert result is not None
        assert result["pace"] == pytest.approx(1.0, abs=0.01)

    def test_missing_job_def(self, tmp_path: Path):
        """When the job ID is not in jobs.json, return a dict with None schedule fields."""
        jobs_json = tmp_path / "jobs.json"
        jobs_json.write_text('{"jobs": []}')
        result = get_job_projections(
            "missing_job",
            avg_cost=0.10,
            total_cost=1.00,
            runs=10,
            first_run=1_000_000.0,
            last_run=1_000_864.0,
            days_filter=7,
            jobs_json_path=jobs_json,
        )
        assert result is not None
        assert result["schedule_display"] is None

    def test_drift_ratio(self, jobs_json: Path):
        """When actual runs < expected, drift < 1.0."""
        result = get_job_projections(
            "daily_digest",
            avg_cost=0.10,
            total_cost=1.00,
            runs=15,  # only half the expected 30 daily runs
            first_run=1_000_000.0,
            last_run=1_002_592.0,
            days_filter=30,
            jobs_json_path=jobs_json,
        )
        assert result is not None
        assert result["drift_ratio"] == pytest.approx(0.5, abs=0.01)

    def test_all_time_window(self, jobs_json: Path):
        """days_filter=0 means 'all time' — window should cover first_run to now."""
        now = datetime.now(UTC).timestamp()
        result = get_job_projections(
            "daily_digest",
            avg_cost=0.10,
            total_cost=3.00,
            runs=30,
            first_run=now - 2_592_000,  # 30 days ago
            last_run=now,
            days_filter=0,
            jobs_json_path=jobs_json,
        )
        assert result is not None
        assert result["observed_window_days"] >= 30
