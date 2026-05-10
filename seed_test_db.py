#!/usr/bin/env python3
r"""Generate a synthetic fact.test.db using Nick's REAL cron job IDs.

Usage:
    python3 seed_test_db.py          # 120 days, 10% failure rate
    python3 seed_test_db.py --days 30  # override window
"""
import argparse
import json
import os
import pwd
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

random.seed(2026)  # deterministic for reproducible visual testing

CONFIG_DIR = Path(pwd.getpwuid(os.getuid()).pw_dir) / ".hermes" / "cron"
JOBS_PATH = CONFIG_DIR / "jobs.json"
PLUGIN_DIR = Path(__file__).parent

# ── Load REAL job IDs + schedules from jobs.json ────────────────────────────
def _load_real_jobs():
    try:
        jobs = json.loads(JOBS_PATH.read_text()).get("jobs", [])
    except Exception:
        raise SystemExit(f"Cannot read {JOBS_PATH} — run in a real Hermes environment")

    result = []
    for j in jobs:
        jid = j.get("id")
        name = j.get("name", "Unknown")
        sched = j.get("schedule_display", j.get("schedule", {}).get("display", "?"))
        no_agent = j.get("no_agent", False)
        result.append((jid, name, str(sched), no_agent))
    return result

# ── Model / cost mapping (medium-to-high tier, 10% fail rate) ───────────────
_MODELS = {
    "gpt-4o":           {"provider": "openai",     "input": 2.50,  "output": 10.00},
    "claude-sonnet-4":  {"provider": "anthropic",  "input": 3.00,  "output": 15.00},
    "o3-mini":          {"provider": "openai",     "input": 1.10,  "output": 4.40},
}

# job_id → (model_or_none, avg_cost, avg_dur_sec, failure_rate)
# None → no_agent (zero cost).  All others default ~10% failure.
# Costs and durations tuned per job name / schedule frequency.
_PROFILES = {
    "841aee933270": (None,              0.00,  30,  0.10),  # backup — no_agent
    "8ce310056bdb": ("claude-sonnet-4", 0.035, 180, 0.10),  # tui skill check (weekly, reasoning-heavy)
    "67541bf6e230": ("gpt-4o",          0.075, 90,  0.10),  # daily journal (medium-long)
    "eb1d4a33d30a": ("claude-sonnet-4", 0.095, 120, 0.10),  # security briefing (analysis-heavy)
    "74a667c54db4": ("gpt-4o",          0.110, 150, 0.10),  # AI digest (biggest daily)
    "d42a624c85b9": ("o3-mini",         0.008, 25,  0.10),  # gateway check (frequent, short, reasoning)
    "abcab3ad4d10": ("o3-mini",         0.005, 20,  0.10),  # disk watchdog (weekly)
    "d2d2a63f9111": ("o3-mini",         0.004, 15,  0.10),  # dashboard watchdog
    "e15e1a865aa5": ("o3-mini",         0.004, 15,  0.10),  # gateway watchdog
    "306054cd4fc3": ("o3-mini",         0.004, 15,  0.10),  # RAM watchdog
}

def _job_schedule_to_interval(schedule_str: str):
    """Very rough parser for the handful of schedules Nick uses."""
    s = schedule_str.strip()
    # Interval schedules: "every 360m" or "every 10080m"
    if s.lower().startswith("every "):
        parts = s.lower().replace("every", "").strip().split()
        if parts:
            num = int(parts[0].replace("m", ""))
            return timedelta(minutes=num)
        return timedelta(hours=1)
    # Cron expressions — 5 fields
    parts = s.split()
    if len(parts) != 5:
        return timedelta(days=1)  # fallback
    minute, hour, dom, month, dow = parts
    # Minute interval: "*/N"
    if minute.startswith("*/"):
        n = int(minute[2:])
        return timedelta(minutes=n)
    # Hour interval: "0 */N * * *"
    if minute == "0" and hour.startswith("*/"):
        n = int(hour[2:])
        return timedelta(hours=n)
    # Every N hours: "0 N/N * * *"  (e.g. "0 */4 * * *")
    if hour.startswith("*/"):
        n = int(hour[2:])
        return timedelta(hours=n)
    # Weekly: specific day of week (not *) and minute=0 hour=fixed
    if minute == "0" and dow != "*" and month == "*":
        return timedelta(weeks=1)
    # Monthly: specific day of month (not *)
    if minute == "0" and dom != "*" and month == "*" and dow == "*":
        return timedelta(days=30)
    # Daily: default for "0 H * * *"
    if minute == "0" and hour != "*":
        return timedelta(days=1)
    # Fallback: every hour
    return timedelta(hours=1)


