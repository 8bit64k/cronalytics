# Cronalytics


/ˈkrɒn.əˌlɪt.ɪks/ (noun)

1. Cron analytics and observability.
2. The dashboard for agentic automations in Hermes.

Observe. Measure. Optimize.


Cronalytics is a Hermes Agent plugin that attributes session-level usage and estimated cost to every cron-originated run, so you can see what your scheduled jobs are costing you. It hooks into `on_session_end`, stores derived analytics in a local SQLite fact database, and surfaces them in the Hermes dashboard via a dedicated `/cronalytics` tab.

> Turn hidden automation into visible spend.

---

## What It Does

- **Captures** every cron job run as it completes via the `on_session_end` hook
- **Persists** cost, token counts, model, duration, and success state to a local fact database
- **Backfills** historical data automatically on plugin load and on demand via reconciliation scanner
- **Surfaces** a dashboard with:
  - Summary cards (total runs, estimated cost, tokens, pace)
  - Leader board (top runs, top cost, top tokens, top pace)
  - Cost-by-model breakdown with proportional bars
  - Per-job table with runs, cost, duration, projections, and sortable columns
  - Expandable detail rows showing token breakdown, schedule, and success/failure split
  - Job detail modal with full run history (sortable, 200-run limit)
  - Outcome filter (All / Success / Failure) with conditional card colors
  - Mode filter (All / Agent / No agent) for script-only job visibility
  - **Sync Now** button to trigger backfill on demand
  - Educational modals explaining Pace, Nominal, Trend, and cost math

---

## Documentation Index

All documentation lives in `docs/` except where noted.

- **docs/BRIEF.md** — Product opportunity brief & positioning
- **docs/DESIGN.md** — Architecture, data flow, and technical decisions
- **docs/FEATURES.md** — Complete feature catalog with formulas
- **PLAN.md** — Phased build plan and backlog (root)
- **docs/LAUNCH_PLAN.md** — V1.0 launch timeline
- **docs/INSTALL.md** — Detailed installation guide
- **docs/UNINSTALL.md** — Clean removal instructions
- **docs/USAGE.md** — Dashboard usage guide
- **docs/AGENTS.md** — Contributor conventions & release gates

---


## Installation

### Dashboard Plugins Tab (Recommended)

Open the Hermes dashboard, navigate to the **Plugins** tab, and use the **Install from GitHub / Git URL** field. Enter:

- `owner/repo` shorthand (e.g. `8bit64k/cronalytics`)
- Or a full `https://` or `git@` clone URL

Check **Enable after install**, then click **Install**.

### After Install

Hard-refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear cached JS.

Open the **Cronalytics** tab in the dashboard sidebar.

> For development setup, see [`docs/DEV_SETUP.md`](docs/DEV_SETUP.md).

---

## First-Time Setup

After install, the plugin needs data:

1. **Wait for a cron job to run** — the `on_session_end` hook captures it automatically.
2. **Or trigger a manual backfill** — click **Sync Now** in the dashboard, or run:

```bash
curl -X POST http://localhost:9119/api/plugins/cronalytics/sync
```

If the dashboard shows "No cron jobs captured," click **Sync Now**.

---

## Configuration

### `plugin.yaml`

```yaml
name: cronalytics
version: 1.0.0
description: Cost and operational observability for Hermes cron jobs
provides_hooks:
  - on_session_end
```

### `config.py` (static defaults)

All current settings are hardcoded defaults. There is no user-editable config file yet (planned for v1.1).

| Setting | Default | Meaning |
|---------|---------|---------|
| `RETRY_DELAYS` | `[3.0, 8.0, 15.0]` | Seconds to wait before each worker retry |
| `JITTER_MAX` | `2.0` | Max random seconds added to each retry delay |
| `MAX_RETRIES` | `3` | Total attempts to read a session from `state.db` |

Paths are resolved automatically:
- `STATE_DB`: `~/.hermes/state.db` (Hermes core session store)
- `FACT_DB`: `~/.hermes/plugins/cronalytics/facts.db` (plugin-owned SQLite)
- `WATERMARK_FILE`: `~/.hermes/plugins/cronalytics/watermark.json`
- `PENDING_FILE`: `~/.hermes/plugins/cronalytics/pending.jsonl`

