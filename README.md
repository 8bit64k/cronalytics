# Cronalytics

**Cost and operational observability for Hermes cron jobs.**

Cronalytics is a dashboard plugin that attributes session-level usage and estimated cost to every cron-originated run, so you can see what your scheduled jobs are actually costing you. It hooks into `on_session_end`, stores derived analytics in a local SQLite fact database, and surfaces them in the Hermes dashboard via a dedicated `/cronalytics` tab and a header-right badge.

> Turn hidden automation into visible spend.

---

## What It Does

- **Captures** every cron job run as it completes via the `on_session_end` hook
- **Persists** cost, token counts, model, duration, and success state to a local fact database
- **Backfills** historical data automatically on plugin load and on demand
- **Surfaces** a dashboard with:
  - Summary cards (total runs, estimated cost, tokens, trend arrows)
  - Cost-by-model breakdown
  - Per-job table with runs, total cost, average cost, last run, and model
  - A **Sync Now** button to trigger backfill on demand
  - A header-right health badge that polls run count every 30s

---

## Installation

1. Copy the plugin into your Hermes plugins directory:

```bash
mkdir -p ~/.hermes/plugins
cp -r /path/to/cronalytics ~/.hermes/plugins/cronalytics
```

2. Restart the Hermes dashboard server so the plugin API routes are mounted and the frontend bundle is picked up:

```bash
hermes dashboard
```

3. Hard-refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear any cached JS bundle.

4. Open the **Cronalytics** tab in the dashboard sidebar, or look for the cron run count badge in the header-right area.

---

## Configuration

### `plugin.yaml`

The plugin manifest registers the hook it needs:

```yaml
name: cronalytics
version: 0.1.0
description: Cost and operational observability for Hermes cron jobs
provides_hooks:
  - on_session_end
```

### `config.py` (static defaults)

All current settings are hardcoded defaults in `config.py`. There is no user-editable config file yet (planned for v0.2).

| Setting | Default | Meaning |
|---------|---------|---------|
| `RETRY_DELAYS` | `[3.0, 8.0, 15.0]` | Seconds to wait before each retry when fetching session data |
| `JITTER_MAX` | `2.0` | Max random seconds added to each retry delay |
| `MAX_RETRIES` | `3` | Total attempts to read a session from `state.db` |

Paths are resolved automatically:
- `STATE_DB`: `~/.hermes/state.db` (Hermes core session store — source of truth)
- `FACT_DB`: `~/.hermes/plugins/cronalytics/facts.db` (plugin-owned SQLite)
- `WATERMARK_FILE`: `~/.hermes/plugins/cronalytics/watermark.json`
- `PENDING_FILE`: `~/.hermes/plugins/cronalytics/pending.jsonl`

---

## What the Dashboard Shows

### Summary Cards (`/cronalytics` tab)

- **Total Runs** — number of cron job executions in the selected period
- **Est. Cost** — sum of `estimated_cost_usd` with an up/down/neutral trend arrow comparing to the previous period
- **Tokens** — input and output token totals

### Cost by Model

A list breaking down estimated cost per model for the selected period.

### Jobs Table

A per-job breakdown showing:

- **Name** — resolved from `~/.hermes/cron/jobs.json` when available; falls back to truncated job ID
- **Runs** — execution count
- **Total Cost** — aggregated estimated cost for that job
- **Avg Cost** — average cost per run
- **Last Run** — timestamp of the most recent execution
- **Model** — the model used

### Sync Now Button

Clicking **Sync Now** triggers a reconciliation scan against `state.db` and backfills any cron sessions newer than the last watermark. The button displays the last sync timestamp and elapsed time after completion.

If the fact database is empty, the UI shows guidance to click **Sync Now** to populate data.

### Header-Right Badge

A small badge in the dashboard header polls `/api/plugins/cronalytics/health` every 30 seconds and displays the total number of captured cron runs.

---

## How to Trigger Sync

### Automatic sync
- **On plugin load**: a bootstrap scanner thread runs automatically when the gateway loads the plugin, backfilling any sessions that completed while the gateway was down or the plugin was disabled.

### Manual sync
- **Dashboard UI**: click the **Sync Now** button in the `/cronalytics` tab.
- **API**: `POST /api/plugins/cronalytics/sync`

```bash
curl -X POST http://localhost:9119/api/plugins/cronalytics/sync
```

