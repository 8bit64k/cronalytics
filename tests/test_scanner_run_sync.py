"""Tests for scanner.py — run_sync, get_status, and _scan_output_dirs."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import facts
import scanner


class TestRunSync:
    """Exercise run_sync with mocked dependencies."""

    def test_no_new_rows_watermark_unchanged(self, fact_db, tmp_path: Path):
        """When _fetch_new_sessions returns nothing, watermark stays the same."""
        wm_path = tmp_path / "watermark.json"
        scanner._write_watermark(wm_path, 1000.0, 5)
        state_db = tmp_path / "state.db"

        with patch.object(scanner, "_fetch_new_sessions", return_value=[]), patch.object(
            scanner, "_scan_output_dirs", return_value=(0, 0)
        ):
            result = scanner.run_sync(state_db, fact_db, wm_path)

        wm = scanner._read_watermark(wm_path)
        assert wm["last_ended_at"] == 1000.0
        assert wm["rows_synced"] == 5
        assert result["inserted"] == 0
        assert result["skipped"] == 0
        assert result["total_candidates"] == 0
        assert result["new_watermark"] == 1000.0

    def test_new_agent_rows_ingested_and_watermark_advanced(self, fact_db, tmp_path: Path):
        """New agent rows are inserted into the fact DB and the watermark advances."""
        wm_path = tmp_path / "watermark.json"
        scanner._write_watermark(wm_path, 1000.0, 5)
        state_db = tmp_path / "state.db"

        rows = [
            {
                "id": "cron_testjob_20260101_120000",
                "source": "cron",
                "model": "gpt-4o",
                "started_at": 1_000_100.0,
                "ended_at": 1_000_200.0,
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

        with patch.object(scanner, "_fetch_new_sessions", return_value=rows), patch.object(
            scanner, "_scan_output_dirs", return_value=(0, 0)
        ):
            result = scanner.run_sync(state_db, fact_db, wm_path)

        wm = scanner._read_watermark(wm_path)
        assert wm["last_ended_at"] == 1_000_200.0
        assert wm["rows_synced"] == 1  # inserted + skipped for agent track
        assert result["agent_inserted"] == 1
        assert result["agent_skipped"] == 0
        assert result["inserted"] == 1
        assert result["skipped"] == 0

        # Verify actual insertion via real facts module
        conn = facts.sqlite3.connect(str(fact_db))
        cursor = conn.execute(
            "SELECT session_id, job_mode FROM cron_runs WHERE session_id = ?",
            ("cron_testjob_20260101_120000",),
        )
        row = cursor.fetchone()
        assert row is not None
        assert row[1] == "agent"
        conn.close()

    def test_new_script_rows(self, fact_db, tmp_path: Path):
        """Script-only sync contributes counts to the returned summary."""
        wm_path = tmp_path / "watermark.json"
        scanner._write_watermark(wm_path, 0.0, 0)
        state_db = tmp_path / "state.db"

        with patch.object(scanner, "_fetch_new_sessions", return_value=[]), patch.object(
            scanner, "_scan_output_dirs", return_value=(3, 1)
        ):
            result = scanner.run_sync(state_db, fact_db, wm_path)

        assert result["script_inserted"] == 3
        assert result["script_skipped"] == 1
        assert result["inserted"] == 3
        assert result["skipped"] == 1
        assert result["total_candidates"] == 0
        # Watermark stays same because there were no agent rows
        wm = scanner._read_watermark(wm_path)
        assert wm["last_ended_at"] == 0.0

    def test_mixed_agent_and_script(self, fact_db, tmp_path: Path):
        """Both agent and script tracks are reconciled in one pass."""
        wm_path = tmp_path / "watermark.json"
        scanner._write_watermark(wm_path, 500.0, 10)
        state_db = tmp_path / "state.db"

        rows = [
            {
                "id": "cron_job1_20260101_120000",
                "source": "cron",
                "model": "gpt-4o",
                "started_at": 600.0,
                "ended_at": 700.0,
                "input_tokens": 100,
                "output_tokens": 50,
                "reasoning_tokens": 0,
                "cache_read_tokens": 0,
                "cache_write_tokens": 0,
                "estimated_cost_usd": 0.001,
                "actual_cost_usd": None,
                "cost_status": "calculated",
                "cost_source": "openrouter",
                "billing_provider": "openrouter",
                "api_call_count": 1,
                "message_count": 1,
                "tool_call_count": 0,
                "end_reason": "completed",
                "success": 1,
            },
            {
                "id": "cron_job2_20260101_130000",
                "source": "cron",
                "model": "gpt-4o",
                "started_at": 800.0,
                "ended_at": 900.0,
                "input_tokens": 200,
                "output_tokens": 100,
                "reasoning_tokens": 0,
                "cache_read_tokens": 0,
                "cache_write_tokens": 0,
                "estimated_cost_usd": 0.002,
                "actual_cost_usd": None,
                "cost_status": "calculated",
                "cost_source": "openrouter",
                "billing_provider": "openrouter",
                "api_call_count": 1,
                "message_count": 2,
                "tool_call_count": 0,
                "end_reason": "completed",
                "success": 1,
            },
        ]

        with patch.object(scanner, "_fetch_new_sessions", return_value=rows), patch.object(
            scanner, "_scan_output_dirs", return_value=(1, 2)
        ):
            result = scanner.run_sync(state_db, fact_db, wm_path)

        assert result["agent_inserted"] == 2
        assert result["agent_skipped"] == 0
        assert result["script_inserted"] == 1
        assert result["script_skipped"] == 2
        assert result["inserted"] == 3
        assert result["skipped"] == 2
        assert result["total_candidates"] == 2
        assert result["new_watermark"] == 900.0

        wm = scanner._read_watermark(wm_path)
        assert wm["last_ended_at"] == 900.0
        # rows_synced tracks only the agent batch (behaviour of current implementation)
        assert wm["rows_synced"] == 2

    def test_null_watermark_regression(self, fact_db, tmp_path: Path):
        """A watermark JSON with last_ended_at=null must not crash run_sync."""
        wm_path = tmp_path / "watermark.json"
        wm_path.write_text(json.dumps({"last_ended_at": None, "last_sync": None, "rows_synced": 0}))
        state_db = tmp_path / "state.db"

        with patch.object(scanner, "_fetch_new_sessions", return_value=[]), patch.object(
            scanner, "_scan_output_dirs", return_value=(0, 0)
        ):
            result = scanner.run_sync(state_db, fact_db, wm_path)

        assert result["inserted"] == 0
        assert result["skipped"] == 0
        assert result["new_watermark"] == 0.0

        wm = scanner._read_watermark(wm_path)
        assert wm["last_ended_at"] == 0.0


class TestGetStatus:
    """Exercise get_status metadata helper."""

    def test_missing_watermark(self, tmp_path: Path):
        """Missing watermark should report defaults."""
        missing = tmp_path / "missing.json"
        status = scanner.get_status(missing)
        assert status["watermark_file_exists"] is False
        assert status["last_ended_at"] == 0.0
        assert status["rows_synced"] == 0
        assert status["last_sync"] is None
        assert status["watermark_file_path"] == str(missing)

    def test_existing_watermark(self, tmp_path: Path):
        """Existing watermark should surface persisted values."""
        wm_path = tmp_path / "wm.json"
        scanner._write_watermark(wm_path, 1234.0, 42)
        status = scanner.get_status(wm_path)
        assert status["watermark_file_exists"] is True
        assert status["last_ended_at"] == 1234.0
        assert status["rows_synced"] == 42
        assert isinstance(status["last_sync"], str)
        assert status["watermark_file_path"] == str(wm_path)


class TestScanOutputDirs:
    """Exercise _scan_output_dirs end-to-end with real filesystem artifacts."""

    def test_finds_md_files_and_parses_timestamps(self, fact_db, tmp_path: Path):
        """Valid .md filenames are parsed and inserted as no_agent rows."""
        output_dir = tmp_path / "output"
        jobs_json = tmp_path / "jobs.json"

        jobs_json.write_text(
            json.dumps(
                {
                    "jobs": [
                        {"id": "backup_daily", "name": "Daily Backup", "no_agent": True},
                    ]
                }
            )
        )

        job_dir = output_dir / "backup_daily"
        job_dir.mkdir(parents=True)

        # Valid timestamp filenames
        (job_dir / "2026-05-10_10-53-01.md").write_text("# backup 1")
        (job_dir / "2026-05-10_11-00-00.md").write_text("# backup 2")
        # Invalid filename — parser should skip
        (job_dir / "readme.md").write_text("# readme")

        inserted, skipped = scanner._scan_output_dirs(output_dir, jobs_json, fact_db)
        assert inserted == 2
        assert skipped == 0

        conn = facts.sqlite3.connect(str(fact_db))
        cursor = conn.execute(
            "SELECT count(*) FROM cron_runs WHERE job_mode = 'no_agent'"
        )
        assert cursor.fetchone()[0] == 2

        cursor = conn.execute(
            "SELECT job_id, session_id FROM cron_runs WHERE job_mode = 'no_agent'"
        )
        rows = {r[1] for r in cursor.fetchall()}
        assert any("backup_daily" in sid for sid in rows)
        conn.close()

    def test_respects_watermark_on_second_scan(self, fact_db, tmp_path: Path):
        """Re-scanning the same directory should skip already-ingested files."""
        output_dir = tmp_path / "output"
        jobs_json = tmp_path / "jobs.json"

        jobs_json.write_text(
            json.dumps(
                {
                    "jobs": [
                        {"id": "sync_job", "name": "Sync", "no_agent": True},
                    ]
                }
            )
        )

        job_dir = output_dir / "sync_job"
        job_dir.mkdir(parents=True)
        (job_dir / "2026-05-10_10-53-01.md").write_text("# sync")

        inserted1, skipped1 = scanner._scan_output_dirs(output_dir, jobs_json, fact_db)
        assert inserted1 == 1
        assert skipped1 == 0

        inserted2, skipped2 = scanner._scan_output_dirs(output_dir, jobs_json, fact_db)
        assert inserted2 == 0
        assert skipped2 == 1

        conn = facts.sqlite3.connect(str(fact_db))
        cursor = conn.execute(
            "SELECT count(*) FROM cron_runs WHERE job_id = ? AND job_mode = 'no_agent'",
            ("sync_job",),
        )
        assert cursor.fetchone()[0] == 1
        conn.close()
