"""Cronalytics CLI — standalone terminal data dump.

Usage (dashboard plugin install):
    python ~/.hermes/plugins/cronalytics/cli.py [--days N] [--outcome both|success|failure] [--mode all|agent|no_agent]
    python ~/.hermes/plugins/cronalytics/cli.py summary [--days N] [--outcome ...] [--mode ...] [--json]
    python ~/.hermes/plugins/cronalytics/cli.py jobs    [--days N] [--outcome ...] [--mode ...] [--json]
    python ~/.hermes/plugins/cronalytics/cli.py runs   --job JOB_ID [--days N] [--outcome ...] [--mode ...] [--json]
    python ~/.hermes/plugins/cronalytics/cli.py models [--days N] [--outcome ...] [--mode ...] [--json]
    python ~/.hermes/plugins/cronalytics/cli.py trends [--days N] [--outcome ...] [--mode ...] [--json]
    python ~/.hermes/plugins/cronalytics/cli.py all   [--days N] [--outcome ...] [--mode ...]
    python ~/.hermes/plugins/cronalytics/cli.py health [--json]

Usage (pip install):
    pip install cronalytics
    cronalytics [--days N] [--outcome both|success|failure] [--mode all|agent|no_agent]
    cronalytics summary [--days N] [--outcome ...] [--mode ...] [--json]
    ... (same commands)

JSON output (pipe-friendly):
    cronalytics jobs --days 7 --json | jq '.data[] | select(.runs > 10) | .job_id'

The CLI auto-detects your plugin's fact database. If installed via pip and the
auto-detection fails, pass --db explicitly:
    cronalytics summary --db ~/.hermes/plugins/cronalytics/facts.db --days 7
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ---------------------------------------------------------------------------
# assuming we're run from inside the plugin repo; facts.py lives next door.
# ---------------------------------------------------------------------------
_HERE = Path(__file__).parent.resolve()
sys.path.insert(0, str(_HERE))

import config
from facts import (
    get_conn,
    query_health,
    query_job_runs,
    query_jobs,
    query_models,
    query_summary,
    query_trends,
)
from schedule import get_job_projections

# Hermes jobs.json lives in the cron subdirectory
_JOBS_PATH = config.HERMES_HOME / "cron" / "jobs.json"

def _resolve_db(cli_db: Path | None) -> Path:
    """Resolve the fact DB path, preferring the plugin directory when possible.

    Priority:
        1. Explicit --db flag
        2. config.FACT_DB (works when run from plugin directory)
        3. ~/.hermes/plugins/cronalytics/facts.db (pip install fallback)
        4. config.FACT_DB as final fallback (creates empty DB if absent)
    """
    if cli_db is not None:
        return cli_db
    if config.FACT_DB.exists():
        return config.FACT_DB
    plugin_db = Path.home() / ".hermes" / "plugins" / "cronalytics" / "facts.db"
    if plugin_db.exists():
        return plugin_db
    return config.FACT_DB


def _load_job_names() -> dict[str, str]:
    """Load job_id → name mapping from Hermes jobs.json."""
    if not _JOBS_PATH.exists():
        return {}
    try:
        data = json.loads(_JOBS_PATH.read_text())
        # Hermes jobs.json: {"jobs": [{"id": ..., "name": ...}, ...]}
        if isinstance(data, dict) and "jobs" in data and isinstance(data["jobs"], list):
            return {j.get("id", ""): j.get("name", "") for j in data["jobs"]}
        if isinstance(data, dict):
            return {jid: info.get("name", "") for jid, info in data.items() if isinstance(info, dict)}
        if isinstance(data, list):
            return {j.get("id", ""): j.get("name", "") for j in data}
    except Exception:
        pass
    return {}

# ---------------------------------------------------------------------------
# Formatting helpers (match hermes insights compact style)
# ---------------------------------------------------------------------------

def _fmt_cost(n: float | None) -> str:
    if n is None:
        return "—"
    return f"${n:,.2f}"


def _fmt_tokens(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def _fmt_dt(ts: float | None) -> str:
    if not ts:
        return "—"
    return datetime.fromtimestamp(ts).strftime("%b %d %H:%M")


def _bar_chart(values: list[int], max_width: int = 20) -> list[str]:
    peak = max(values) if values else 1
    if peak == 0:
        return ["" for _ in values]
    return ["█" * max(1, int(v / peak * max_width)) if v > 0 else "" for v in values]


def _visual_len(s: str) -> int:
    """Return visual display width of a string, accounting for wide chars."""
    import unicodedata

    width = 0
    for c in s:
        if unicodedata.east_asian_width(c) in ("F", "W"):
            width += 2
        else:
            width += 1
    return width


def _banner_line(text: str, inner_width: int) -> str:
    """Center text inside a banner line with correct visual alignment."""
    vis = _visual_len(text)
    pad = inner_width - vis
    if pad < 0:
        pad = 0
    left = pad // 2
    right = pad - left
    return f"  ║{' ' * left}{text}{' ' * right}║"


def _banner(title: str, subtitle: str | None = None, inner_width: int = 58) -> list[str]:
    """Build boxed banner lines."""
    border = "═" * inner_width
    lines = [f"  ╔{border}╗"]
    lines.append(_banner_line(title, inner_width))
    if subtitle:
        lines.append(_banner_line(subtitle, inner_width))
    lines.append(f"  ╚{border}╝")
    return lines


def _date_range(days: int) -> str:
    """Return a human-readable date range for the given day filter."""
    if days == 0:
        # All time: query DB for actual data range
        conn = get_conn(config.FACT_DB)
        cur = conn.cursor()
        cur.execute("SELECT MIN(run_time), MAX(run_time) FROM cron_runs")
        row = cur.fetchone()
        if row and row[0] and row[1]:
            start = datetime.fromtimestamp(row[0])
            end = datetime.fromtimestamp(row[1])
            return f"{start.strftime('%b %d')} — {end.strftime('%b %d, %Y')}"
        return ""
    today = datetime.now()
    start = today - timedelta(days=days - 1)
    end = today
    return f"{start.strftime('%b %d')} — {end.strftime('%b %d, %Y')}"


def _json_dates(days: int) -> tuple[str, str]:
    """Return ISO start_date and end_date for a day filter."""
    if days == 0:
        # All time: query DB for actual data range
        conn = get_conn(config.FACT_DB)
        cur = conn.cursor()
        cur.execute("SELECT MIN(run_time), MAX(run_time) FROM cron_runs")
        row = cur.fetchone()
        if row and row[0] and row[1]:
            start = datetime.fromtimestamp(row[0])
            end = datetime.fromtimestamp(row[1])
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        return "", ""
    today = datetime.now()
    start = today - timedelta(days=days - 1)
    end = today
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _json_envelope(data, args: argparse.Namespace, include_filters: bool = True) -> dict:
    """Wrap raw data in a lightweight envelope with period + filter context."""
    days: int = args.days
    period = f"Last {days} days" if days > 0 else "All time"
    start_date, end_date = _json_dates(days)
    envelope: dict = {
        "period": period,
        "data": data,
    }
    if start_date:
        envelope["start_date"] = start_date
        envelope["end_date"] = end_date
    if include_filters:
        envelope["outcome"] = args.outcome
        envelope["mode"] = args.mode
    return envelope


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_summary(args: argparse.Namespace) -> int:
    days: int = args.days
    data = query_summary(config.FACT_DB, days=days, outcome=args.outcome, mode=args.mode)
    if getattr(args, "json", False):
        print(json.dumps(_json_envelope(data, args), indent=2, default=str))
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    dr = _date_range(days)
    subtitle = f"{period}  ·  {dr}" if dr else period
    lines: list[str] = [""] + _banner("📊 Cronalytics Summary", subtitle, inner_width=58) + [""]

    lines.append(f"  Runs:              {data['total_runs']:,}")
    lines.append(f"  Estimated cost:    {_fmt_cost(data['total_estimated_cost'])}")
    lines.append(f"  Actual cost:       {_fmt_cost(data['total_actual_cost'])}")
    lines.append(f"  Tokens:            {_fmt_tokens(data['total_tokens'])}  "
                 f"(In: {_fmt_tokens(data['total_input_tokens'])}  "
                 f"Out: {_fmt_tokens(data['total_output_tokens'])}  "
                 f"Cached: {_fmt_tokens(data['total_cache_read_tokens'])})")
    lines.append("")

    prev = data.get("previous_period", {})
    if prev:
        lines.append(f"  Previous period:   {prev.get('runs', 0):,} runs, "
                     f"{_fmt_cost(prev.get('cost'))}")
        lines.append(f"  Trend:             {data['trend']}")
        lines.append("")

    by_model = data.get("cost_by_model", [])
    if by_model:
        lines.append("  🤖 Cost by Model")
        lines.append("  " + "─" * 52)
        lines.append(f"  {'Model':30} {'Runs':>8} {'Cost':>12}")
        for m in by_model:
            lines.append(f"  {(m['model'] or 'unknown'):30} {m['runs']:>8,} {_fmt_cost(m['total_cost']):>12}")
        lines.append("")

    print("\n".join(lines))
    return 0


def cmd_jobs(args: argparse.Namespace) -> int:
    days: int = args.days
    jobs = query_jobs(config.FACT_DB, days=days, outcome=args.outcome, mode=args.mode)
    if getattr(args, "json", False):
        print(json.dumps(_json_envelope(jobs, args), indent=2, default=str))
        return 0
    if not jobs:
        print(f"  No cron jobs found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    dr = _date_range(days)
    subtitle = f"{period}  ·  {dr}" if dr else period
    lines: list[str] = [""] + _banner("🤖 Cronalytics Jobs", subtitle, inner_width=68) + [""]

    lines.append("  Jobs overview")
    lines.append("  " + "─" * 68)
    lines.append(f"  {'Job ID':12} {'Job':14} {'Runs':>5} {'Cost':>10} {'Dur':>6} {'Tokens':>10} {'Pace':>5}")
    lines.append("  " + "─" * 68)

    names = _load_job_names()
    for j in jobs:
        job_id = j["job_id"]
        job_label = names.get(job_id, "") or job_id
        max_base = 10 if j.get("job_mode") == "no_agent" else 14
        if len(job_label) > max_base:
            job_label = job_label[: max_base - 1] + "…"
        if j.get("job_mode") == "no_agent":
            job_label += " [N]"
        cost = _fmt_cost(j["total_cost"])
        tokens = _fmt_tokens(j["total_tokens"])
        dur = j.get("avg_duration")
        dur_str = f"{dur:.0f}s" if dur is not None else "—"

        # Pace requires projection data
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

        lines.append(f"  {job_id:12} {job_label:14} {j['runs']:>5} {cost:>10} {dur_str:>6} {tokens:>10} {pace_str:>5}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_runs(args: argparse.Namespace) -> int:
    days: int = args.days
    job_id: str = args.job
    runs = query_job_runs(config.FACT_DB, job_id=job_id, limit=50, days=days, outcome=args.outcome, mode=args.mode)
    if getattr(args, "json", False):
        print(json.dumps(_json_envelope(runs, args), indent=2, default=str))
        return 0
    if not runs:
        print(f"  No runs found for job '{job_id}' in the last {days} days.")
        return 0

    dr = _date_range(days)
    subtitle = f"Last {days} days  ·  {dr}" if dr else "All time"
    lines: list[str] = [""] + _banner(f"📝 Runs: {job_id}", subtitle, inner_width=58) + [""]

    lines.append(f"  {'Time':16} {'Dur':>5} {'Cost':>8} {'Tks':>7} {'M':22} {'✓':>2}")
    lines.append("  " + "─" * 65)

    for r in runs:
        t = _fmt_dt(r.get("run_time"))
        dur = r.get("duration_seconds")
        dur_str = f"{dur:.0f}s" if dur is not None else "—"
        cost = _fmt_cost(r.get("estimated_cost_usd"))
        tok = _fmt_tokens(
            r.get("input_tokens", 0) + r.get("output_tokens", 0) +
             r.get("cache_read_tokens", 0) + r.get("cache_write_tokens", 0)
        )
        model = (r.get("model") or "unknown")[:21]
        if r.get("job_mode") == "no_agent":
            model += " [N]"
        ok = "✓" if r.get("success") else "✗"
        lines.append(f"  {t:16} {dur_str:>5} {cost:>8} {tok:>7} {model:22} {ok:>2}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_models(args: argparse.Namespace) -> int:
    days: int = args.days
    models = query_models(config.FACT_DB, days=days, outcome=args.outcome, mode=args.mode)
    if getattr(args, "json", False):
        print(json.dumps(_json_envelope(models, args), indent=2, default=str))
        return 0
    if not models:
        print(f"  No model data found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    dr = _date_range(days)
    subtitle = f"{period}  ·  {dr}" if dr else period
    lines: list[str] = [""] + _banner("🤖 Cronalytics Models", subtitle, inner_width=58) + [""]

    lines.append(f"  {'Model':30} {'Runs':>8} {'Cost':>10} {'Tokens':>10}")
    lines.append("  " + "─" * 61)

    for m in models:
        model = (m["model"] or "unknown")[:28]
        cost = _fmt_cost(m["total_cost"])
        tokens = _fmt_tokens(m.get("total_input_tokens", 0) + m.get("total_output_tokens", 0))
        lines.append(f"  {model:30} {m['runs']:>8,} {cost:>10} {tokens:>10}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_trends(args: argparse.Namespace) -> int:
    days: int = args.days
    trends = query_trends(config.FACT_DB, days=days, outcome=args.outcome, mode=args.mode)
    if getattr(args, "json", False):
        print(json.dumps(_json_envelope(trends, args), indent=2, default=str))
        return 0
    if not trends:
        print(f"  No trend data found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    dr = _date_range(days)
    subtitle = f"{period}  ·  {dr}" if dr else period
    lines: list[str] = [""] + _banner("📈 Cronalytics Trends", subtitle, inner_width=58) + [""]

    vals = [t["runs"] for t in trends]
    bars = _bar_chart(vals, max_width=25)
    for i, t in enumerate(trends):
        bar = bars[i]
        cost = _fmt_cost(t.get("cost"))
        lines.append(f"  {t['day']}  {bar:25} {t['runs']:>3} runs  {cost}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    h = query_health(config.FACT_DB)
    if getattr(args, "json", False):
        print(json.dumps({"data": h}, indent=2, default=str))
        return 0
    lines: list[str] = [
        "",
    ] + _banner("💓 Cronalytics Health", inner_width=58) + [
        "",
        f"  Total runs:        {h['total_runs']:,}",
        f"  Unique jobs:       {h['unique_jobs']}",
        f"  Last ingested:     {_fmt_dt(h.get('last_ingested_at'))}",
        f"  Last run time:     {_fmt_dt(h.get('last_run_time'))}",
        "",
    ]
    print("\n".join(lines))
    return 0


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python cli.py",
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
        p.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days to look back (default: 30, 0 = all time)",
        )
        p.add_argument(
            "--outcome",
            choices=["both", "success", "failure"],
            default="both",
            help="Filter by outcome (default: both)",
        )
        p.add_argument(
            "--mode",
            choices=["all", "agent", "no_agent"],
            default="all",
            help="Filter by job mode (default: all)",
        )
        p.add_argument(
            "--db",
            type=Path,
            default=None,
            help="Path to fact DB (default: auto-detected from plugin directory)",
        )
        p.add_argument(
            "--json",
            action="store_true",
            help="Output raw JSON instead of formatted tables",
        )

    runs_parser = subparsers.add_parser("runs", help="Individual runs for a job")
    runs_parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to look back (default: 30, 0 = all time)",
    )
    runs_parser.add_argument("--job", required=True, help="Job ID filter")
    runs_parser.add_argument(
        "--outcome",
        choices=["both", "success", "failure"],
        default="both",
        help="Filter by outcome (default: both)",
    )
    runs_parser.add_argument(
        "--mode",
        choices=["all", "agent", "no_agent"],
        default="all",
        help="Filter by job mode (default: all)",
    )
    runs_parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to fact DB (default: auto-detected from plugin directory)",
    )
    runs_parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON instead of formatted tables",
    )

    all_parser = subparsers.add_parser("all", help="Run health + summary + jobs + models + trends")
    all_parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to look back (default: 30, 0 = all time)",
    )
    all_parser.add_argument(
        "--outcome",
        choices=["both", "success", "failure"],
        default="both",
        help="Filter by outcome (default: both)",
    )
    all_parser.add_argument(
        "--mode",
        choices=["all", "agent", "no_agent"],
        default="all",
        help="Filter by job mode (default: all)",
    )
    all_parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to fact DB (default: auto-detected from plugin directory)",
    )

    args = parser.parse_args(argv)

    db_path = _resolve_db(args.db)

    # Ensure DB exists / schema up-to-date
    get_conn(db_path)

    # Redirect all command handlers to use the specified DB
    config.FACT_DB = db_path

    if args.command == "all" or args.command is None:
        if getattr(args, "json", False):
            print("Error: --json is not supported with the 'all' command. Use a specific subcommand (e.g., 'jobs --json').", file=sys.stderr)
            return 1
        print("")
        print("\n".join(_banner("📋 Cronalytics Full Report", inner_width=58)))
        ret = 0
        ret |= cmd_health(args)
        ret |= cmd_summary(args)
        ret |= cmd_jobs(args)
        ret |= cmd_models(args)
        ret |= cmd_trends(args)
        return ret

    handler = {
        "summary": cmd_summary,
        "jobs": cmd_jobs,
        "runs": cmd_runs,
        "models": cmd_models,
        "trends": cmd_trends,
        "health": cmd_health,
    }[args.command]

    try:
        return handler(args)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