Response:
```json
{
  "plugin": "cronalytics",
  "inserted": 12,
  "skipped": 3,
  "elapsed_ms": 420,
  "new_watermark": 1714523734.0
}
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plugins/cronalytics/health` | `GET` | Plugin health + sync metadata |
| `/api/plugins/cronalytics/summary?days=N` | `GET` | Aggregated totals for N days (1–90) |
| `/api/plugins/cronalytics/jobs?days=N` | `GET` | Per-job rolled-up stats |
| `/api/plugins/cronalytics/jobs/{job_id}/runs` | `GET` | Individual runs for a specific job |
| `/api/plugins/cronalytics/models?days=N` | `GET` | Cost breakdown by model |
| `/api/plugins/cronalytics/trends?days=N` | `GET` | Period-over-period trends |
| `/api/plugins/cronalytics/sync` | `POST` | Run reconciliation scanner manually |

---

## Data Model

The fact database (`facts.db`) is append-only. Rows are inserted once and never updated or deleted. If `state.db` purges old sessions, the fact DB retains the snapshot.

Key fields captured per run:

- `session_id` — unique run key (`cron_{job_id}_{YYYYMMDD}_{HHMMSS}`)
- `job_id` — stable job definition ID
- `run_time` / `ended_at` / `duration_seconds`
- `model`
- `input_tokens` / `output_tokens` / `reasoning_tokens` / `cache_read_tokens` / `cache_write_tokens`
- `estimated_cost_usd` — primary cost metric
- `actual_cost_usd` — ground-truth when available (often `NULL`)
- `cost_status`, `cost_source`, `billing_provider`
- `api_call_count`, `message_count`, `tool_call_count`
- `end_reason`, `success`
- `ingested_at`

---

## Architecture at a Glance

```
Cron Job Due
    │
    ▼
run_job() ──▶ agent.run_conversation()
    │
    ▼
Hook: on_session_end(platform="cron")
    │
    ▼
Enqueue session_id ──▶ Deferred worker retries
    │                         (waits for DB flush)
    ▼
Query state.db ──▶ Insert into facts.db
    │
    ▼
Dashboard queries fact.db via plugin API
```

---

## Known Limitations

- **Tests have known relative-import issues.** The test files (if present) and `scanner.py` use package-relative imports (`from . import facts`) that fail when modules are loaded outside the gateway package context or run directly. Running tests from the repo root may require PYTHONPATH adjustments or converting imports to absolute form.
- **No user-editable config file yet.** All tuning values are hardcoded in `config.py`; customization requires editing source (v0.2 planned).
- **Table is not sortable.** Columns in the jobs table are display-only; sorting and row expansion are backlog items.
- **Mobile layout unverified.** The dashboard UI has not been validated on narrow viewports.
- **Schema resilience partial.** If `state.db` columns are added or removed in future Hermes versions, some queries may need updates.
- **Actual cost is often null.** Most runs only populate `estimated_cost_usd`; `actual_cost_usd` depends on provider billing data availability.
- **Plugin directory is a static copy.** Changes in the build directory are not automatically reflected in `~/.hermes/plugins/cronalytics/` unless manually copied or symlinked.
- **Dashboard server caches plugins per-process.** Changes to `manifest.json` or `plugin_api.py` require a full dashboard restart.

---

## Documentation Index

- **BRIEF.md** — Product opportunity brief & positioning
- **DESIGN.md** — Architecture, data flow, and technical decisions
- **PLAN.md** — Phased build plan and backlog
- **FEATURES.md** — Feature checklist & scope
- **AGENT.md** — Conventions for contributors
- **CHECKPOINT.md** — Session-level dev checkpoint notes

---

## Requirements

- Hermes with plugin hook support (`on_session_end`)
- Hermes dashboard server (FastAPI + React) for the UI components
- SQLite (bundled with Python) — no external database required

---

## Changelog

### v0.1.0
- Initial release: real-time ingestion, fact DB, reconciliation scanner, dashboard API, React frontend with summary cards, jobs table, cost-by-model, sync button, and header-right badge.

---

*Plugin path: `~/.hermes/plugins/cronalytics/`*  
*Fact DB: `~/.hermes/plugins/cronalytics/facts.db`*  
*API base: `/api/plugins/cronalytics/`*
