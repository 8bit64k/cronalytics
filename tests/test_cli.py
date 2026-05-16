"""Tests for cli.py — formatting helpers, data functions, and integration."""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

# cli.py manipulates sys.path at module level; conftest handles the setup.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cli import (  # noqa: I001
    JOBS_LAYOUT,
    JOBS_SEP_WIDTH,
    LEADER_BOARD_LAYOUT,
    LEADER_BOARD_SEP_WIDTH,
    MODELS_LAYOUT,
    MODELS_SEP_WIDTH,
    RUNS_LAYOUT,
    RUNS_SEP_WIDTH,
    SUMMARY_MODEL_LAYOUT,
    SUMMARY_MODEL_SEP_WIDTH,
    _bar_chart,
    _banner,
    _banner_line,
    _build_separator,
    _build_table_header,
    _compute_leader_board,
    _db_date_range,
    _fmt_cost,
    _fmt_dt,
    _fmt_tokens,
    _human_date_range,
    _job_label,
    _json_dates,
    _json_envelope,
    _load_job_names,
    _render_health,
    _resolve_db,
    _visual_len,
    _JOBS_NAME_MAX_AGENT,
    _JOBS_NAME_MAX_NO_AGENT,
    main,
)


# ---------------------------------------------------------------------------
# Pure formatting helpers
# ---------------------------------------------------------------------------

class TestFmtCost:
    """_fmt_cost converts numeric cost to a human-readable US-dollar string."""

    def test_none_returns_dash(self):
        assert _fmt_cost(None) == "—"

    def test_zero(self):
        assert _fmt_cost(0) == "$0.00"

    def test_small_value(self):
        assert _fmt_cost(0.5) == "$0.50"

    def test_thousands_separator(self):
        assert _fmt_cost(1234.56) == "$1,234.56"


class TestFmtTokens:
    """_fmt_tokens converts raw token counts to compact K/M strings."""

    def test_small_number(self):
        assert _fmt_tokens(42) == "42"

    def test_exact_thousand(self):
        assert _fmt_tokens(1_000) == "1K"

    def test_millions(self):
        assert _fmt_tokens(2_500_000) == "2.5M"


class TestFmtDt:
    """_fmt_dt converts Unix timestamps to 'Mon DD HH:MM'."""

    def test_none_returns_dash(self):
        assert _fmt_dt(None) == "—"

    def test_zero_returns_dash(self):
        assert _fmt_dt(0.0) == "—"

    def test_known_timestamp(self):
        ts = datetime(2026, 5, 15, 9, 30, tzinfo=None).timestamp()
        assert _fmt_dt(ts) == "May 15 09:30"


class TestBarChart:
    """_bar_chart scales Unicode block chars proportionally to values."""

    def test_empty_list(self):
        assert _bar_chart([]) == []

    def test_all_zeros(self):
        assert _bar_chart([0, 0, 0]) == ["", "", ""]

    def test_peaks_at_max_width(self):
        bars = _bar_chart([1, 2, 4], max_width=10)
        assert len(bars) == 3
        assert len(bars[0]) == 2  # 1/4 * 10 = 2.5 → max(1, 2) = 2
        assert len(bars[1]) == 5  # 2/4 * 10 = 5
        assert len(bars[2]) == 10  # peak

    def test_zero_values_get_empty_string(self):
        bars = _bar_chart([0, 5], max_width=10)
        assert bars[0] == ""
        assert len(bars[1]) == 10


class TestVisualLen:
    """_visual_len counts East-Asian wide characters as width 2."""

    def test_ascii(self):
        assert _visual_len("hello") == 5

    def test_emoji(self):
        assert _visual_len("📊") == 2  # most emojis are "W" (wide)


class TestBannerLine:
    """_banner_line centres text inside a box-drawing line."""

    def test_short_text(self):
        line = _banner_line("hello", inner_width=10)
        assert line.startswith("  ║")
        assert line.endswith("║")
        # "  " + "║" + left_pad + text + right_pad + "║"
        # "  ║" + "  " + "hello" + "   " + "║"  → 14 chars total
        assert len(line) == 14

    def test_text_longer_than_inner_width(self):
        line = _banner_line("x" * 20, inner_width=10)
        assert "x" * 20 in line


class TestBanner:
    """_banner builds top border, title, optional subtitle, bottom border."""

    def test_title_only(self):
        lines = _banner("Title", inner_width=10)
        assert len(lines) == 3
        assert "╔" in lines[0]
        assert "Title" in lines[1]
        assert "╚" in lines[2]

    def test_with_subtitle(self):
        lines = _banner("Title", "Sub", inner_width=10)
        assert len(lines) == 4
        assert "Sub" in lines[2]


