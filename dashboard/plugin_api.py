"""Cronalytics — dashboard API router (Phase 3 + Phase 2.5).

Mounted by the dashboard server at /api/plugins/cronalytics/.
All endpoints serve JSON for the frontend slot components.

NOTE: This module is loaded via importlib as a standalone module, so
       relative imports (from .. import X) will not work. We dynamically
       load sibling modules from the plugin directory to avoid that.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

# ---------------------------------------------------------------------------
# Load sibling plugin modules via importlib (no package context)
# ---------------------------------------------------------------------------

_plugin_api_dir = Path(__file__).resolve().parent
_plugin_dir = _plugin_api_dir.parent


def _load_module(name: str):
    """Load a .py file from the plugin root as a namespaced module."""
    mod_name = f"cronalytics_auto_{name}"
    path = _plugin_dir / f"{name}.py"
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


_facts_mod = _load_module("facts")
_config_mod = _load_module("config")
_scanner_mod = _load_module("scanner")
_schedule_mod = _load_module("schedule")

FACT_DB = _config_mod.FACT_DB
STATE_DB = _config_mod.STATE_DB
WATERMARK_FILE = _config_mod.WATERMARK_FILE
HERMES_HOME = _config_mod.HERMES_HOME

# ---------------------------------------------------------------------------
# Job name resolution (Phase 2.5)
# ---------------------------------------------------------------------------

_JOBS_PATH = HERMES_HOME / "cron" / "jobs.json"


def _load_job_names() -> dict[str, str]:
    """Read ~/.hermes/cron/jobs.json and build {job_id: name} mapping."""
    try:
        raw = _JOBS_PATH.read_text()
        data = json.loads(raw)
    except Exception:
        return {}
    return {
        j["id"]: {
            "name": j.get("name", j["id"]),
            "schedule": j.get("schedule"),
        }
        for j in data.get("jobs", [])
    }


def _enrich_jobs_with_names(job_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach human-readable name + schedule metadata to each job aggregate."""
    meta = _load_job_names()
    for j in job_list:
        job_id = j.get("job_id", "")
        info = meta.get(job_id, {})
        j["name"] = info.get("name", job_id)
        j["schedule"] = info.get("schedule")
        # next_run is ephemeral — not in jobs.json
        # model comes from last_model in the aggregate itself
    return job_list


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_status() -> dict[str, Any]:
    """Delegate to scanner.get_status() for canonical health values."""
    try:
        return _scanner_mod.get_status(WATERMARK_FILE)
    except Exception:
        return {
            "last_ended_at": None,
            "last_sync": None,
            "rows_synced": 0,
        }


def _api_wrap(data: dict[str, Any]) -> dict[str, Any]:
    """Wrap response with plugin name for client sanity."""
    return {"plugin": "cronalytics", **data}


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, Any]:
    """Plugin status, fact DB health, and last sync watermark."""
    db_health = _facts_mod.query_health(FACT_DB)
    sync_status = _get_status()
    return _api_wrap(
        {
            "status": "ok",
            "fact_db": db_health,
            "sync": sync_status,
            "version": "0.1.0",
        }
    )


@router.post("/sync")
async def sync() -> dict[str, Any]:
    """Trigger a manual reconciliation pass and return summary."""
    result = _scanner_mod.run_sync(STATE_DB, FACT_DB, WATERMARK_FILE)
    return _api_wrap(
        {
            "synced": True,
            "result": result,
        }
    )


@router.get("/summary")
async def summary(
    days: int = Query(default=30, ge=0),
    outcome: str = Query(default="both", pattern="^(both|success|failure)$"),
) -> dict[str, Any]:
    """Aggregated stats for cron runs over the last N days (0 = all time).

    Includes schedule-aware projections: nominal (if running exactly on schedule),
    trend (if current pace continues), and pace (the ratio of the two).
    """
    raw_summary = _facts_mod.query_summary(FACT_DB, days=days, outcome=outcome)
    raw_jobs = _facts_mod.query_jobs(FACT_DB, days=days, outcome=outcome)

    nominal_total = 0.0
    trend_total = 0.0
    for j in raw_jobs:
        proj = _schedule_mod.get_job_projections(
            job_id=j["job_id"],
            avg_cost=j.get("avg_cost"),
            total_cost=j.get("total_cost"),
            runs=j.get("runs", 0),
            first_run=j.get("first_run", 0),
            last_run=j.get("last_run", 0),
            days_filter=days,
            jobs_json_path=_JOBS_PATH,
        )
        j["projections"] = proj
        if proj["projected_cost_30d"] is not None:
            nominal_total += proj["projected_cost_30d"]
        if proj["trend_projected_cost_30d"] is not None:
            trend_total += proj["trend_projected_cost_30d"]

    pace = None
    if nominal_total > 0:
        pace = round(trend_total / nominal_total, 2)

    return _api_wrap(
        {
            **raw_summary,
            "nominal_monthly_total": round(nominal_total, 4) if nominal_total else None,
            "trend_monthly_total": round(trend_total, 4) if trend_total else None,
            "pace": pace,
        }
    )


@router.get("/jobs")
async def jobs(
    days: int = Query(default=30, ge=0),
    skip_projections: bool = Query(default=False, description="Set true to omit schedule-aware projections (faster)"),
    outcome: str = Query(default="both", pattern="^(both|success|failure)$"),
) -> dict[str, Any]:
    """Per-job aggregates: runs, total cost, avg cost, projections (0 = all time)."""
    raw_jobs = _facts_mod.query_jobs(FACT_DB, days=days, outcome=outcome)
    enriched = _enrich_jobs_with_names(raw_jobs)

    if not skip_projections:
        for j in enriched:
            proj = _schedule_mod.get_job_projections(
                job_id=j["job_id"],
                avg_cost=j.get("avg_cost"),
                total_cost=j.get("total_cost"),
                runs=j.get("runs", 0),
                first_run=j.get("first_run", 0),
                last_run=j.get("last_run", 0),
                days_filter=days,
                jobs_json_path=_JOBS_PATH,
            )
            j["projections"] = proj

    return _api_wrap(
        {
            "days": days,
            "jobs": enriched,
        }
    )


@router.get("/jobs/{job_id}/runs")
async def job_runs(
    job_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    days: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """Individual run history for a specific job (0 = all time)."""
    rows = _facts_mod.query_job_runs(FACT_DB, job_id=job_id, limit=limit, days=days)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No runs found for job {job_id}")
    return _api_wrap(
        {
            "job_id": job_id,
            "limit": limit,
            "days": days,
            "runs": rows,
        }
    )


@router.get("/models")
async def models(
    days: int = Query(default=30, ge=0),
    outcome: str = Query(default="both", pattern="^(both|success|failure)$"),
) -> dict[str, Any]:
    """Per-model usage aggregates (0 = all time)."""
    return _api_wrap(
        {
            "days": days,
            "outcome": outcome,
            "models": _facts_mod.query_models(FACT_DB, days=days, outcome=outcome),
        }
    )


@router.get("/trends")
async def trends(
    days: int = Query(default=30, ge=0),
    outcome: str = Query(default="both", pattern="^(both|success|failure)$"),
) -> dict[str, Any]:
    """Daily cost trend (0 = all time)."""
    return _api_wrap(
        {
            "days": days,
            "outcome": outcome,
            "trend": _facts_mod.query_trends(FACT_DB, days=days, outcome=outcome),
        }
    )
