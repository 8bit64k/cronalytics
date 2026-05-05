#!/usr/bin/env python3
"""Cronalytics — synthetic test dataset generator.

Creates a realistic `facts.test.db` with ~1,500 runs over 180 days across
8 cron jobs using actual OpenRouter pricing. Also writes `jobs.test.json`
so names and schedules resolve in the dashboard.

Usage:
    python seed_test_db.py              # Create facts.test.db + jobs.test.json
    python seed_test_db.py --activate   # Backup facts.db, copy test data in
    python seed_test_db.py --restore    # Restore facts.db from backup
    python seed_test_db.py --destroy    # Remove test artifacts
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Pricing: dollars per 1M tokens (input / output)
# ---------------------------------------------------------------------------

PRICING: dict[str, tuple[float, float]] = {
    "gpt-5.4-nano": (0.20, 1.25),
    "gpt-5.4-mini": (0.75, 4.50),
    "gemini-3.1-flash": (0.50, 3.00),
    "kimi-k2.6": (0.74, 3.49),
    "gpt-5.5": (1.75, 14.00),
    "claude-sonnet-4.6": (3.00, 15.00),
    "claude-opus-4.6": (5.00, 30.00),
    "gpt-5.5-pro": (30.00, 180.00),
}

# ---------------------------------------------------------------------------
# Job definitions
# ---------------------------------------------------------------------------

@dataclass
class JobDef:
    job_id: str
    name: str
    schedule: str          # human-readable, for jobs.json
    cron_expr: str         # actual schedule (for reference)
    model: str
    tokens_in_range: tuple[int, int]
    tokens_out_range: tuple[int, int]
    cache_read_frac: float # fraction of input that is cache read
    cache_write_frac: float
    duration_range: tuple[float, float]  # seconds
    failure_rate: float
    run_generator: callable  # yields run datetimes


def _daily_at(hour: int, minute: int = 0):
    def gen(start: datetime, end: datetime):
        dt = datetime(start.year, start.month, start.day, hour, minute, tzinfo=timezone.utc)
        if dt < start:
            dt += timedelta(days=1)
        while dt <= end:
            yield dt
            dt += timedelta(days=1)
    return gen


def _every_n_minutes(n: int):
    def gen(start: datetime, end: datetime):
        dt = start.replace(second=0, microsecond=0)
        # Align to nearest n-minute boundary
        extra = (n - (dt.minute % n)) % n
        dt += timedelta(minutes=extra)
        while dt <= end:
            yield dt
            dt += timedelta(minutes=n)
    return gen


def _every_n_hours(n: int, offset_hours: int = 0):
    def gen(start: datetime, end: datetime):
        dt = datetime(start.year, start.month, start.day, offset_hours, 0, tzinfo=timezone.utc)
        if dt < start:
            days_behind = (start - dt).days
            dt += timedelta(days=days_behind)
            while dt < start:
                dt += timedelta(hours=n)
        while dt <= end:
            yield dt
            dt += timedelta(hours=n)
    return gen


def _weekly_on(weekday: int, hour: int, minute: int = 0):
    def gen(start: datetime, end: datetime):
        dt = datetime(start.year, start.month, start.day, hour, minute, tzinfo=timezone.utc)
        # Advance to correct weekday
        while dt.weekday() != weekday:
            dt += timedelta(days=1)
        if dt < start:
            dt += timedelta(weeks=1)
        while dt <= end:
            yield dt
            dt += timedelta(weeks=1)
    return gen


JOBS: list[JobDef] = [
    JobDef(
        job_id="news_digest",
        name="News Digest",
        schedule="Daily at 09:00 UTC",
        cron_expr="0 9 * * *",
        model="gemini-3.1-flash",
        tokens_in_range=(800, 2500),
        tokens_out_range=(1000, 4000),
        cache_read_frac=0.15,
        cache_write_frac=0.05,
        duration_range=(4.0, 12.0),
        failure_rate=0.02,
        run_generator=_daily_at(9, 0),
    ),
    JobDef(
        job_id="code_review",
        name="Code Review",
        schedule="Every 6 hours",
        cron_expr="0 */6 * * *",
        model="claude-sonnet-4.6",
        tokens_in_range=(3000, 8000),
        tokens_out_range=(2000, 6000),
        cache_read_frac=0.25,
        cache_write_frac=0.08,
        duration_range=(15.0, 45.0),
        failure_rate=0.05,
        run_generator=_every_n_hours(6, 2),
    ),
    JobDef(
        job_id="social_poster",
        name="Social Poster",
        schedule="Every 2 hours",
        cron_expr="0 */2 * * *",
        model="gpt-5.4-mini",
        tokens_in_range=(500, 1500),
        tokens_out_range=(800, 2500),
        cache_read_frac=0.10,
        cache_write_frac=0.03,
        duration_range=(2.0, 8.0),
        failure_rate=0.01,
        run_generator=_every_n_hours(2, 0),
    ),
    JobDef(
        job_id="weekly_report",
        name="Weekly Report",
        schedule="Mondays at 08:00 UTC",
        cron_expr="0 8 * * 1",
        model="claude-opus-4.6",
        tokens_in_range=(5000, 15000),
        tokens_out_range=(3000, 10000),
        cache_read_frac=0.20,
        cache_write_frac=0.05,
        duration_range=(30.0, 90.0),
        failure_rate=0.15,
        run_generator=_weekly_on(0, 8, 0),  # Monday=0
    ),
    JobDef(
        job_id="health_check",
        name="Health Check",
        schedule="Every 15 minutes",
        cron_expr="*/15 * * * *",
        model="gpt-5.4-nano",
        tokens_in_range=(200, 800),
        tokens_out_range=(100, 500),
        cache_read_frac=0.30,
        cache_write_frac=0.10,
        duration_range=(1.0, 4.0),
        failure_rate=0.005,
        run_generator=_every_n_minutes(15),
    ),
    JobDef(
        job_id="data_sync",
        name="Data Sync",
        schedule="Every 4 hours",
        cron_expr="0 */4 * * *",
        model="kimi-k2.6",
        tokens_in_range=(1500, 4000),
        tokens_out_range=(1000, 3000),
        cache_read_frac=0.18,
        cache_write_frac=0.06,
        duration_range=(8.0, 25.0),
        failure_rate=0.03,
        run_generator=_every_n_hours(4, 1),
    ),
    JobDef(
        job_id="model_eval",
        name="Model Evaluation",
        schedule="Daily at 02:00 UTC",
        cron_expr="0 2 * * *",
        model="gpt-5.5-pro",
        tokens_in_range=(10000, 30000),
        tokens_out_range=(5000, 15000),
        cache_read_frac=0.05,
        cache_write_frac=0.02,
        duration_range=(60.0, 180.0),
        failure_rate=0.25,
        run_generator=_daily_at(2, 0),
    ),
    JobDef(
        job_id="backup_verify",
        name="Backup Verify",
        schedule="Daily at 00:00 UTC",
        cron_expr="0 0 * * *",
        model="gemini-3.1-flash",
        tokens_in_range=(300, 1000),
        tokens_out_range=(200, 800),
        cache_read_frac=0.20,
        cache_write_frac=0.05,
        duration_range=(3.0, 10.0),
        failure_rate=0.01,
        run_generator=_daily_at(0, 0),
    ),
]

# A "deleted" job that only ran for the first 90 days
DELETED_JOB = JobDef(
    job_id="old_scanner",
    name="Old Scanner",
    schedule="Hourly",
    cron_expr="0 * * * *",
    model="gpt-5.4-mini",
    tokens_in_range=(400, 1200),
    tokens_out_range=(300, 900),
    cache_read_frac=0.10,
    cache_write_frac=0.03,
    duration_range=(2.0, 6.0),
    failure_rate=0.02,
    run_generator=_every_n_hours(1, 0),
)


# ---------------------------------------------------------------------------
# Schema (copied from facts.py)
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cron_runs (
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
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id
    ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_run_time
    ON cron_runs(run_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ingested
    ON cron_runs(ingested_at);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _randint(lo: int, hi: int) -> int:
    return random.randint(lo, hi)


def _randfloat(lo: float, hi: float) -> float:
    return random.uniform(lo, hi)


def _tokens_for_job(job: JobDef) -> tuple[int, int, int, int, int]:
    """Return (input, output, reasoning, cache_read, cache_write)."""
    inp = _randint(*job.tokens_in_range)
    out = _randint(*job.tokens_out_range)
    # Reasoning is only for reasoning models; small fraction
    reasoning = _randint(0, int(inp * 0.05)) if "o3" in job.model or "claude" in job.model else 0
    cr = int(inp * job.cache_read_frac * random.uniform(0.5, 1.5))
    cw = int(inp * job.cache_write_frac * random.uniform(0.5, 1.5))
    return inp, out, reasoning, cr, cw


def _cost_for(model: str, inp: int, out: int, cr: int, cw: int) -> float:
    """Compute estimated cost in USD."""
    in_price, out_price = PRICING[model]
    # Cache read is 10% of input price (OpenRouter convention)
    cr_price = in_price * 0.10
    # Cache write is same as input price
    cw_price = in_price
    cost = (
        (inp / 1_000_000) * in_price +
        (out / 1_000_000) * out_price +
        (cr / 1_000_000) * cr_price +
        (cw / 1_000_000) * cw_price
    )
    return round(cost, 6)


def _session_id(job_id: str, dt: datetime) -> str:
    return f"cron_{job_id}_{dt.strftime('%Y%m%d_%H%M%S')}"


def _make_jobs_json(jobs: list[JobDef], deleted_jobs: list[JobDef] | None = None) -> dict:
    """Build a jobs.json-compatible dict. Deleted jobs are omitted."""
    entries = []
    for job in jobs:
        entries.append({
            "id": job.job_id,
            "name": job.name,
            "schedule": {
                "kind": "cron",
                "expr": job.cron_expr,
                "display": job.schedule,
            },
            "command": f"python -m cronalytics.dummy {job.job_id}",
            "enabled": True,
        })
    return {"jobs": entries}


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def generate_runs(
    jobs: list[JobDef],
    days: int = 180,
    seed: int = 42,
    deleted_jobs: list[tuple[JobDef, int]] | None = None,
) -> list[dict]:
    """Generate synthetic cron run rows."""
    random.seed(seed)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    runs: list[dict] = []

    all_jobs = list(jobs)
    if deleted_jobs:
        all_jobs.extend([dj[0] for dj in deleted_jobs])

    for job in all_jobs:
        # Determine cutoff for deleted jobs
        job_end = now
        if deleted_jobs:
            for dj, dj_days in deleted_jobs:
                if dj.job_id == job.job_id:
                    job_end = start + timedelta(days=dj_days)
                    break

        for dt in job.run_generator(start, job_end):
            # Occasional missed run (5% chance for most jobs)
            if random.random() < 0.05:
                continue

            success = random.random() >= job.failure_rate
            inp, out, reasoning, cr, cw = _tokens_for_job(job)
            cost = _cost_for(job.model, inp, out, cr, cw)
            duration = _randfloat(*job.duration_range)
            if not success:
                # Failed runs: truncated duration, no output tokens
                duration *= random.uniform(0.3, 0.7)
                out = int(out * random.uniform(0.1, 0.4))
                cost *= random.uniform(0.3, 0.6)

            run_time = dt.timestamp()
            ended_at = run_time + duration
            session_id = _session_id(job.job_id, dt)

            runs.append({
                "session_id": session_id,
                "job_id": job.job_id,
                "run_time": run_time,
                "ended_at": ended_at,
                "duration_seconds": round(duration, 2),
                "model": job.model,
                "input_tokens": inp,
                "output_tokens": out,
                "reasoning_tokens": reasoning,
                "cache_read_tokens": cr,
                "cache_write_tokens": cw,
                "estimated_cost_usd": round(cost, 6),
                "actual_cost_usd": round(cost, 6),
                "cost_status": "complete",
                "cost_source": "openrouter",
                "billing_provider": "openrouter",
                "api_call_count": _randint(1, 8) if success else _randint(1, 3),
                "message_count": _randint(2, 12) if success else _randint(1, 4),
                "tool_call_count": _randint(0, 6) if success else _randint(0, 2),
                "end_reason": "cron_complete" if success else "error",
                "success": 1 if success else 0,
                "ingested_at": now.timestamp(),
            })

    return runs


def write_db(db_path: Path, runs: list[dict]) -> int:
    """Write runs to SQLite, returning count inserted."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA_SQL)

    cols = [
        "session_id", "job_id", "run_time", "ended_at", "duration_seconds",
        "model", "input_tokens", "output_tokens", "reasoning_tokens",
        "cache_read_tokens", "cache_write_tokens",
        "estimated_cost_usd", "actual_cost_usd", "cost_status", "cost_source",
        "billing_provider", "api_call_count", "message_count", "tool_call_count",
        "end_reason", "success", "ingested_at",
    ]
    placeholders = ", ".join(["?"] * len(cols))
    sql = f"INSERT OR IGNORE INTO cron_runs ({', '.join(cols)}) VALUES ({placeholders})"

    rows = [tuple(r[c] for c in cols) for r in runs]
    conn.executemany(sql, rows)
    conn.commit()
    count = conn.execute("SELECT count(*) FROM cron_runs").fetchone()[0]
    conn.close()
    return count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Cronalytics synthetic test data")
    parser.add_argument("--days", type=int, default=180, help="Days of history (default 180)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default 42)")
    parser.add_argument("--db", type=Path, default=None, help="Target DB path (default: facts.test.db)")
    parser.add_argument("--activate", action="store_true", help="Backup facts.db and copy test data in")
    parser.add_argument("--restore", action="store_true", help="Restore facts.db from backup")
    parser.add_argument("--destroy", action="store_true", help="Remove test artifacts")
    args = parser.parse_args()

    plugin_dir = Path(__file__).parent.resolve()
    test_db = args.db or plugin_dir / "facts.test.db"
    real_db = plugin_dir / "facts.db"
    backup_db = plugin_dir / "facts.db.bak"
    jobs_test_json = plugin_dir / "jobs.test.json"

    if args.destroy:
        for p in (test_db, backup_db, jobs_test_json):
            if p.exists():
                p.unlink()
                print(f"Removed {p.name}")
        return 0

    if args.restore:
        if not backup_db.exists():
            print("No backup found. Nothing to restore.")
            return 1
        if real_db.exists():
            real_db.unlink()
        backup_db.rename(real_db)
        print(f"Restored {real_db.name} from backup.")
        return 0

    if args.activate:
        if not test_db.exists():
            print("Test DB not found. Run without --activate first.")
            return 1
        if real_db.exists():
            if backup_db.exists():
                backup_db.unlink()
            real_db.rename(backup_db)
            print(f"Backed up real DB to {backup_db.name}")
        # Copy test DB to real location using sqlite3 dump/restore to avoid WAL corruption
        import shutil
        # Close any open connections first by removing WAL files
        for wal_file in real_db.parent.glob("*.db-wal"):
            wal_file.unlink()
        for shm_file in real_db.parent.glob("*.db-shm"):
            shm_file.unlink()
        shutil.copy2(test_db, real_db)
        print(f"Activated test data: {real_db.name}")
        print("Restart Hermes dashboard to see it.")
        return 0

    # Default: generate test data
    print(f"Generating synthetic data ({args.days} days, seed={args.seed})...")

    runs = generate_runs(
        JOBS,
        days=args.days,
        seed=args.seed,
        deleted_jobs=[(DELETED_JOB, 90)],  # old_scanner ran for first 90 days only
    )

    count = write_db(test_db, runs)
    print(f"Wrote {count} runs to {test_db.name}")

    # Write jobs.test.json (omits the deleted job)
    jobs_json = _make_jobs_json(JOBS)
    jobs_test_json.write_text(json.dumps(jobs_json, indent=2))
    print(f"Wrote {len(jobs_json)} active jobs to {jobs_test_json.name}")

    # Quick stats
    total_cost = sum(r["estimated_cost_usd"] for r in runs)
    by_job: dict[str, int] = {}
    for r in runs:
        by_job[r["job_id"]] = by_job.get(r["job_id"], 0) + 1

    print(f"\nTotal estimated cost: ${total_cost:,.2f}")
    print("Runs by job:")
    for job_id, n in sorted(by_job.items(), key=lambda x: -x[1]):
        print(f"  {job_id:20s} {n:5d} runs")

    print(f"\nTo preview:  python -m cronalytics.cli summary --db {test_db}")
    print(f"To activate: python seed_test_db.py --activate")
    print(f"To restore:  python seed_test_db.py --restore")
    return 0


if __name__ == "__main__":
    sys.exit(main())
