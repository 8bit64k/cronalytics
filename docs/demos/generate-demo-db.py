#!/usr/bin/env python3
"""Generate a synthetic demo fact.db for VHS demos and README screenshots."""

import json
import random
import sqlite3
import string
import sys
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)  # reproducible

DB_PATH = Path(__file__).parent / "demo-facts.db"
JOBS_PATH = Path(__file__).parent / "demo-jobs.json"

# ---------------------------------------------------------------------------
# Config — prices are $ per 1K tokens (OpenRouter pricing convention)
# ---------------------------------------------------------------------------
MODELS = [
    ("openai/gpt-4o", 0.0025, 0.010),
    ("openai/gpt-4o-mini", 0.00015, 0.0006),
    ("anthropic/claude-sonnet-4", 0.003, 0.015),
    ("anthropic/claude-haiku-3", 0.00025, 0.00125),
    ("google/gemini-2.0-flash", 0.00035, 0.00105),
    ("moonshotai/kimi-k2.6", 0.001, 0.003),
]

JOBS = [
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Daily Security Audit", "mode": "agent",
     "schedule": "0 6 * * *", "display": "Daily at 6am",
     "runs_per_day": 1.0, "failure_rate": 0.05},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Weekly Report Compiler", "mode": "agent",
     "schedule": "0 9 * * 1", "display": "Mondays at 9am",
     "runs_per_day": 0.15, "failure_rate": 0.10},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Backup Verifier", "mode": "no_agent",
     "schedule": "*/30 * * * *", "display": "Every 30 min",
     "runs_per_day": 48.0, "failure_rate": 0.02},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Log Analyzer", "mode": "agent",
     "schedule": "0 */4 * * *", "display": "Every 4 hours",
     "runs_per_day": 6.0, "failure_rate": 0.08},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Cost Monitor", "mode": "agent",
     "schedule": "0 23 * * *", "display": "Daily at 11pm",
     "runs_per_day": 1.0, "failure_rate": 0.0},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Model Benchmark", "mode": "agent",
     "schedule": "0 2 * * 0", "display": "Sundays at 2am",
     "runs_per_day": 0.14, "failure_rate": 0.15},
    {"id": "_demo_" + "".join(random.choices(string.hexdigits.lower(), k=10)),
     "name": "Documentation Sync", "mode": "no_agent",
     "schedule": "0 */6 * * *", "display": "Every 6 hours",
     "runs_per_day": 4.0, "failure_rate": 0.03},
]

DAYS = 30
END = datetime.now()
START = END - timedelta(days=DAYS)

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA = """
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
    job_mode TEXT DEFAULT 'agent',
    ingested_at REAL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id   ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_run_time ON cron_runs(run_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_mode ON cron_runs(job_mode);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ingested ON cron_runs(ingested_at);
"""

# ---------------------------------------------------------------------------
# Generate
# ---------------------------------------------------------------------------
DB_PATH.unlink(missing_ok=True)
conn = sqlite3.connect(DB_PATH)
conn.executescript(SCHEMA)

cur = conn.cursor()
rows = []

