"""Cron Insights — dashboard API router (Phase 3 + Phase 2.5).

Mounted by the dashboard server at /api/plugins/cron-insights/.
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
    mod_name = f"croninsights_auto_{name}"
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
        data = json.loads(_JOBS_PATH.read_text())
    except Exception:
        return {}
    return {j["id"]: j.get("name", j["id"]) for j in data.get("jobs", [])}


def _enrich_jobs_with_names(job_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach human-readable name to each job aggregate."""
    names = _load_job_names()
    for j in job_list:
        job_id = j.get("job_id", "")
        j["name"] = names.get(job_id, job_id)
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
    return {"plugin": "cron-insights", **data}


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
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Aggregated stats for cron runs over the last N days."""
    return _api_wrap(_facts_mod.query_summary(FACT_DB, days=days))


@router.get("/jobs")
async def jobs(
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Per-job aggregates: runs, total cost, avg cost, last run."""
    raw_jobs = _facts_mod.query_jobs(FACT_DB, days=days)
    enriched = _enrich_jobs_with_names(raw_jobs)
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
) -> dict[str, Any]:
    """Individual run history for a specific job."""
    rows = _facts_mod.query_job_runs(FACT_DB, job_id=job_id, limit=limit)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No runs found for job {job_id}")
    return _api_wrap(
        {
            "job_id": job_id,
            "limit": limit,
            "runs": rows,
        }
    )


@router.get("/models")
async def models(
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Per-model usage aggregates."""
    return _api_wrap(
        {
            "days": days,
            "models": _facts_mod.query_models(FACT_DB, days=days),
        }
    )


@router.get("/trends")
async def trends(
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Daily cost trend."""
    return _api_wrap(
        {
            "days": days,
            "trend": _facts_mod.query_trends(FACT_DB, days=days),
        }
    )
