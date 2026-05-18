"""Cronalytics CLI — terminal data tool.

Usage (dashboard plugin install — primary):
    cronalytics [--days N] [--outcome both|success|failure] [--mode all|agent|no_agent]
    cronalytics summary [--days N] [--outcome ...] [--mode ...] [--json]
    cronalytics jobs    [--days N] [--outcome ...] [--mode ...] [--json]
    cronalytics runs   --job JOB_ID [--days N] [--outcome ...] [--mode ...] [--json]
    cronalytics models [--days N] [--outcome ...] [--mode ...] [--json]
    cronalytics trends [--days N] [--outcome ...] [--mode ...] [--json]
    cronalytics all   [--days N] [--outcome ...] [--mode ...]
    cronalytics health [--json]

Usage (pip install -e / direct module):
    pip install -e ~/.hermes/plugins/cronalytics --break-system-packages
    alias cronalytics='python ~/.hermes/plugins/cronalytics/cronalytics/cli.py'
    cronalytics summary --days 14
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import unicodedata
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, TypedDict

# ---------------------------------------------------------------------------
# Path bootstrap — add plugin root so `cronalytics` package is discoverable
# ---------------------------------------------------------------------------
_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from cronalytics import config  # noqa: I001
from cronalytics.facts import (
    get_conn,
    query_health,
    query_job_runs,
    query_jobs,
    query_models,
    query_summary,
    query_trends,
)
from cronalytics.schedule import get_job_projections


# =============================================================================
# CONSTANTS
# =============================================================================

# Box-drawing characters
_CHAR_TOP_LEFT = "╔"
_CHAR_TOP_RIGHT = "╗"
_CHAR_BOTTOM_LEFT = "╚"
_CHAR_BOTTOM_RIGHT = "╝"
_CHAR_HORIZ = "═"
_CHAR_VERT = "║"
_CHAR_SEP = "─"

# Banner inner widths (content area between ║ borders)
_W_STD = 72   # Standard: health, summary, models, trends, runs, full report
_W_JOBS = 82  # Wider for jobs table

# Column layouts: list of (header, width) tuples.
# Total separator width == sum(widths) + (count - 1) spaces.
JOBS_LAYOUT: list[tuple[str, int]] = [
    ("Job ID", 12),
    ("Job", 14),
    ("Runs", 5),
    ("Cost", 10),
    ("Dur", 6),
    ("Tokens", 10),
    ("Pace", 5),
]
SUMMARY_MODEL_LAYOUT: list[tuple[str, int]] = [
    ("Model", 30),
    ("Runs", 8),
    ("Cost", 12),
]
MODELS_LAYOUT: list[tuple[str, int]] = [
    ("Model", 30),
    ("Runs", 8),
    ("Cost", 10),
    ("Tokens", 10),
]
RUNS_LAYOUT: list[tuple[str, int]] = [
    ("Time", 16),
    ("Dur", 5),
    ("Cost", 8),
    ("Tks", 7),
    ("M", 22),
    ("✓", 2),
]
LEADER_BOARD_LAYOUT: list[tuple[str, int]] = [
    ("", 14),   # Category (e.g., "Top Runs")
    ("", 14),   # Job name
    ("", 12),   # Job ID
    ("", 10),   # Value
    ("", 8),    # Share
]

# Pre-computed separator line widths
JOBS_SEP_WIDTH = sum(w for _, w in JOBS_LAYOUT) + len(JOBS_LAYOUT) - 1
SUMMARY_MODEL_SEP_WIDTH = sum(w for _, w in SUMMARY_MODEL_LAYOUT) + len(SUMMARY_MODEL_LAYOUT) - 1
MODELS_SEP_WIDTH = sum(w for _, w in MODELS_LAYOUT) + len(MODELS_LAYOUT) - 1
RUNS_SEP_WIDTH = sum(w for _, w in RUNS_LAYOUT) + len(RUNS_LAYOUT) - 1
LEADER_BOARD_SEP_WIDTH = sum(w for _, w in LEADER_BOARD_LAYOUT) + len(LEADER_BOARD_LAYOUT) - 1

# Job-name truncation limits
_JOBS_NAME_MAX_AGENT = 14
_JOBS_NAME_MAX_NO_AGENT = 10  # room for " [N]" suffix

# Hermes jobs.json path
_JOBS_PATH: Path = config.HERMES_HOME / "cron" / "jobs.json"


# =============================================================================
# TYPES
# =============================================================================

class SummaryData(TypedDict, total=False):
    """Shape returned by facts.query_summary."""

    days: int
    total_runs: int
    total_estimated_cost: float | None
    total_actual_cost: float | None
    total_tokens: int
    total_input_tokens: int
    total_output_tokens: int
    total_cache_read_tokens: int
    total_cache_write_tokens: int
    total_duration_seconds: float
    avg_duration_seconds: float
    success_runs: int
    failure_runs: int
    success_cost: float
    failure_cost: float
    cost_by_model: list[CostByModel]
    previous_period: dict[str, Any] | None
    trend: str


class CostByModel(TypedDict, total=False):
    """Per-model summary within the overall summary."""

    model: str | None
    runs: int
    total_cost: float | None


class JobData(TypedDict, total=False):
    """Shape returned by facts.query_jobs."""

    job_id: str
    job_name: str | None
    runs: int
    total_cost: float | None
    total_tokens: int
    avg_duration: float | None
    job_mode: str | None
    avg_cost: float | None
    first_run: float | None
    last_run: float | None


class ModelData(TypedDict, total=False):
    """Shape returned by facts.query_models."""

    model: str | None
    runs: int
    total_cost: float | None
    total_input_tokens: int
    total_output_tokens: int


class TrendData(TypedDict, total=False):
    """Shape returned by facts.query_trends."""

    day: str
    runs: int
    cost: float | None


class RunData(TypedDict, total=False):
    """Shape returned by facts.query_job_runs."""

    session_id: str
    job_id: str
    job_name: str | None
    run_time: float | None
    estimated_cost_usd: float | None
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    duration_seconds: float | None
    model: str | None
    job_mode: str | None
    success: bool


class HealthData(TypedDict, total=False):
    """Shape returned by facts.query_health."""

    total_runs: int
    unique_jobs: int
    last_ingested_at: float | None
    last_run_time: float | None


class JsonEnvelope(TypedDict, total=False):
    """Lightweight wrapper around any command's data payload."""

    period: str
    data: Any
    start_date: str
    end_date: str
    outcome: str
    mode: str