for job in JOBS:
    run_idx = 0
    step_hours = 1 if job["runs_per_day"] >= 4 else 4
    current = START
    while current < END:
        prob = job["runs_per_day"] * (step_hours / 24)
        attempts = max(1, int(prob))
        for _ in range(attempts):
            if random.random() < min(prob / attempts, 1.0):
                run_idx += 1
                ts = current.timestamp() + random.uniform(0, step_hours * 3600)
                model, in_price, out_price = random.choice(MODELS)
                
                # Token counts — scaled for realistic demo costs ($0.10–$5.00 per run)
                if "Benchmark" in job["name"]:
                    base_in = random.randint(200_000, 2_000_000)
                    base_out = random.randint(50_000, 500_000)
                elif "Report" in job["name"]:
                    base_in = random.randint(100_000, 800_000)
                    base_out = random.randint(20_000, 200_000)
                elif "Security" in job["name"]:
                    base_in = random.randint(50_000, 400_000)
                    base_out = random.randint(10_000, 80_000)
                elif "Log" in job["name"]:
                    base_in = random.randint(30_000, 200_000)
                    base_out = random.randint(5_000, 40_000)
                elif "Backup" in job["name"] or "Sync" in job["name"]:
                    base_in = random.randint(2_000, 20_000)
                    base_out = random.randint(500, 5_000)
                else:
                    base_in = random.randint(20_000, 150_000)
                    base_out = random.randint(3_000, 30_000)
                
                cache_read = random.randint(0, base_in * 3)
                cache_write = random.randint(0, base_in // 4)
                
                # Prices are per 1K tokens → divide by 1_000
                cost = (base_in * in_price / 1_000 +
                        base_out * out_price / 1_000 +
                        cache_read * in_price * 0.25 / 1_000)
                
                success = random.random() > job["failure_rate"]
                duration = random.uniform(15, 1200)
                if not success:
                    duration *= random.uniform(0.3, 0.8)
                
                rows.append({
                    "session_id": f"cron_{job['id']}_{datetime.fromtimestamp(ts).strftime('%Y%m%d_%H%M%S')}_{run_idx:03d}",
                    "job_id": job["id"],
                    "run_time": ts,
                    "ended_at": ts + duration,
                    "duration_seconds": duration,
                    "model": model,
                    "input_tokens": base_in,
                    "output_tokens": base_out,
                    "reasoning_tokens": random.randint(0, base_out // 3) if "claude" in model else 0,
                    "cache_read_tokens": cache_read,
                    "cache_write_tokens": cache_write,
                    "estimated_cost_usd": round(cost, 6),
                    "actual_cost_usd": round(cost * random.uniform(0.95, 1.05), 6) if random.random() < 0.3 else None,
                    "cost_status": "estimated" if random.random() > 0.3 else "actual",
                    "cost_source": "openrouter" if random.random() > 0.5 else "local",
                    "billing_provider": "openrouter",
                    "api_call_count": random.randint(3, 40),
                    "message_count": random.randint(2, 20),
                    "tool_call_count": random.randint(0, 15),
                    "end_reason": "cron_complete" if success else random.choice(["timeout", "error", "killed"]),
                    "success": 1 if success else 0,
                    "job_mode": job["mode"],
                    "ingested_at": ts + duration + random.uniform(1, 60),
                })
        current += timedelta(hours=step_hours)

rows.sort(key=lambda r: r["run_time"])
for r in rows:
    cur.execute("""
        INSERT INTO cron_runs VALUES (
            :session_id, :job_id, :run_time, :ended_at, :duration_seconds,
            :model, :input_tokens, :output_tokens, :reasoning_tokens,
            :cache_read_tokens, :cache_write_tokens, :estimated_cost_usd,
            :actual_cost_usd, :cost_status, :cost_source, :billing_provider,
            :api_call_count, :message_count, :tool_call_count, :end_reason,
            :success, :job_mode, :ingested_at
        )
    """, r)

conn.commit()

# Summary stats
min_ts = min(r["run_time"] for r in rows)
max_ts = max(r["run_time"] for r in rows)
print(f"Generated {len(rows)} runs across {len(JOBS)} jobs")
print(f"Date range: {datetime.fromtimestamp(min_ts).strftime('%Y-%m-%d')} to {datetime.fromtimestamp(max_ts).strftime('%Y-%m-%d')}")

total_cost = sum(r["estimated_cost_usd"] for r in rows)
total_success = sum(1 for r in rows if r["success"])
print(f"Total cost: ${total_cost:.2f}")
print(f"Success rate: {total_success / len(rows) * 100:.1f}%")

for job in JOBS:
    job_rows = [r for r in rows if r["job_id"] == job["id"]]
    job_cost = sum(r["estimated_cost_usd"] for r in job_rows)
    print(f"  {job['name']}: {len(job_rows)} runs, ${job_cost:.2f}, mode={job['mode']}")

# Write jobs.json
jobs_json = {
    "jobs": [
        {
            "id": j["id"],
            "name": j["name"],
            "schedule": {"kind": "cron", "expr": j["schedule"], "display": j["display"]},
        }
        for j in JOBS
    ]
}
JOBS_PATH.write_text(json.dumps(jobs_json, indent=2))
print(f"Wrote {JOBS_PATH}")
print(f"Wrote {DB_PATH}")
