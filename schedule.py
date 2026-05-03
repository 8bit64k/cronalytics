"""Schedule parsing and cost projection for Cronalytics.

Pure utility — accepts a jobs.json path and per-job facts, returns
projection objects. No DB access, no side effects.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

try:
    import croniter
except Exception:  # pragma: no cover
    croniter = None  # type: ignore


# ---------------------------------------------------------------------------
# Jobs.json helpers
# ---------------------------------------------------------------------------

def _load_job_defs(jobs_json_path: Path) -> dict[str, dict[str, Any]]:
    """Return {job_id: job_def} from jobs.json."""
    try:
        data = json.loads(jobs_json_path.read_text())
    except Exception:
        return {}
    return {j["id"]: j for j in data.get("jobs", [])}


# ---------------------------------------------------------------------------
# Occurrence counting
# ---------------------------------------------------------------------------

def _count_occurrences(
    kind: str,
    expr: str | None,
    minutes: int | None,
    from_dt: datetime,
    to_dt: datetime,
) -> int:
    """Count scheduled run occurrences in a half-open interval [from_dt, to_dt]."""
    if kind == "cron" and expr and croniter is not None:
        try:
            itr = croniter.croniter(expr, from_dt)
            count = 0
            while True:
                nxt = itr.get_next(datetime)
                if nxt > to_dt:
                    break
                if count > 99999:  # safety valve
                    break
                count += 1
            return count
        except Exception:
            pass
    elif kind == "interval" and minutes:
        interval = timedelta(minutes=minutes)
        if interval.total_seconds() <= 0:
            return 0
        delta = to_dt - from_dt
        return max(0, int(delta.total_seconds() / interval.total_seconds()))
    return 0


# ---------------------------------------------------------------------------
# Per-job projections
# ---------------------------------------------------------------------------

def get_job_projections(
    job_id: str,
    avg_cost: float | None,
    total_cost: float | None,
    runs: int,
    first_run: float,
    last_run: float,
    days_filter: int,
    *,
    jobs_json_path: Path,
) -> dict[str, Any]:
    """Return schedule metadata + cost projections for one job.

    Args:
        job_id: Stable job ID (matches jobs.json `id`).
        avg_cost: Average cost per run from fact DB.
        total_cost: Total cost for the window (for trend pacing).
        runs: Number of runs in the observation window.
        first_run: Earliest run_time (unix epoch).
        last_run: Latest run_time (unix epoch).
        days_filter: The `days` query param (0 = all time).
        jobs_json_path: Path to Hermes cron jobs.json.

    Returns:
        Dict with schedule_display, next_run_at, scheduled_runs_{30d,90d,1yr},
        projected_cost_{30d,90d,1yr} (nominal schedule-based),
        trend_projected_cost_{30d,90d,1yr},
        drift_ratio, window_days used for trend calc.
    """
    defs = _load_job_defs(jobs_json_path)
    job_def = defs.get(job_id)

    schedule_display: str | None = None
    next_run_at: str | None = None
    kind: str | None = None
    expr: str | None = None
    minutes: int | None = None

    if job_def:
        sched = job_def.get("schedule", {})
        kind = sched.get("kind")
        expr = sched.get("expr")
        minutes = sched.get("minutes")
        schedule_display = sched.get("display") or job_def.get("schedule_display")
        next_run_at = job_def.get("next_run_at")

    now = datetime.now()
    horizon_days = [30, 90, 365]
    scheduled_runs: dict[str, int | None] = {}
    nominal_proj: dict[str, float | None] = {}

    if kind:
        for d in horizon_days:
            sr = _count_occurrences(kind, expr, minutes, now, now + timedelta(days=d))
            scheduled_runs[f"{d}d"] = sr
            ac = avg_cost if avg_cost is not None else 0.0
            nominal_proj[f"{d}d"] = round(ac * sr, 4) if sr is not None else None
    else:
        for d in horizon_days:
            scheduled_runs[f"{d}d"] = None
            nominal_proj[f"{d}d"] = None

    # ---- Trend-based projection ------------------------------------------
    # Determine an honest observation window in days
    if days_filter > 0:
        observed_window = float(days_filter)
    elif first_run and last_run and last_run > first_run:
        observed_window = (last_run - first_run) / 86400.0
    else:
        observed_window = 0.0

    trend_proj: dict[str, float | None] = {}
    if observed_window > 0 and runs > 0 and total_cost is not None:
        daily_cost = total_cost / observed_window
        for d in horizon_days:
            trend_proj[f"{d}d"] = round(daily_cost * d, 4)
    else:
        for d in horizon_days:
            trend_proj[f"{d}d"] = None

    # ---- Drift ratio ------------------------------------------------------
    drift_ratio: float | None = None
    if observed_window > 0 and kind:
        scheduled_in_window = _count_occurrences(
            kind, expr, minutes,
            now - timedelta(days=observed_window), now
        )
        if scheduled_in_window and scheduled_in_window > 0:
            drift_ratio = round(runs / scheduled_in_window, 2)

    return {
        "schedule_display": schedule_display,
        "next_run_at": next_run_at,
        "scheduled_runs_30d": scheduled_runs.get("30d"),
        "scheduled_runs_90d": scheduled_runs.get("90d"),
        "scheduled_runs_1yr": scheduled_runs.get("365d"),
        "projected_cost_30d": nominal_proj.get("30d"),
        "projected_cost_90d": nominal_proj.get("90d"),
        "projected_cost_1yr": nominal_proj.get("365d"),
        "trend_projected_cost_30d": trend_proj.get("30d"),
        "trend_projected_cost_90d": trend_proj.get("90d"),
        "trend_projected_cost_1yr": trend_proj.get("365d"),
        "drift_ratio": drift_ratio,
        "observed_window_days": round(observed_window, 1) if observed_window > 0 else None,
    }
