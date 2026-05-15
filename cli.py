"""Cronalytics CLI — standalone terminal data dump.

Usage (from the plugin directory):
    python cli.py summary [--days N]
    python cli.py jobs    [--days N]
    python cli.py runs   --job JOB_ID [--days N]
    python cli.py models [--days N]
    python cli.py trends [--days N]
    python cli.py health
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
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

# Hermes jobs.json lives under ~/.hermes/cron/jobs.json
_JOBS_PATH = Path.home() / ".hermes" / "cron" / "jobs.json"

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


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_summary(args: argparse.Namespace) -> int:
    days: int = args.days
    data = query_summary(config.FACT_DB, days=days)

    period = f"Last {days} days" if days > 0 else "All time"
    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║                 📊 Cronalytics Summary                   ║",
        f"  ║               {period:^52} ║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
    ]

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
        lines.append("  " + "─" * 56)
        lines.append(f"  {'Model':30} {'Runs':>8} {'Cost':>12}")
        for m in by_model:
            lines.append(f"  {(m['model'] or 'unknown'):30} {m['runs']:>8,} {_fmt_cost(m['total_cost']):>12}")
        lines.append("")

    print("\n".join(lines))
    return 0


def cmd_jobs(args: argparse.Namespace) -> int:
    days: int = args.days
    jobs = query_jobs(config.FACT_DB, days=days)
    if not jobs:
        print(f"  No cron jobs found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║                  🤖 Cronalytics Jobs                     ║",
        f"  ║               {period:^52} ║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
        "  Jobs overview",
        "  " + "─" * 56,
        f"  {'Job ID':20} {'Runs':>5} {'Cost':>10} {'Tokens':>10} {'Pace':>6}",
        "  " + "─" * 56,
    ]

    for j in jobs:
        job_id = j["job_id"][:18]
        cost = _fmt_cost(j["total_cost"])
        tokens = _fmt_tokens(j["total_tokens"])

        # Pace requires projection data
        proj = get_job_projections(
            j["job_id"],
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

        lines.append(f"  {job_id:20} {j['runs']:>5} {cost:>10} {tokens:>10} {pace_str:>6}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_runs(args: argparse.Namespace) -> int:
    days: int = args.days
    job_id: str = args.job
    runs = query_job_runs(config.FACT_DB, job_id=job_id, limit=50, days=days)
    if not runs:
        print(f"  No runs found for job '{job_id}' in the last {days} days.")
        return 0

    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        f"  ║                📝 Runs: {job_id[:36]:37}║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
        f"  {'Time':16} {'Dur':>6} {'Cost':>9} {'Tokens':>8} {'Model':25}",
        "  " + "─" * 66,
    ]

    for r in runs:
        t = _fmt_dt(r.get("run_time"))
        dur = r.get("duration_seconds")
        dur_str = f"{dur:.0f}s" if dur is not None else "—"
        cost = _fmt_cost(r.get("estimated_cost_usd"))
        tok = _fmt_tokens(
            r.get("input_tokens", 0) + r.get("output_tokens", 0) +
             r.get("cache_read_tokens", 0) + r.get("cache_write_tokens", 0)
        )
        model = (r.get("model") or "unknown")[:24]
        lines.append(f"  {t:16} {dur_str:>6} {cost:>9} {tok:>8} {model:25}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_models(args: argparse.Namespace) -> int:
    days: int = args.days
    models = query_models(config.FACT_DB, days=days)
    if not models:
        print(f"  No model data found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║                 🤖 Cronalytics Models                    ║",
        f"  ║               {period:^52} ║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
        f"  {'Model':30} {'Runs':>8} {'Cost':>10} {'Tokens':>10}",
        "  " + "─" * 60,
    ]

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
    trends = query_trends(config.FACT_DB, days=days)
    if not trends:
        print(f"  No trend data found in the last {days} days.")
        return 0

    period = f"Last {days} days" if days > 0 else "All time"
    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║                📈 Cronalytics Trends                     ║",
        f"  ║               {period:^52} ║",
        "  ╚══════════════════════════════════════════════════════════╝",
        "",
    ]

    vals = [t["runs"] for t in trends]
    bars = _bar_chart(vals, max_width=25)
    for i, t in enumerate(trends):
        bar = bars[i]
        cost = _fmt_cost(t.get("cost"))
        lines.append(f"  {t['day']}  {bar:25} {t['runs']:>3} runs  {cost}")

    lines.append("")
    print("\n".join(lines))
    return 0


def cmd_health(_args: argparse.Namespace) -> int:
    h = query_health(config.FACT_DB)
    lines: list[str] = [
        "",
        "  ╔══════════════════════════════════════════════════════════╗",
        "  ║               💓 Cronalytics Health                      ║",
        "  ╚══════════════════════════════════════════════════════════╝",
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
        prog="cronalytics",
        description="Cronalytics CLI — dump cron run insights to the terminal",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Path to fact DB (default: facts.db)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

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
            "--db",
            type=Path,
            default=None,
            help="Path to fact DB (default: facts.db)",
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
        "--db",
        type=Path,
        default=None,
        help="Path to fact DB (default: facts.db)",
    )

    args = parser.parse_args(argv)

    db_path = args.db or config.FACT_DB

    # Ensure DB exists / schema up-to-date
    get_conn(db_path)

    # Redirect all command handlers to use the specified DB
    config.FACT_DB = db_path

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