# =============================================================================
# PURE DATA FUNCTIONS (no side effects, fully testable)
# =============================================================================

def _resolve_db(cli_db: Path | None) -> Path:
    """Resolve the fact DB path.

    Priority:
        1. Explicit --db flag
        2. config.FACT_DB (resolved via HERMES_HOME env var)
    """
    if cli_db is not None:
        return cli_db
    return config.FACT_DB


def _load_job_names(jobs_path: Path = _JOBS_PATH) -> dict[str, str]:
    """Load job_id → name mapping from Hermes jobs.json.

    Supports three formats:
        {"jobs": [{"id": ..., "name": ...}, ...]}   # Hermes native
        {"job_id": {"name": ...}, ...}              # flat dict
        [{"id": ..., "name": ...}, ...]             # plain list
    """
    if not jobs_path.exists():
        return {}
    try:
        data = json.loads(jobs_path.read_text())
        if isinstance(data, dict) and "jobs" in data and isinstance(data["jobs"], list):
            return {j.get("id", ""): j.get("name", "") for j in data["jobs"]}
        if isinstance(data, dict):
            return {jid: info.get("name", "") for jid, info in data.items() if isinstance(info, dict)}
        if isinstance(data, list):
            return {j.get("id", ""): j.get("name", "") for j in data}
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def _db_date_range(db_path: Path) -> tuple[str, str]:
    """Query the DB for the actual min/max run_time dates.

    Returns (start_date, end_date) as ISO strings, or ("", "") if the table
    is empty or the DB is not yet initialized.
    """
    try:
        conn = get_conn(db_path)
        cur = conn.cursor()
        cur.execute("SELECT MIN(run_time), MAX(run_time) FROM cron_runs")
        row = cur.fetchone()
        if row and row[0] and row[1]:
            start = datetime.fromtimestamp(row[0])
            end = datetime.fromtimestamp(row[1])
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    except (sqlite3.Error, OSError):
        pass
    return "", ""


