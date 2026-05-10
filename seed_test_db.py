#!/usr/bin/env python3
"""Generate a synthetic fact.test.db for visual testing of Cronalytics.

Usage:
    python3 seed_test_db.py          # creates/overwrites fact.test.db
    python3 seed_test_db.py --days 7 # shorter window for edge-case testing
"""

import argparse
import random
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    from config import PLUGIN_DIR
except ImportError:
    PLUGIN_DIR = Path(__file__).parent

# ── Configuration ──────────────────────────────────────────────────────

JOBS = [
    # (job_id, name, schedule_cron, model, avg_cost, avg_dur_sec, failure_rate)
    ("a1b2c3d4e5f6", "Daily Newsletter",      "0 8 * * *",   "gpt-4o-mini",       0.002,  12, 0.02),
    ("b2c3d4e5f6a7", "Hourly Health Check",   "0 * * * *",   "claude-sonnet-4",   0.008,  45, 0.05),
    ("c3d4e5f6a7b8", "4h Trend Analysis",     "0 */4 * * *", "gpt-4o",            0.045, 120, 0.08),
    ("d4e5f6a7b8c9", "Weekly Report",         "0 9 * * 1",   "claude-sonnet-4",   0.120, 300, 0.10),
    ("e5f6a7b8c9d0", "Git Sync",              "*/30 * * * *","gpt-4o-mini",       0.001,   5, 0.01),
    ("f6a7b8c9d0e1", "Backup",                "0 3 * * *",   None,                0.000,  60, 0.00),  # no_agent
    ("a7b8c9d0e1f2", "SEO Audit",             "0 6 * * 0",   "gpt-4o",            0.080, 180, 0.15),
    ("b8c9d0e1f2a3", "Security Scan",         "0 */6 * * *", "claude-sonnet-4",   0.035,  90, 0.20),
    ("c9d0e1f2a3b4", "Content Summarizer",    "0 */2 * * *", "gpt-4o-mini",       0.003,  20, 0.03),
    ("d0e1f2a3b4c5", "Monthly Billing Recon", "0 5 1 * *",   "gpt-4o",            0.060, 240, 0.05),
]

MODELS = {
    "gpt-4o-mini":      {"provider": "openai",     "input": 0.15,  "output": 0.60},
    "gpt-4o":           {"provider": "openai",     "input": 2.50,  "output": 10.0},
    "claude-sonnet-4":  {"provider": "anthropic",  "input": 3.00,  "output": 15.0},
    "claude-haiku-3":   {"provider": "anthropic",  "input": 0.25,  "output": 1.25},
    "o3-mini":          {"provider": "openai",     "input": 1.10,  "output": 4.40},
}

def fmt_iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def generate_run(job, run_time: datetime) -> dict:
    """Create a single synthetic cron run."""
    job_id, name, cron, model, avg_cost, avg_dur, fail_rate = job
    is_no_agent = model is None

    # Jitter duration ±30%
    dur = avg_dur * random.uniform(0.7, 1.3)
    duration_ms = int(dur * 1000)

    success = random.random() > fail_rate
    end_reason = "cron_complete" if success else ("cron_error" if random.random() > 0.5 else "timeout")

    # Token math: back out approximate tokens from cost
    if is_no_agent:
        input_tok = output_tok = cache_tok = 0
        cost_usd = 0.0
    else:
        m = MODELS.get(model, MODELS["gpt-4o-mini"])
        # approximate: 60/40 input/output split
        cost_per_1k = (m["input"] * 0.6 + m["output"] * 0.4) / 1000
        target_cost = avg_cost * random.uniform(0.5, 1.5)
        total_tok = int(target_cost / cost_per_1k * 1000)
        input_tok = int(total_tok * 0.65)
        output_tok = int(total_tok * 0.30)
        cache_tok = int(total_tok * 0.05)
        cost_usd = round((input_tok * m["input"] + output_tok * m["output"]) / 1_000_000, 6)

    # Introduce occasional zero-cost agent runs (edge case)
    if not is_no_agent and random.random() < 0.03:
        cost_usd = 0.0

    return {
        "session_id": f"sess_{job_id}_{int(run_time.timestamp() * 1000)}",
        "job_id": job_id,
        "run_time": run_time.timestamp(),
        "ended_at": (run_time + timedelta(seconds=dur)).timestamp(),
        "duration_seconds": round(dur, 1),
        "model": model,
        "input_tokens": input_tok,
        "output_tokens": output_tok,
        "reasoning_tokens": 0,
        "cache_read_tokens": cache_tok,
        "cache_write_tokens": 0,
        "estimated_cost_usd": cost_usd,
        "actual_cost_usd": None,
        "cost_status": "estimated" if cost_usd > 0 else None,
        "cost_source": "computed",
        "billing_provider": m["provider"] if not is_no_agent else None,
        "api_call_count": random.randint(1, 8) if not is_no_agent else 0,
        "message_count": random.randint(2, 20) if not is_no_agent else 0,
        "tool_call_count": random.randint(0, 4) if not is_no_agent else 0,
        "end_reason": end_reason,
        "success": 1 if success else 0,
        "job_mode": "no_agent" if is_no_agent else "agent",
    }