---

## What the Dashboard Shows

### Summary Board (Row 1)

Four cards showing aggregate metrics for the selected window:

- **Job Runs** — total executions with vs-prior-period delta (↑/↓ %)
- **Cost** — total estimated cost in amber; vs-prior delta + actual cost sub-line + ✓/✗ breakdown
- **Tokens** — total tokens in blue; In/Out/Cached proportion micro-bars
- **Pace** — aggregate `trend_monthly / nominal_monthly` as a multiplier:
  - `< 1.0×` green — under scheduled budget
  - `1.0–2.0×` neutral — on track
  - `≥ 2.0×` red — over budget

Click any card to open an educational modal explaining the metric.

### Leader Board (Row 2)

Four spotlight cards surfacing the highest-value job in each dimension:

- **Top Runs** — highest execution count
- **Top Cost** — highest cumulative spend
- **Top Tokens** — highest token consumption
- **Top Pace** — highest pace multiplier (most at risk of exceeding budget)

Click any card to open a detail modal with job metadata.

### Per-Model Breakdown

Proportional bar chart showing the top 5 models by cost, with run counts. Remaining models collapsed with "and N more."

### Jobs Breakdown Table

Eight sortable columns: **Job**, **Runs**, **Avg Time**, **Total Cost**, **Avg Cost**, **Nominal/mo**, **Trend/mo**, **Pace**.

- Click a column header to sort ascending/descending
- Click any row to expand a detail panel showing:
  - Token breakdown (total, in, out, cached)
  - Success/failure split with cost attribution
  - Schedule display, last run, model, next run
  - **See Runs** button opening a full modal

### Job Detail Modal

Full run history for the selected job:
- 95% width modal with sticky headers
- Sortable by run time, cost, duration, success, model
- 200-run default limit (backend ceiling: 500)
- Mode column showing Agent vs No agent

### Toolbar Controls

- **Outcome toggle** — `All | Success | Failure` (persists in localStorage)
- **Mode toggle** — `All | Agent | No agent` (persists in localStorage)
- **Day selector** — `7D | 30D | 90D` presets + custom input (0–365 days, Enter/Go)
- **Refresh** — re-fetches summary and jobs
- **Sync Now** — triggers reconciliation scan with spinner + completion toast

---

## Understanding Success

Cronalytics tracks two different notions of "success":

| Signal | What It Means | Source |
|--------|--------------|--------|
| **Wrapper Success** (`success` toggle in dashboard) | The cron wrapper finished without error — the job ran, the agent responded, and the wrapper exited cleanly. | `end_reason` field |
| **Payload Success** | The agent's actual output was correct, useful, or achieved the intended goal. | **Not tracked** |

### How to interpret the dashboard

- **Success = high, Failure = low** → Your cron jobs are mechanically reliable.
- **Success = high, but output quality is poor** → The infrastructure is fine; the issue is in the prompt, model choice, or task definition.
- **Failure = high** → Investigate timeouts, API errors, or wrapper crashes.