def _generate_run(jid, name, schedule_str, no_agent, dt: datetime) -> dict:
    model, avg_cost, avg_dur, fail_rate = _PROFILES.get(jid, ("gpt-4o", 0.050, 60, 0.10))
    if no_agent:
        model = None
    is_no_agent = model is None

    dur = avg_dur * random.uniform(0.7, 1.3)
    success = random.random() > fail_rate
    end_reason = "cron_complete" if success else ("cron_error" if random.random() > 0.3 else "timeout")

    if is_no_agent:
        input_tok = output_tok = cache_tok = 0
        cost_usd = 0.0
        provider = None
    else:
        m = _MODELS.get(model, _MODELS["gpt-4o"])
        cost_per_1k = (m["input"] * 0.6 + m["output"] * 0.4) / 1000
        target_cost = avg_cost * random.uniform(0.5, 1.5)
        total_tok = int(target_cost / cost_per_1k * 1000)
        input_tok = int(total_tok * 0.65)
        output_tok = int(total_tok * 0.30)
        cache_tok = int(total_tok * 0.05)
        cost_usd = round((input_tok * m["input"] + output_tok * m["output"]) / 1_000_000, 6)
        provider = m["provider"]

    return {
        "session_id": f"sess_{jid}_{int(dt.timestamp() * 1000)}",
        "job_id": jid,
        "run_time": dt.timestamp(),
        "ended_at": (dt + timedelta(seconds=dur)).timestamp(),
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
        "billing_provider": provider,
        "api_call_count": random.randint(1, 8) if not is_no_agent else 0,
        "message_count": random.randint(2, 20) if not is_no_agent else 0,
        "tool_call_count": random.randint(0, 4) if not is_no_agent else 0,
        "end_reason": end_reason,
        "success": 1 if success else 0,
        "job_mode": "no_agent" if is_no_agent else "agent",
    }


def seed(days: int = 120) -> Path:
    real_jobs = _load_real_jobs()
    db_path = PLUGIN_DIR / "fact.test.db"
    if db_path.exists():
        db_path.unlink()
        for wal in (db_path.with_suffix(".db-shm"), db_path.with_suffix(".db-wal")):
            wal.unlink(missing_ok=True)

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
    conn.execute("CREATE INDEX idx_cron_runs_job_id   ON cron_runs(job_id)")
    conn.execute("CREATE INDEX idx_cron_runs_run_time ON cron_runs(run_time DESC)")
    conn.execute("CREATE INDEX idx_cron_runs_job_mode ON cron_runs(job_mode)")

    now = datetime.now()
    start = now - timedelta(days=days)
    total = 0

    for jid, name, sched, no_agent in real_jobs:
        interval = _job_schedule_to_interval(sched)
        t = start
        while t < now:
            t_run = t + timedelta(seconds=random.randint(0, int(interval.total_seconds() * 0.05)))
            if t_run > now:
                break
            row = _generate_run(jid, name, sched, no_agent, t_run)
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

    # Quick summary
    conn = sqlite3.connect(str(db_path))
    agent_runs = conn.execute("SELECT COUNT(*) FROM cron_runs WHERE job_mode='agent'").fetchone()[0]
    script_runs = conn.execute("SELECT COUNT(*) FROM cron_runs WHERE job_mode='no_agent'").fetchone()[0]
    total_cost = conn.execute("SELECT COALESCE(SUM(estimated_cost_usd),0) FROM cron_runs").fetchone()[0]
    conn.close()

    print(f"Seeded {db_path.name}: {total} runs ({agent_runs} agent, {script_runs} script)")
    print(f"  Total cost: ${total_cost:.4f}  |  Window: last {days} days  |  Jobs: {len(real_jobs)}")
    return db_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=120, help="Days of history (default 120)")
    args = parser.parse_args()
    seed(args.days)