def seed(db_path: Path, days: int = 30):
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")

    conn.execute("""
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
            job_mode TEXT DEFAULT 'agent',
            ingested_at REAL DEFAULT (unixepoch())
        )
    """)
    conn.execute("CREATE INDEX idx_cron_runs_job_id ON cron_runs(job_id)")
    conn.execute("CREATE INDEX idx_cron_runs_run_time ON cron_runs(run_time DESC)")
    conn.execute("CREATE INDEX idx_cron_runs_ingested ON cron_runs(ingested_at)")
    conn.execute("CREATE INDEX idx_cron_runs_job_mode ON cron_runs(job_mode)")

    now = datetime.now()
    start = now - timedelta(days=days)
    total = 0

    for job in JOBS:
        job_id, name, cron, model, avg_cost, avg_dur, fail_rate = job
        # Parse cron-ish schedule into a run generator
        parts = cron.split()
        if parts[0] == "*/30":           # every 30 min
            interval = timedelta(minutes=30)
        elif parts[0] == "0" and parts[1].startswith("*/"):  # every N hours
            n = int(parts[1].split("/")[1])
            interval = timedelta(hours=n)
        elif parts[0] == "0" and parts[2] == "*" and parts[3] == "*" and parts[4] == "*":
            interval = timedelta(days=1)  # daily
        elif parts[0] == "0" and parts[4] != "*":
            interval = timedelta(weeks=1) # weekly
        elif parts[0] == "0" and parts[2] == "1":
            interval = timedelta(days=30) # monthly-ish
        else:
            interval = timedelta(hours=4) # fallback

        t = start
        while t < now:
            # Shift exact minute slightly so all "0 *" jobs don't stack exactly
            t_run = t + timedelta(seconds=random.randint(0, 120))
            if t_run > now:
                break
            row = generate_run(job, t_run)
            conn.execute("""
                INSERT INTO cron_runs (
                    session_id, job_id, run_time, ended_at, duration_seconds, model,
                    input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, cache_write_tokens,
                    estimated_cost_usd, actual_cost_usd, cost_status, cost_source, billing_provider,
                    api_call_count, message_count, tool_call_count, end_reason, success, job_mode
                ) VALUES (
                    :session_id, :job_id, :run_time, :ended_at, :duration_seconds, :model,
                    :input_tokens, :output_tokens, :reasoning_tokens, :cache_read_tokens, :cache_write_tokens,
                    :estimated_cost_usd, :actual_cost_usd, :cost_status, :cost_source, :billing_provider,
                    :api_call_count, :message_count, :tool_call_count, :end_reason, :success, :job_mode
                )
            """, row)
            total += 1
            t += interval

    conn.commit()
    conn.close()

    # Summary
    conn = sqlite3.connect(str(db_path))
    agent_runs = conn.execute("SELECT COUNT(*) FROM cron_runs WHERE job_mode='agent'").fetchone()[0]
    script_runs = conn.execute("SELECT COUNT(*) FROM cron_runs WHERE job_mode='no_agent'").fetchone()[0]
    total_cost = conn.execute("SELECT COALESCE(SUM(estimated_cost_usd),0) FROM cron_runs").fetchone()[0]
    conn.close()

    print(f"Seeded {db_path.name}: {total} runs ({agent_runs} agent, {script_runs} script)")
    print(f"  Total cost: ${total_cost:.4f}")
    print(f"  Window: last {days} days")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30, help="Days of history to generate")
    args = parser.parse_args()

    db = PLUGIN_DIR / "fact.test.db"
    seed(db, args.days)
