"""Unit tests for _make_job_id parser.

Run: uv run --with pytest python3 -m pytest tests/test_parser.py -v
"""

import pytest
import sys
from pathlib import Path

# Add plugin root to path so we can import facts module standalone.
sys.path.insert(0, str(Path(__file__).parent.parent))

from facts import _make_job_id


class TestMakeJobId:
    def test_simple_id(self):
        """Standard cron session with 8-char hex job_id."""
        assert _make_job_id("cron_841aee933270_20260429_222224") == "841aee933270"

    def test_id_with_underscore(self):
        """User job name that itself contains underscores."""
        assert _make_job_id("cron_daily_backup_v2_20260430_120000") == "daily_backup_v2"

    def test_multiple_underscores_in_id(self):
        """Aggressive underscore usage in job name."""
        assert _make_job_id("cron_a_b_c_d_20260430_120000") == "a_b_c_d"

    def test_too_few_segments(self):
        """Malformed session id with only 3 parts."""
        assert _make_job_id("cron_abc_20260430") is None

    def test_exactly_four_segments(self):
        """Minimum valid session id."""
        assert _make_job_id("cron_abc_20260430_120000") == "abc"

    def test_non_cron_prefix(self):
        """CLI sessions should return None."""
        assert _make_job_id("cli_abc123_20260430_120000") is None

    def test_empty_string(self):
        assert _make_job_id("") is None

    def test_cron_only(self):
        assert _make_job_id("cron_") is None

    def test_single_digit_job_id(self):
        """Edge case: very short job id."""
        assert _make_job_id("cron_x_20260430_000001") == "x"

    def test_uuid_style_job_id(self):
        """Hyphenated uuid-style job id (no underscores in id)."""
        assert _make_job_id("cron_550e8400-e29b-41d4-a716-446655440000_20260430_120000") == "550e8400-e29b-41d4-a716-446655440000"