class TestBuildTableHeader:
    """_build_table_header formats column headers with correct alignment."""

    def test_jobs_header(self):
        header = _build_table_header(JOBS_LAYOUT)
        assert "Job ID" in header
        assert "Runs" in header
        assert "Cost" in header

    def test_runs_header(self):
        header = _build_table_header(RUNS_LAYOUT)
        assert "Time" in header
        assert "✓" in header


class TestBuildSeparator:
    """_build_separator returns a repeated box-drawing line of correct width."""

    def test_standard_width(self):
        sep = _build_separator(58)
        assert len(sep) == 2 + 58  # "  " + separator chars
        assert set(sep[2:]) == {"─"}


# ---------------------------------------------------------------------------
# Data functions
# ---------------------------------------------------------------------------

class TestResolveDb:
    """_resolve_db picks the right DB path in priority order."""

    def test_explicit_path_wins(self, temp_db):
        assert _resolve_db(temp_db) == temp_db

    def test_none_checks_config_then_fallback(self, monkeypatch):
        # When cli_db is None, config.FACT_DB is checked first.
        fake = Path("/nonexistent/config.db")
        import config as _config
        monkeypatch.setattr(_config, "FACT_DB", fake)
        # Since fake doesn't exist, fallback to home plugin dir (also nonexistent)
        result = _resolve_db(None)
        # Falls through to config.FACT_DB as ultimate fallback
        assert result == fake


class TestLoadJobNames:
    """_load_job_names parses Hermes jobs.json in multiple formats."""

    def test_native_hermes_format(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text(json.dumps({"jobs": [{"id": "abc123", "name": "My Job"}]}))
        names = _load_job_names(path)
        assert names == {"abc123": "My Job"}

    def test_flat_dict_format(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text(json.dumps({"abc123": {"name": "My Job"}}))
        names = _load_job_names(path)
        assert names == {"abc123": "My Job"}

    def test_plain_list_format(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text(json.dumps([{"id": "abc123", "name": "My Job"}]))
        names = _load_job_names(path)
        assert names == {"abc123": "My Job"}

    def test_missing_file(self, tmp_path):
        path = tmp_path / "missing.json"
        assert _load_job_names(path) == {}

    def test_invalid_json(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text("not json")
        assert _load_job_names(path) == {}


class TestDbDateRange:
    """_db_date_range queries the DB for min/max run_time."""

    def test_empty_db(self, temp_db):
        start, end = _db_date_range(temp_db)
        assert start == ""
        assert end == ""

    def test_with_data(self, fact_db):
        # Use noon local-time timestamps to avoid timezone boundary issues
        start_dt = datetime.strptime("2025-01-01 12:00:00", "%Y-%m-%d %H:%M:%S")
        end_dt = datetime.strptime("2025-06-01 12:00:00", "%Y-%m-%d %H:%M:%S")
        conn = sqlite3.connect(str(fact_db))
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, success) VALUES (?, ?, ?, ?)",
            ("cron_test_20260101_120000", "job1", start_dt.timestamp(), 1),
        )
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, success) VALUES (?, ?, ?, ?)",
            ("cron_test_20260601_120000", "job1", end_dt.timestamp(), 1),
        )
        conn.commit()
        conn.close()
        start, end = _db_date_range(fact_db)
        assert start == "2025-01-01"
        assert end == "2025-06-01"


class TestJsonDates:
    """_json_dates returns ISO date range strings for a day filter."""

    def test_zero_days_queries_db(self, fact_db):
        start, end = _json_dates(0, fact_db)
        # Empty DB → empty strings
        assert start == ""
        assert end == ""

    def test_positive_days(self):
        fake_now = datetime(2026, 5, 15, 12, 0, 0)
        with patch("cli.datetime") as mock_dt:
            mock_dt.now.return_value = fake_now
            start, end = _json_dates(7, Path("/dev/null"))
            assert start == "2026-05-09"
            assert end == "2026-05-15"