> The Success/Failure toggle is a **reliability** signal, not a **correctness** signal.

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
Dashboard queries facts.db via plugin API
```

---

## API Endpoints

All endpoints are mounted at `/api/plugins/cronalytics/`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Plugin health + sync metadata |
| `/summary?days=N&outcome=both&mode=all` | `GET` | Aggregated totals with projections |
| `/jobs?days=N&outcome=both&mode=all` | `GET` | Per-job rolled-up stats with projections |
| `/jobs/{job_id}/runs` | `GET` | Individual runs for a specific job |
| `/models?days=N&outcome=both&mode=all` | `GET` | Cost breakdown by model |
| `/trends?days=N&outcome=both&mode=all` | `GET` | Daily cost + runs time series |
| `/sync` | `POST` | Run reconciliation scanner manually |

---

## Data Model

The fact database (`facts.db`) is append-only. Rows are inserted once and never updated or deleted.

Key fields captured per run:

- `session_id` — unique run key
- `job_id` — stable job definition ID
- `run_time` / `ended_at` / `duration_seconds`
- `model`
- `input_tokens` / `output_tokens` / `reasoning_tokens` / `cache_read_tokens` / `cache_write_tokens`
- `estimated_cost_usd` — primary cost metric
- `actual_cost_usd` — ground-truth when available
- `cost_status`, `cost_source`, `billing_provider`
- `api_call_count`, `message_count`, `tool_call_count`
- `end_reason`, `success`
- `job_mode` — `agent` or `no_agent`
- `ingested_at`

---

## File Layout

```
cronalytics/
├── plugin.yaml              # Plugin manifest (hooks, version)
├── __init__.py              # Register hook + bootstrap scanner
├── config.py                # Paths + defaults
├── facts.py                 # SQLite fact DB: schema, insert, queries
├── ingester.py              # Deferred ingestion worker + crash recovery
├── scanner.py               # Reconciliation scanner + watermark I/O
├── schedule.py              # Cron parsing + projection math
├── cli.py                   # Standalone terminal interface
├── logger.py                # Shared logger
├── checkpoint.py            # Session state persistence
├── dashboard/
│   ├── manifest.json        # Dashboard plugin manifest
│   ├── plugin_api.py        # FastAPI router
│   ├── build.js             # esbuild bundler script
│   ├── src/                 # Modular frontend source
│   │   ├── index.js         # Entry point
│   │   ├── lib/             # SDK, formatters, icons, validators
│   │   ├── hooks/           # useApi, useModal
│   │   └── components/      # 13 React components
│   └── dist/
│       └── index.js         # Bundled IIFE frontend
└── tests/                   # 83 pytest tests
```

---

## Known Limitations

1. **Wrapper-level success only.** The `success` boolean reflects whether the session wrapper completed, not whether the agent task succeeded.
2. **Abandoned sessions are invisible.** Sessions where the gateway crashed or the job got stuck are never ingested (they never reach `ended_at`).
3. **No user-editable config file yet.** All tuning values are hardcoded in `config.py`.
4. **Actual cost is often null.** Most runs only populate `estimated_cost_usd`; `actual_cost_usd` depends on provider billing data.
5. **Plugin directory is a static copy.** Changes in the build directory are not reflected in `~/.hermes/plugins/cronalytics/` unless manually copied or symlinked.
6. **Dashboard server caches plugins per-process.** Changes to `manifest.json` or `plugin_api.py` require a full dashboard restart.
7. **Mobile layout tested but not optimized.** The table may require horizontal scroll on narrow viewports.
8. **Job detail modal capped at 200 runs.** High-frequency jobs show full count in the table but the drill-down is limited.

---


---

## Requirements
If you are running Hermes Agent you have everything you need:
- Hermes Agent with plugin hook support (`on_session_end`)
- Hermes dashboard server for UI components
- SQLite (bundled with Python)

---

## Changelog

### v1.0.0 (2026-05-12)

- Dashboard: Summary Board, Leader Board, Per-Model Breakdown, Jobs Breakdown table
- Sortable 8-column jobs table with expandable detail rows
- Job Detail Modal with full run history, sticky headers, inherited sorting
- Outcome toggle (All/Success/Failure) with conditional Cost card colors
- Mode toggle (All/Agent/No agent) with script job visibility
- Pace, Nominal, and Trend projections with educational modals
- Reconciliation scanner with watermark-based backfill
- Bootstrap scanner on plugin load (catches post-restart gaps)
- 83 pytest tests covering facts, parser, scanner, schedule, ingester, plugin API
- Lint/type check: `ruff` + `mypy` clean
- Keyboard-accessible cards and table headers (a11y)
- Large-font theme resilience
- API validation layer (JSDoc typedefs + runtime guards)

### v0.1.0

- Initial release: real-time ingestion, fact DB, reconciliation scanner, dashboard API, React frontend with summary cards, jobs table, cost-by-model, sync button.

---

*Plugin path: `~/.hermes/plugins/cronalytics/`*  
*Fact DB: `~/.hermes/plugins/cronalytics/facts.db`*  
*API base: `/api/plugins/cronalytics/`*