def _json_dates(days: int, db_path: Path) -> tuple[str, str]:
    """Return ISO start_date and end_date for a day filter.

    For --days 0 (all time) the range is computed from the DB itself.
    """
    if days == 0:
        return _db_date_range(db_path)
    today = datetime.now()
    start = today - timedelta(days=days - 1)
    end = today
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _human_date_range(days: int, db_path: Path) -> str:
    """Return a human-readable date range for the given day filter.

    For --days 0 (all time) the range is computed from the DB itself.
    """
    if days == 0:
        start_str, end_str = _db_date_range(db_path)
        if start_str and end_str:
            start = datetime.strptime(start_str, "%Y-%m-%d")
            end = datetime.strptime(end_str, "%Y-%m-%d")
            return f"{start.strftime('%b %d')} — {end.strftime('%b %d, %Y')}"
        return ""
    today = datetime.now()
    start = today - timedelta(days=days - 1)
    end = today
    return f"{start.strftime('%b %d')} — {end.strftime('%b %d, %Y')}"


def _json_envelope(
    data: Any,
    args: argparse.Namespace,
    db_path: Path,
    include_filters: bool = True,
) -> JsonEnvelope:
    """Wrap raw data in a lightweight envelope with period + filter context."""
    days: int = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    start_date, end_date = _json_dates(days, db_path)
    envelope: JsonEnvelope = {"period": period, "data": data}
    if start_date:
        envelope["start_date"] = start_date
        envelope["end_date"] = end_date
    if include_filters:
        envelope["outcome"] = args.outcome
        envelope["mode"] = args.mode
    return envelope


# =============================================================================
# PURE FORMATTING FUNCTIONS (no side effects, fully testable)
# =============================================================================

def _fmt_cost(n: float | None) -> str:
    """Format a cost value as a US-dollar string."""
    if n is None:
        return "—"
    return f"${n:,.2f}"


