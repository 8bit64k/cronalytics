"""Cron Insights — dashboard API router (Phase 3).

Mounted by the dashboard server at /api/plugins/cron-insights/.
All endpoints serve JSON for the frontend slot components.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Any

from .. import facts, scanner
from ..config import FACT_DB, STATE_DB, WATERMARK_FILE

router = APIRouter()


def _api_wrap(data: dict[str, Any]) -> dict[str, Any]:
    """Wrap response with plugin name for client sanity."""
    return {"plugin": "cron-insights", **data}


@router.get("/health")
async def health() -> dict[str, Any]:
    """Plugin status, fact DB health, and last sync watermark."""
    db_health = facts.query_health(FACT_DB)
    sync_status = scanner.get_status(WATERMARK_FILE)
    return _api_wrap(
        {
            "status": "ok",
            "fact_db": db_health,
            "sync": sync_status,
            "version": "0.1.0",
        }
    )


@router.get("/summary")
async def summary(
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Aggregated stats for cron runs over the last N days."""
    return _api_wrap(facts.query_summary(FACT_DB, days=days))


@router.get("/jobs")
async def jobs(
    days: int = Query(default=7, ge=1, le=90),
) -> dict[str, Any]:
    """Per-job aggregates: runs, total cost, avg cost, last run."""
    return _api_wrap(
        {
            "days": days,
            "jobs": facts.query_jobs(FACT_DB, days=days),
        }
    )


@router.get("/jobs/{job_id}/runs")
async def job_runs(
    job_id: str,
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """Individual run history for a specific job."""
    rows = facts.query_job_runs(FACT_DB, job_id=job_id, limit=limit)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No runs found for job {job_id}")
    return _api_wrap(
        {
            "job_id": job_id,
            "limit": limit,
            "runs": rows,
        }
    )


@router.post("/sync")
async def sync() -> dict[str, Any]:
    """Trigger reconciliation scanner on demand."""
    result = scanner.run_sync(
        state_db=STATE_DB,
        fact_db=FACT_DB,
        watermark_path=WATERMARK_FILE,
    )
    return _api_wrap(
        {
            "triggered": True,
            **result,
        }
    )