class TestHumanDateRange:
    """_human_date_range returns a human-readable date range string."""

    def test_zero_days_empty_db(self, fact_db):
        result = _human_date_range(0, fact_db)
        assert result == ""

    def test_positive_days(self):
        with patch("cli.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 5, 15)
            result = _human_date_range(7, Path("/dev/null"))
            assert "May 09" in result
            assert "May 15, 2026" in result


class TestJsonEnvelope:
    """_json_envelope wraps raw data with period and filter context."""

    def test_basic_envelope(self):
        args = MagicMock(days=7, outcome="both", mode="all")
        with patch("cli.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 5, 15)
            envelope = _json_envelope([{"x": 1}], args, Path("/dev/null"))
        assert envelope["period"] == "Last 7 days"
        assert envelope["data"] == [{"x": 1}]
        assert envelope["outcome"] == "both"
        assert envelope["mode"] == "all"

    def test_all_time_no_filters(self):
        args = MagicMock(days=0, outcome="both", mode="all")
        envelope = _json_envelope([{"x": 1}], args, Path("/dev/null"), include_filters=False)
        assert envelope["period"] == "All time"
        assert "outcome" not in envelope


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

class TestRenderHealth:
    """_render_health builds a human-readable health report."""

    def test_basic_output(self):
        data = {"total_runs": 42, "unique_jobs": 3, "last_ingested_at": None, "last_run_time": None}
        lines = _render_health(data)
        text = "\n".join(lines)
        assert "42" in text
        assert "3" in text
        assert "—" in text


# ---------------------------------------------------------------------------
# Integration — main() dispatch
# ---------------------------------------------------------------------------

class TestJobLabel:
    """_job_label builds display labels with truncation and [N] badges."""

    def test_falls_back_to_job_id(self):
        assert _job_label("abc123", {}, None) == "abc123"

    def test_uses_name_when_available(self):
        assert _job_label("abc123", {"abc123": "My Job"}, None) == "My Job"

    def test_truncates_long_names(self):
        long_name = "a" * 30
        result = _job_label("abc123", {"abc123": long_name}, None)
        assert len(result) <= _JOBS_NAME_MAX_AGENT
        assert result.endswith("…")

    def test_adds_no_agent_badge(self):
        result = _job_label("abc123", {"abc123": "Script"}, "no_agent")
        assert result.endswith(" [N]")

    def test_truncates_before_badge(self):
        long_name = "a" * 30
        result = _job_label("abc123", {"abc123": long_name}, "no_agent")
        assert result.endswith(" [N]")
        assert len(result) <= _JOBS_NAME_MAX_NO_AGENT + 4  # "… [N]" is 5 chars


class TestComputeLeaderBoard:
    """_compute_leader_board selects top jobs by runs, cost, tokens, and pace."""

    def test_empty_jobs_returns_empty(self):
        result = _compute_leader_board([], {"total_runs": 0}, {}, 30)
        assert result == []

    def test_runs_cost_tokens(self):
        jobs = [
            {"job_id": "job_a", "runs": 10, "total_cost": 5.0, "total_tokens": 1000, "job_mode": "agent"},
            {"job_id": "job_b", "runs": 5, "total_cost": 10.0, "total_tokens": 500, "job_mode": "agent"},
            {"job_id": "job_c", "runs": 20, "total_cost": 2.0, "total_tokens": 2000, "job_mode": "agent"},
        ]
        summary = {"total_runs": 35, "total_estimated_cost": 17.0, "total_tokens": 3500}
        names = {"job_a": "Alpha", "job_b": "Beta", "job_c": "Gamma"}
        result = _compute_leader_board(jobs, summary, names, 30)
        categories = [r["category"] for r in result]
        assert "Top Runs" in categories
        assert "Top Cost" in categories
        assert "Top Tokens" in categories
        # job_c has most runs and most tokens; job_b has most cost
        top_runs = next(r for r in result if r["category"] == "Top Runs")
        assert top_runs["job_id"] == "job_c"
        assert top_runs["share"] == "57.1%"
        top_cost = next(r for r in result if r["category"] == "Top Cost")
        assert top_cost["job_id"] == "job_b"
        assert top_cost["share"] == "58.8%"

    def test_no_pace_when_no_schedule(self):
        """If no jobs have schedule definitions, Top Pace is omitted."""
        jobs = [
            {"job_id": "job_a", "runs": 10, "total_cost": 5.0, "total_tokens": 1000, "job_mode": "agent"},
        ]
        summary = {"total_runs": 10, "total_estimated_cost": 5.0, "total_tokens": 1000}
        result = _compute_leader_board(jobs, summary, {}, 30)
        categories = [r["category"] for r in result]
        assert "Top Pace" not in categories


class TestMainIntegration:
    """main() end-to-end with temporary databases."""

    def test_health_command(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "health"])
        captured = capsys.readouterr()
        assert result == 0
        assert "Health" in captured.out
        assert "Total runs" in captured.out

    def test_health_json(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "health", "--json"])
        captured = capsys.readouterr()
        assert result == 0
        data = json.loads(captured.out)
        assert "data" in data

    def test_jobs_empty_db(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "jobs"])
        captured = capsys.readouterr()
        assert result == 0
        assert "No cron jobs found" in captured.out

    def test_summary_empty_db(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "summary"])
        captured = capsys.readouterr()
        assert result == 0
        assert "Runs:" in captured.out

    def test_summary_with_data_leader_board(self, fact_db, capsys):
        """Summary command includes leader board when jobs exist."""
        conn = sqlite3.connect(str(fact_db))
        cur = conn.cursor()
        now = datetime(2026, 5, 15, 12, 0, 0).timestamp()
        # Insert two jobs with different stats
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, estimated_cost_usd, "
            "input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, "
            "duration_seconds, model, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("s1", "job_alpha", now - 86400, 5.0, 1000, 100, 0, 0, 100, "model-a", 1),
        )
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, estimated_cost_usd, "
            "input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, "
            "duration_seconds, model, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("s2", "job_beta", now - 172800, 2.0, 500, 50, 0, 0, 50, "model-b", 1),
        )
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, estimated_cost_usd, "
            "input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, "
            "duration_seconds, model, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("s3", "job_alpha", now - 259200, 3.0, 800, 80, 0, 0, 80, "model-a", 1),
        )
        conn.commit()
        conn.close()

        result = main(["--db", str(fact_db), "summary", "--days", "7"])
        captured = capsys.readouterr()
        assert result == 0
        assert "🏆 Leader Board" in captured.out
        assert "Top Runs" in captured.out
        assert "Top Cost" in captured.out
        assert "Top Tokens" in captured.out

    def test_summary_leader_board_json(self, fact_db, capsys):
        """Summary JSON includes leader_board array with correct structure."""
        conn = sqlite3.connect(str(fact_db))
        cur = conn.cursor()
        now = datetime(2026, 5, 15, 12, 0, 0).timestamp()
        cur.execute(
            "INSERT INTO cron_runs (session_id, job_id, run_time, estimated_cost_usd, "
            "input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, "
            "duration_seconds, model, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("s1", "job_a", now - 86400, 5.0, 1000, 100, 0, 0, 100, "model-a", 1),
        )
        conn.commit()
        conn.close()

        result = main(["--db", str(fact_db), "summary", "--days", "7", "--json"])
        captured = capsys.readouterr()
        assert result == 0
        data = json.loads(captured.out)
        lb = data["data"]["leader_board"]
        assert isinstance(lb, list)
        assert len(lb) >= 3  # runs, cost, tokens
        categories = {item["category"] for item in lb}
        assert "Top Runs" in categories
        assert "Top Cost" in categories
        assert "Top Tokens" in categories
        # Each entry has the expected keys
        for item in lb:
            assert "job_id" in item
            assert "job_name" in item
            assert "value" in item
            assert "share" in item

    def test_models_empty_db(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "models"])
        captured = capsys.readouterr()
        assert result == 0
        assert "No model data found" in captured.out

    def test_trends_empty_db(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "trends"])
        captured = capsys.readouterr()
        assert result == 0
        assert "No trend data found" in captured.out

    def test_all_chains_commands(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "all"])
        captured = capsys.readouterr()
        assert result == 0
        assert "Full Report" in captured.out
        assert "Health" in captured.out
        assert "Summary" in captured.out

    def test_runs_missing_job_id(self, fact_db):
        result = main(["--db", str(fact_db), "runs", "--job", "nonexistent"])
        assert result == 0  # empty result, not an error

    def test_json_rejected_for_all(self, fact_db, capsys):
        result = main(["--db", str(fact_db), "all", "--json"])
        captured = capsys.readouterr()
        assert result == 1
        assert "not supported" in captured.err

    def test_invalid_db_path(self):
        result = main(["--db", "/dev/null/invalid.db", "health"])
        assert result == 2  # DB open error

    def test_shorthand_no_subcommand(self, fact_db, capsys):
        result = main(["--db", str(fact_db)])
        captured = capsys.readouterr()
        assert result == 0
        assert "Full Report" in captured.out


# ---------------------------------------------------------------------------
# Constants consistency
# ---------------------------------------------------------------------------

class TestLayoutConstants:
    """Computed separator widths must match the sum of column widths + spaces."""

    def test_jobs_layout(self):
        expected = sum(w for _, w in JOBS_LAYOUT) + len(JOBS_LAYOUT) - 1
        assert expected == JOBS_SEP_WIDTH

    def test_models_layout(self):
        expected = sum(w for _, w in MODELS_LAYOUT) + len(MODELS_LAYOUT) - 1
        assert expected == MODELS_SEP_WIDTH

    def test_runs_layout(self):
        expected = sum(w for _, w in RUNS_LAYOUT) + len(RUNS_LAYOUT) - 1
        assert expected == RUNS_SEP_WIDTH

    def test_summary_model_layout(self):
        expected = sum(w for _, w in SUMMARY_MODEL_LAYOUT) + len(SUMMARY_MODEL_LAYOUT) - 1
        assert expected == SUMMARY_MODEL_SEP_WIDTH

    def test_leader_board_layout(self):
        expected = sum(w for _, w in LEADER_BOARD_LAYOUT) + len(LEADER_BOARD_LAYOUT) - 1
        assert expected == LEADER_BOARD_SEP_WIDTH