def _fmt_tokens(n: int) -> str:
    """Format a token count with K/M suffixes."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def _fmt_dt(ts: float | None) -> str:
    """Format a Unix timestamp as 'Mon DD HH:MM'."""
    if not ts:
        return "—"
    return datetime.fromtimestamp(ts).strftime("%b %d %H:%M")


def _bar_chart(values: list[int], *, max_width: int = 20) -> list[str]:
    """Build a list of Unicode block-bar strings proportional to values."""
    peak = max(values) if values else 1
    if peak == 0:
        return ["" for _ in values]
    return [
        "█" * max(1, int(v / peak * max_width)) if v > 0 else ""
        for v in values
    ]


def _visual_len(text: str) -> int:
    """Return visual display width, counting East-Asian wide chars as 2."""
    return sum(
        2 if unicodedata.east_asian_width(ch) in ("F", "W") else 1
        for ch in text
    )


def _banner_line(text: str, inner_width: int) -> str:
    """Center *text* inside a box-drawing line with correct visual alignment."""
    vis = _visual_len(text)
    pad = max(0, inner_width - vis)
    left = pad // 2
    right = pad - left
    return f"  {_CHAR_VERT}{' ' * left}{text}{' ' * right}{_CHAR_VERT}"


def _banner(
    title: str,
    subtitle: str | None = None,
    *,
    inner_width: int = _W_STD,
) -> list[str]:
    """Build a boxed banner: top border, title line, optional subtitle, bottom border."""
    border = _CHAR_HORIZ * inner_width
    lines = [f"  {_CHAR_TOP_LEFT}{border}{_CHAR_TOP_RIGHT}"]
    lines.append(_banner_line(title, inner_width))
    if subtitle:
        lines.append(_banner_line(subtitle, inner_width))
    lines.append(f"  {_CHAR_BOTTOM_LEFT}{border}{_CHAR_BOTTOM_RIGHT}")
    return lines


def _build_table_header(layout: list[tuple[str, int]]) -> str:
    """Return a formatted header string from a column layout."""
    _right_aligned = {"Runs", "Cost", "Dur", "Tokens", "Pace", "Tks", "M", "✓"}
    parts: list[str] = []
    for header, width in layout:
        align = ">" if header in _right_aligned else "<"
        parts.append(f"{header:{align}{width}}")
    return "  " + " ".join(parts)


def _build_separator(width: int) -> str:
    """Return a separator line of the given total width."""
    return "  " + _CHAR_SEP * width


# =============================================================================
# DATA FETCHING (separated from presentation)
# =============================================================================
# The facts module is untyped, so we use Any for return values and cast
# internally in the render functions where structure is guaranteed.


def _fetch_summary(db_path: Path, args: argparse.Namespace) -> Any:
    """Fetch aggregate headline data."""
    return query_summary(db_path, days=args.days, outcome=args.outcome, mode=args.mode)


def _fetch_jobs(db_path: Path, args: argparse.Namespace) -> Any:
    """Fetch per-job breakdown."""
    jobs = query_jobs(db_path, days=args.days, outcome=args.outcome, mode=args.mode)
    job_names = _load_job_names()
    for j in jobs:
        j["job_name"] = job_names.get(j["job_id"], "") or None
    return jobs


def _fetch_models(db_path: Path, args: argparse.Namespace) -> Any:
    """Fetch per-model cost breakdown."""
    return query_models(db_path, days=args.days, outcome=args.outcome, mode=args.mode)


def _fetch_trends(db_path: Path, args: argparse.Namespace) -> Any:
    """Fetch daily run-count / cost sparkline data."""
    return query_trends(db_path, days=args.days, outcome=args.outcome, mode=args.mode)


def _fetch_runs(db_path: Path, args: argparse.Namespace) -> Any:
    """Fetch individual runs for a specific job."""
    runs = query_job_runs(
        db_path,
        job_id=args.job,
        limit=50,
        days=args.days,
        outcome=args.outcome,
        mode=args.mode,
    )
    job_names = _load_job_names()
    for r in runs:
        r["job_name"] = job_names.get(r["job_id"], "") or None
    return runs


def _fetch_health(db_path: Path) -> Any:
    """Fetch fact DB health metadata."""
    return query_health(db_path)


def _job_label(job_id: str, job_names: dict[str, str], mode: str | None) -> str:
    """Build a display label for a job with truncation and [N] badge."""
    label = job_names.get(job_id, "") or job_id
    max_base = _JOBS_NAME_MAX_NO_AGENT if mode == "no_agent" else _JOBS_NAME_MAX_AGENT
    if len(label) > max_base:
        label = label[: max_base - 1] + "…"
    if mode == "no_agent":
        label += " [N]"
    return label


def _compute_leader_board(
    jobs: list[Any],
    summary_data: dict[str, Any],
    job_names: dict[str, str],
    days_filter: int,
) -> list[dict[str, Any]]:
    """Compute the top job for each leader board category."""
    if not jobs:
        return []

    total_runs = summary_data.get("total_runs", 0)
    total_cost = summary_data.get("total_estimated_cost") or 0
    total_tokens = summary_data.get("total_tokens", 0)

    def _get_pace(job: Any) -> float | None:
        proj = get_job_projections(
            job["job_id"],
            avg_cost=job.get("avg_cost"),
            total_cost=job["total_cost"],
            runs=job["runs"],
            first_run=job.get("first_run"),
            last_run=job.get("last_run"),
            days_filter=days_filter,
            jobs_json_path=_JOBS_PATH,
        )
        return proj.get("pace")

    top_runs_job = max(jobs, key=lambda j: j["runs"])
    top_cost_job = max(jobs, key=lambda j: j.get("total_cost") or 0)
    top_tokens_job = max(jobs, key=lambda j: j.get("total_tokens", 0))

    jobs_with_pace = [(j, _get_pace(j)) for j in jobs if _get_pace(j) is not None]
    if jobs_with_pace:
        top_pace_job, top_pace_val = max(jobs_with_pace, key=lambda x: x[1] or 0)
    else:
        top_pace_job = None
        top_pace_val = None

    leaders: list[dict[str, Any]] = []

    if total_runs > 0:
        leaders.append({
            "category": "Top Runs",
            "job_id": top_runs_job["job_id"],
            "job_name": _job_label(top_runs_job["job_id"], job_names, top_runs_job.get("job_mode")),
            "value": f"{top_runs_job['runs']:,}",
            "share": f"{top_runs_job['runs'] / total_runs * 100:.1f}%",
        })

    if total_cost > 0:
        cost = top_cost_job.get("total_cost") or 0
        leaders.append({
            "category": "Top Cost",
            "job_id": top_cost_job["job_id"],
            "job_name": _job_label(top_cost_job["job_id"], job_names, top_cost_job.get("job_mode")),
            "value": _fmt_cost(cost),
            "share": f"{cost / total_cost * 100:.1f}%",
        })

    if total_tokens > 0:
        tokens = top_tokens_job.get("total_tokens", 0)
        leaders.append({
            "category": "Top Tokens",
            "job_id": top_tokens_job["job_id"],
            "job_name": _job_label(top_tokens_job["job_id"], job_names, top_tokens_job.get("job_mode")),
            "value": _fmt_tokens(tokens),
            "share": f"{tokens / total_tokens * 100:.1f}%",
        })

    if top_pace_job and top_pace_val is not None:
        leaders.append({
            "category": "Top Pace",
            "job_id": top_pace_job["job_id"],
            "job_name": _job_label(top_pace_job["job_id"], job_names, top_pace_job.get("job_mode")),
            "value": f"{top_pace_val:.2f}×",
            "share": "—",
        })

    return leaders


# =============================================================================
# RENDERING (separated from data fetching; accepts Any because facts.py is untyped)
# =============================================================================

def _render_summary(data: Any, args: argparse.Namespace, db_path: Path) -> list[str]:
    """Build the pretty-printed lines for the summary command."""
    days = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    dr = _human_date_range(days, db_path)
    subtitle = f"{period}  ·  {dr}" if dr else period

    lines: list[str] = [""] + _banner("📊 Cronalytics Summary", subtitle, inner_width=_W_STD) + [""]

    lines.append("  📋 Summary Board")
    lines.append(_build_separator(_W_STD))
    lines.append(f"  Runs:              {data['total_runs']:,}")
    lines.append(f"  Estimated cost:    {_fmt_cost(data['total_estimated_cost'])}")
    lines.append(f"  Actual cost:       {_fmt_cost(data['total_actual_cost'])}")
    lines.append(
        f"  Tokens:            {_fmt_tokens(data['total_tokens'])}  "
        f"(In: {_fmt_tokens(data['total_input_tokens'])}  "
        f"Out: {_fmt_tokens(data['total_output_tokens'])}  "
        f"Cached: {_fmt_tokens(data['total_cache_read_tokens'])})"
    )
    lines.append("")

    prev = data.get("previous_period", {})
    if prev:
        lines.append(
            f"  Previous period:   {prev.get('runs', 0):,} runs, "
            f"{_fmt_cost(prev.get('cost'))}"  # type: ignore[arg-type]
        )
        lines.append(f"  Trend:             {data['trend']}")
        lines.append("")

    leader_board = data.get("leader_board")
    if leader_board:
        lines.append("  🏆 Leader Board")
        lines.append(_build_separator(LEADER_BOARD_SEP_WIDTH))
        for leader in leader_board:
            lines.append(
                f"  {leader['category']:<14} {leader['job_name']:<14} {leader['job_id']:<12} {leader['value']:>10} {leader['share']:>8}"
            )
        lines.append("")

    by_model = data.get("cost_by_model", [])
    if by_model:
        lines.append("  🤖 Cost by Model")
        lines.append(_build_separator(SUMMARY_MODEL_SEP_WIDTH))
        lines.append(_build_table_header(SUMMARY_MODEL_LAYOUT))
        for m in by_model:
            model_name = (m["model"] or "unknown")[:28]
            lines.append(
                f"  {model_name:<30} {m['runs']:>8,} {_fmt_cost(m['total_cost']):>12}"
            )
        lines.append("")

    return lines


def _render_jobs(
    jobs: Any,
    args: argparse.Namespace,
    db_path: Path,
    job_names: dict[str, str],
) -> list[str]:
    """Build the pretty-printed lines for the jobs command."""
    days = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    dr = _human_date_range(days, db_path)
    subtitle = f"{period}  ·  {dr}" if dr else period

    lines: list[str] = [""] + _banner("🤖 Cronalytics Jobs", subtitle, inner_width=_W_JOBS) + [""]
    lines.append("  Jobs overview")
    lines.append(_build_separator(JOBS_SEP_WIDTH))
    lines.append(_build_table_header(JOBS_LAYOUT))
    lines.append(_build_separator(JOBS_SEP_WIDTH))

    for j in jobs:
        job_id = j["job_id"]
        job_label = _job_label(job_id, job_names, j.get("job_mode"))
        cost = _fmt_cost(j["total_cost"])
        tokens = _fmt_tokens(j["total_tokens"])
        dur = j.get("avg_duration")
        dur_str = f"{dur:.0f}s" if dur is not None else "—"

        proj = get_job_projections(
            job_id,
            avg_cost=j.get("avg_cost"),
            total_cost=j["total_cost"],
            runs=j["runs"],
            first_run=j.get("first_run"),
            last_run=j.get("last_run"),
            days_filter=days,
            jobs_json_path=_JOBS_PATH,
        )
        pace = proj.get("pace")
        pace_str = f"{pace:.2f}" if pace is not None else "—"

        lines.append(
            f"  {job_id:<12} {job_label:<14} {j['runs']:>5} {cost:>10} {dur_str:>6} "
            f"{tokens:>10} {pace_str:>5}"
        )

    lines.append("")
    return lines


def _render_runs(
    runs: Any,
    args: argparse.Namespace,
    db_path: Path,
) -> list[str]:
    """Build the pretty-printed lines for the runs command."""
    days = args.days
    job_id = args.job
    dr = _human_date_range(days, db_path)
    subtitle = f"Last {days} days  ·  {dr}" if dr else "All time"

    lines: list[str] = [""] + _banner(f"📝 Runs: {job_id}", subtitle, inner_width=_W_STD) + [""]
    lines.append(_build_table_header(RUNS_LAYOUT))
    lines.append(_build_separator(RUNS_SEP_WIDTH))

    for r in runs:
        t = _fmt_dt(r.get("run_time"))
        dur = r.get("duration_seconds")
        dur_str = f"{dur:.0f}s" if dur is not None else "—"
        cost = _fmt_cost(r.get("estimated_cost_usd"))
        tok = _fmt_tokens(
            r.get("input_tokens", 0)
            + r.get("output_tokens", 0)
            + r.get("cache_read_tokens", 0)
            + r.get("cache_write_tokens", 0)
        )
        model = (r.get("model") or "unknown")[:21]
        if r.get("job_mode") == "no_agent":
            model += " [N]"
        ok = "✓" if r.get("success") else "✗"
        lines.append(
            f"  {t:<16} {dur_str:>5} {cost:>8} {tok:>7} {model:<22} {ok:>2}"
        )

    lines.append("")
    return lines


def _render_models(
    models: Any,
    args: argparse.Namespace,
    db_path: Path,
) -> list[str]:
    """Build the pretty-printed lines for the models command."""
    days = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    dr = _human_date_range(days, db_path)
    subtitle = f"{period}  ·  {dr}" if dr else period

    lines: list[str] = [""] + _banner("🤖 Cronalytics Models", subtitle, inner_width=_W_STD) + [""]
    lines.append(_build_table_header(MODELS_LAYOUT))
    lines.append(_build_separator(MODELS_SEP_WIDTH))

    for m in models:
        model = (m["model"] or "unknown")[:28]
        cost = _fmt_cost(m["total_cost"])
        tokens = _fmt_tokens(m.get("total_input_tokens", 0) + m.get("total_output_tokens", 0))
        lines.append(
            f"  {model:<30} {m['runs']:>8,} {cost:>10} {tokens:>10}"
        )

    lines.append("")
    return lines


def _render_trends(
    trends: Any,
    args: argparse.Namespace,
    db_path: Path,
) -> list[str]:
    """Build the pretty-printed lines for the trends command."""
    days = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    dr = _human_date_range(days, db_path)
    subtitle = f"{period}  ·  {dr}" if dr else period

    lines: list[str] = [""] + _banner("📈 Cronalytics Trends", subtitle, inner_width=_W_STD) + [""]

    vals = [t["runs"] for t in trends]
    bars = _bar_chart(vals, max_width=25)
    for i, t in enumerate(trends):
        bar = bars[i]
        cost = _fmt_cost(t.get("cost"))
        lines.append(f"  {t['day']}  {bar:<25} {t['runs']:>3} runs  {cost}")

    lines.append("")
    return lines


def _render_health(data: Any) -> list[str]:
    """Build the pretty-printed lines for the health command."""
    lines: list[str] = [
        "",
    ] + _banner("💓 Cronalytics Health", inner_width=_W_STD) + [
        "",
        f"  Total runs:        {data['total_runs']:,}",
        f"  Unique jobs:       {data['unique_jobs']}",
        f"  Last ingested:     {_fmt_dt(data.get('last_ingested_at'))}",
        f"  Last run time:     {_fmt_dt(data.get('last_run_time'))}",
        "",
    ]
    return lines


# =============================================================================
# COMMAND DISPATCH (orchestrate fetch → JSON or render → print)
# =============================================================================

def _cmd_summary(args: argparse.Namespace, db_path: Path) -> int:
    data = _fetch_summary(db_path, args)
    jobs = _fetch_jobs(db_path, args)
    job_names = _load_job_names()
    leader_board = _compute_leader_board(jobs, data, job_names, args.days)
    data["leader_board"] = leader_board
    if args.json:
        print(json.dumps(_json_envelope(data, args, db_path), indent=2, default=str))
        return 0
    print("\n".join(_render_summary(data, args, db_path)))
    return 0


def _cmd_jobs(args: argparse.Namespace, db_path: Path) -> int:
    jobs = _fetch_jobs(db_path, args)
    if args.json:
        # Augment each job with schedule projections and pace (mirrors rendered path)
        for j in jobs:
            proj = get_job_projections(
                j["job_id"],
                avg_cost=j.get("avg_cost"),
                total_cost=j["total_cost"],
                runs=j["runs"],
                first_run=j.get("first_run"),
                last_run=j.get("last_run"),
                days_filter=args.days,
                jobs_json_path=_JOBS_PATH,
            )
            j["schedule_display"] = proj.get("schedule_display")
            j["next_run_at"] = proj.get("next_run_at")
            j["scheduled_runs_30d"] = proj.get("scheduled_runs_30d")
            j["scheduled_runs_90d"] = proj.get("scheduled_runs_90d")
            j["scheduled_runs_1yr"] = proj.get("scheduled_runs_1yr")
            j["projected_cost_30d"] = proj.get("projected_cost_30d")
            j["projected_cost_90d"] = proj.get("projected_cost_90d")
            j["projected_cost_1yr"] = proj.get("projected_cost_1yr")
            j["trend_projected_cost_30d"] = proj.get("trend_projected_cost_30d")
            j["trend_projected_cost_90d"] = proj.get("trend_projected_cost_90d")
            j["trend_projected_cost_1yr"] = proj.get("trend_projected_cost_1yr")
            j["pace"] = proj.get("pace")
            j["drift_ratio"] = proj.get("drift_ratio")
            j["observed_window_days"] = proj.get("observed_window_days")
        print(json.dumps(_json_envelope(jobs, args, db_path), indent=2, default=str))
        return 0
    if not jobs:
        print(f"  No cron jobs found in the last {args.days} days.")
        return 0
    job_names = _load_job_names()
    print("\n".join(_render_jobs(jobs, args, db_path, job_names)))
    return 0


def _cmd_runs(args: argparse.Namespace, db_path: Path) -> int:
    runs = _fetch_runs(db_path, args)
    if args.json:
        print(json.dumps(_json_envelope(runs, args, db_path), indent=2, default=str))
        return 0
    if not runs:
        print(f"  No runs found for job '{args.job}' in the last {args.days} days.")
        return 0
    print("\n".join(_render_runs(runs, args, db_path)))
    return 0


def _cmd_models(args: argparse.Namespace, db_path: Path) -> int:
    models = _fetch_models(db_path, args)
    if args.json:
        print(json.dumps(_json_envelope(models, args, db_path), indent=2, default=str))
        return 0
    if not models:
        print(f"  No model data found in the last {args.days} days.")
        return 0
    print("\n".join(_render_models(models, args, db_path)))
    return 0


def _cmd_trends(args: argparse.Namespace, db_path: Path) -> int:
    trends = _fetch_trends(db_path, args)
    if args.json:
        print(json.dumps(_json_envelope(trends, args, db_path), indent=2, default=str))
        return 0
    if not trends:
        print(f"  No trend data found in the last {args.days} days.")
        return 0
    print("\n".join(_render_trends(trends, args, db_path)))
    return 0


def _cmd_health(args: argparse.Namespace, db_path: Path) -> int:
    data = _fetch_health(db_path)
    if args.json:
        print(json.dumps({"data": data}, indent=2, default=str))
        return 0
    print("\n".join(_render_health(data)))
    return 0


def _cmd_sync(args: argparse.Namespace, db_path: Path) -> int:
    """Backfill historical cron sessions from state.db into facts.db."""
    from cronalytics import scanner, config

    result = scanner.run_sync(
        config.STATE_DB,
        db_path,
        config.WATERMARK_FILE,
    )
    if args.json:
        print(json.dumps({"data": result}, indent=2, default=str))
        return 0

    lines: list[str] = []
    lines.append("")
    lines.extend(_banner("🔄 Cronalytics Sync", inner_width=_W_STD))
    total_inserted = result["agent_inserted"] + result["script_inserted"]
    if total_inserted > 0:
        lines.append(_banner_line(f"Inserted: {total_inserted} new sessions", _W_STD))
        if result["agent_inserted"]:
            lines.append(_banner_line(f"  Agent:   {result['agent_inserted']}", _W_STD))
        if result["script_inserted"]:
            lines.append(_banner_line(f"  Script:  {result['script_inserted']}", _W_STD))
    else:
        lines.append(_banner_line("No new data found.", _W_STD))
    lines.append(_banner_line(f"Elapsed: {result['elapsed_ms']}ms", _W_STD))
    lines.append(f"  ╚{'═' * _W_STD}╝")
    print("\n".join(lines))
    return 0


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def _add_standard_flags(parser: argparse.ArgumentParser) -> None:
    """Attach the flags common to every data subcommand."""
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to look back (default: 30, 0 = all time)",
    )
    parser.add_argument(
        "--outcome",
        choices=["both", "success", "failure"],
        default="both",
        help="Filter by outcome (default: both)",
    )
    parser.add_argument(
        "--mode",
        choices=["all", "agent", "no_agent"],
        default="all",
        help="Filter by job mode (default: all)",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=argparse.SUPPRESS,
        help="Path to fact DB (default: auto-detected from plugin directory)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of formatted tables",
    )


def _build_parser() -> argparse.ArgumentParser:
    """Construct and return the top-level ArgumentParser."""
    parser = argparse.ArgumentParser(
        description="Cronalytics CLI — dump cron run insights to the terminal",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to fact DB (default: auto-detected from plugin directory)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to look back (default: 30, 0 = all time)",
    )
    parser.add_argument(
        "--outcome",
        choices=["both", "success", "failure"],
        default="both",
        help="Filter by outcome (default: both)",
    )
    parser.add_argument(
        "--mode",
        choices=["all", "agent", "no_agent"],
        default="all",
        help="Filter by job mode (default: all)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of formatted tables",
    )

    subparsers = parser.add_subparsers(dest="command", required=False)

    for name, help_text in (
        ("summary", "Aggregate headline summary"),
        ("jobs", "Per-job breakdown with pace"),
        ("models", "Per-model cost breakdown"),
        ("trends", "Daily run-count / cost sparkline"),
        ("health", "Fact DB health check"),
    ):
        p = subparsers.add_parser(name, help=help_text)
        _add_standard_flags(p)

    runs_parser = subparsers.add_parser("runs", help="Individual runs for a job")
    _add_standard_flags(runs_parser)
    runs_parser.add_argument("--job", required=True, help="Job ID filter")

    all_parser = subparsers.add_parser("all", help="Run health + summary + jobs + models + trends")
    _add_standard_flags(all_parser)

    sync_parser = subparsers.add_parser("sync", help="Backfill cron sessions from state.db into fact DB")
    sync_parser.add_argument(
        "--db",
        type=Path,
        default=argparse.SUPPRESS,
        help="Path to fact DB (default: auto-detected from plugin directory)",
    )
    sync_parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of formatted tables",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Parse arguments, resolve DB, dispatch command."""
    parser = _build_parser()

    try:
        import argcomplete
        argcomplete.autocomplete(parser)
    except ImportError:
        pass

    args = parser.parse_args(argv)

    db_path = _resolve_db(args.db)

    # Ensure DB schema is up-to-date before any command runs
    try:
        get_conn(db_path)
    except (sqlite3.Error, OSError) as exc:
        print(f"Error: unable to open fact database at {db_path}: {exc}", file=sys.stderr)
        return 2

    # Redirect downstream queries to the resolved DB
    config.FACT_DB = db_path

    # 'all' or bare invocation (no subcommand) → chained full report
    if args.command == "all" or args.command is None:
        if args.json:
            print(
                "Error: --json is not supported with the 'all' command. "
                "Use a specific subcommand (e.g., 'jobs --json').",
                file=sys.stderr,
            )
            return 1
        print("")
        print("\n".join(_banner("📋 Cronalytics Full Report", inner_width=_W_STD)))
        ret = 0
        ret |= _cmd_health(args, db_path)
        ret |= _cmd_summary(args, db_path)
        ret |= _cmd_jobs(args, db_path)
        ret |= _cmd_models(args, db_path)
        ret |= _cmd_trends(args, db_path)
        return ret

    # Dispatch to specific command
    handler_map: dict[str, Callable[[argparse.Namespace, Path], int]] = {
        "summary": _cmd_summary,
        "jobs": _cmd_jobs,
        "runs": _cmd_runs,
        "models": _cmd_models,
        "trends": _cmd_trends,
        "health": _cmd_health,
        "sync": _cmd_sync,
    }
    handler = handler_map[args.command]

    try:
        return handler(args, db_path)
    except (sqlite3.Error, OSError, KeyError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        # Catch-all for unexpected errors; print a helpful message
        print(f"Error: unexpected failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
