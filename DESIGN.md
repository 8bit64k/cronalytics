# Cron Insights
## A Hermes Dashboard Plugin for Cron Cost & Operational Visibility

> **One-liner:** Turn hidden automation into visible spend. Cron Insights attributes session-level cost, model, and frequency data to every cron-originated run, surfacing what your scheduled jobs are actually costing you.

---

## 1. The Problem

Hermes makes scheduled automation easy to create and run, but ongoing cron cost is hard to attribute and manage:

- Cron jobs execute repeatedly as fresh isolated agent sessions — no chat context, no persistent history
- Users can create recurring jobs, then forget about them once they run reliably
- A user may understand total Hermes usage without realizing scheduled background work is responsible for a large share of token and model spend
- There is no cron-specific cost lens in the existing Insights/Analytics views
- The result: automation is easy to start, but ongoing cron cost compounds quietly through frequency, model choice, and long-lived schedules

### Real pain from the community

GitHub issue #17071 (Apr 2026): *"Cron job stage persistence + partial retry mechanism — Real world case: 2 million tokens wasted due to push failures"*

A Hermes user burned 2M tokens on a cron job that failed at the delivery stage, with no visibility into when it ran, what it cost, or why it failed. They only found out after the fact.

### Pain in your own usage

You run a daily digest cron at 2 PM ET. You evaluate workflows over ~1 week. But:
- You cannot see at a glance whether yesterday's digest succeeded or how much it cost
- You have no history of past digests to compare cost trends
- You cannot tell which cron jobs are driving your monthly spend
- You cannot identify which model choice for a cron job is burning tokens inefficiently

---

## 2. The Solution

**Cron Insights** is a dashboard plugin that attributes session-level usage and estimated cost to cron-originated runs. It lives inside `hermes dashboard` as slot-based augmentations to the existing `/cron` page.

### Core Promise

> *"Every scheduled job you have — how often it runs, what it costs, which model it uses, and which jobs are driving the most spend — visible in one place."*

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HERMES GATEWAY PROCESS                         │
│  (long-running daemon — cron ticker + chat gateway)                     │
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │   Cron Job      │────▶│  Agent Session  │────▶│  on_session_end │  │
│  │   (scheduler)   │     │  (run_agent.py) │     │    hook fires   │  │
│  └─────────────────┘     └─────────────────┘     └────────┬────────┘  │
│                                                           │            │
│                              platform="cron"               │            │
│                              session_id="cron_{id}_{ts}"   │            │
│                                                           ▼            │
│                                              ┌─────────────────────┐   │
│                                              │  Cron Insights      │   │
│                                              │  Hook Handler       │   │
│                                              │  (PluginContext)    │   │
│                                              └──────────┬──────────┘   │
│                                                         │              │
│                              Immediate return           │              │
│                              (non-blocking)             ▼              │
│                                              ┌─────────────────────┐   │
│                                              │  Deferred Queue     │   │
│                                              │  (in-memory +       │   │
│                                              │   file-backed)      │   │
│                                              └──────────┬──────────┘   │
│                                                         │              │
│                              Retry w/ exponential       │              │
│                              backoff, 5-10s delay       ▼              │
│                                              ┌─────────────────────┐   │
│                                              │  Session DB Query   │   │
│                                              │  (state.db sqlite)  │   │
│                                              │  SELECT * FROM      │   │
│                                              │  sessions WHERE     │   │
│                                              │  id = session_id    │   │
│                                              └──────────┬──────────┘   │
│                                                         │              │
│                              Extract cost, tokens,      │              │
│                              model, duration, etc.      ▼              │
│                                              ┌─────────────────────┐   │
│                                              │  Fact DB Write      │   │
│                                              │  (plugin-owned      │   │
│                                              │   SQLite, append)   │   │
│                                              └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (API reads)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      HERMES DASHBOARD PROCESS                           │
│  (FastAPI + Vite/React — started by `hermes dashboard`)                 │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Existing /cron page (built-in CRUD)                              │  │
│  │                                                                   │  │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐ │  │
│  │  │  cron:top slot  │   │   Job list      │   │ cron:bottom slot│ │  │
│  │  │  (aggregates)   │   │   (built-in)    │   │  (per-job       │ │  │
│  │  │                 │   │                 │   │   history)      │ │  │
│  │  └─────────────────┘   └─────────────────┘   └─────────────────┘ │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ header-right    │  Health badge: next run alert, failure count,     │
│  │ slot            │  cost indicator                                    │
│  └─────────────────┘                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Decisions

### 4.1 Hook Choice: `on_session_end`

**NOT `on_session_finalize`**. `on_session_finalize` only fires in the CLI (`platform="cli"`) and gateway chat session eviction paths. It does NOT fire for cron jobs.

`on_session_end` fires at the end of every `run_conversation()` call, which is exactly what `run_job()` invokes inside the cron scheduler. It provides:
- `session_id`: `cron_{job_id}_{timestamp}` — parseable to extract job_id
- `platform`: `"cron"` — our filter
- `model`: the model used for this run
- `completed`: boolean — whether the agent loop finished normally
- `interrupted`: boolean — whether the job was interrupted

### 4.2 Timing Safety: Deferred Async Queue

`on_session_end` fires *inside* `run_conversation()`, but the session DB `end_session()` call happens in the `finally:` block of `run_job()`, which wraps `run_conversation()`. The session data is not flushed when the hook fires.

**Solution:** The hook handler immediately enqueues the session_id and returns. A background worker in the plugin processes the queue with:
- Initial delay: 5-10 seconds
- Retry with exponential backoff (up to 3 attempts)
- If session row not found after retries, drop the event (rare — log for debugging)

### 4.3 Data Source: `state.db` (SQLite Session Store)

Every cron run creates a session row with `source = 'cron'`. The `sessions` table captures:

| Column | Use |
|--------|-----|
| `id` | `cron_{job_id}_{timestamp}` — natural key |
| `source` | `"cron"` — filter |
| `started_at` / `ended_at` | Duration calculation |
| `input_tokens` / `output_tokens` | Token attribution |
| `reasoning_tokens` | Reasoning model cost |
| `cache_read_tokens` / `cache_write_tokens` | Cache token accounting |
| `estimated_cost_usd` | Primary cost metric |
| `actual_cost_usd` | Ground-truth when available |
| `cost_status` | Cost validity flag |
| `cost_source` | Provider that returned cost |
| `billing_provider` | Backend billing provider ID |
| `model` | Model attribution |
| `api_call_count` | Iteration depth |
| `message_count` / `tool_call_count` | Activity depth |
| `end_reason` | `"cron_complete"` vs failure modes |

### 4.4 Fact DB: Plugin-Owned SQLite

**NOT the operational state.db.** The fact DB is a separate SQLite file owned entirely by the plugin:

```
~/.hermes/plugins/cron-insights/facts.db
```

Schema:
```sql
CREATE TABLE IF NOT EXISTS cron_runs (
    session_id TEXT PRIMARY KEY,          -- immutable natural key
    job_id TEXT NOT NULL,                  -- parsed from session_id
    run_time REAL NOT NULL,                -- started_at from state.db
    ended_at REAL,                         -- ended_at from state.db
    duration_seconds REAL,                 -- computed
    model TEXT,                            -- model used
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL,               -- primary metric
    actual_cost_usd REAL,
    cost_status TEXT,                      -- e.g. "pending", "confirmed"
    cost_source TEXT,                      -- provider that returned cost
    billing_provider TEXT,
    api_call_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    end_reason TEXT,
    success BOOLEAN,                       -- derived from end_reason
    ingested_at REAL DEFAULT (unixepoch()) -- when we wrote it
);

CREATE INDEX idx_cron_runs_job_id ON cron_runs(job_id);
CREATE INDEX idx_cron_runs_run_time ON cron_runs(run_time DESC);
CREATE INDEX idx_cron_runs_ingested ON cron_runs(ingested_at);
```

**Immutability guarantees:**
- Rows are INSERT-only. No UPDATES, no DELETES.
- If upstream `state.db` purges sessions, fact DB retains the snapshot.
- Only explicit plugin archive/purge operations remove data.
- `ON CONFLICT(session_id) DO NOTHING` handles duplicate ingestion gracefully.

### 4.5 Reconciliation Scanner

A lazy backfill process triggered by:
1. Dashboard load (first visit after plugin install)
2. Explicit API call (`POST /api/plugins/cron-insights/sync`)
3. Periodic check (configurable, default: every 6 hours)

**Algorithm:**
```python
last_watermark = read_watermark()  -- last synced ended_at
new_sessions = query_state_db(
    "SELECT * FROM sessions 
     WHERE source = 'cron' 
     AND ended_at > ?",
    last_watermark
)
for session in new_sessions:
    insert_into_fact_db(session)  -- ON CONFLICT IGNORE
update_watermark(max(ended_at for session in new_sessions))
```

**Why this is sufficient:**
- The real-time hook captures 99% of events
- The scanner handles: initial install backfill, plugin-disabled periods, rare hook crashes
- `ended_at > last_watermark` is a simple, correct filter
- Session IDs are unique — no risk of double-counting

### 4.6 Plugin Structure

```
~/.hermes/plugins/cron-insights/
├── plugin.yaml                    -- Plugin manifest
├── __init__.py                    -- register(ctx) entrypoint
├── facts.py                       -- Fact DB operations
├── ingester.py                    -- Hook handler + queue + worker
├── scanner.py                     -- Reconciliation scanner
├── api.py                         -- FastAPI router for dashboard
└── dashboard/
    ├── manifest.json              -- Dashboard plugin manifest
    ├── dist/
    │   └── index.js               -- Frontend bundle (slots)
    └── ...
```

### 4.7 Slot Manifest

```json
{
  "name": "cron-insights",
  "label": "Cron Insights",
  "description": "Cost and operational visibility for Hermes cron jobs",
  "version": "0.1.0",
  "tab": {"hidden": true},
  "slots": ["cron:top", "cron:bottom", "header-right"],
  "api": "api.py",
  "entry": "dist/index.js"
}
```

---

## 5. What It DOES (MVP)

### v0.1 — Cost Attribution Dashboard

**cron:top slot** — Aggregated banner:
- Total cron runs in last 7 days
- Total estimated cron cost in last 7 days
- Cost by model (bar chart or list)
- Trend line: cron cost vs. total cost (if total available)

**cron:bottom slot** — Per-job drilldown:
- Sortable table: job name, run count, total cost, avg cost, last run
- Top 5 most expensive jobs
- Model used most frequently per job

**header-right slot** — Health badge:
- Next upcoming job countdown
- Failure indicator (jobs with errors in last 24h)
- Cost alert (if daily cron spend exceeds configurable threshold)

### v0.2+ (Future, Not MVP)
- Tool-level cost attribution (correlate with session messages)
- Schedule optimization recommendations ("This job runs every 5 min but only produces output 10% of the time")
- Budget thresholds with alerts
- Per-job model comparison ("Switching from Claude-Opus to Sonnet would save $X/month")

---

## 6. What It Does NOT Do

Explicit boundaries:
- **No job creation** — the built-in `/cron` page handles this
- **No schedule editing** — users edit via the existing CRUD UI
- **No live log streaming** — output files exist at `~/.hermes/cron/output/`, but streaming is out of scope
- **No job execution control** — no Pause/Trigger/Delete (built-in UI has these)
- **No replacement of the scheduler** — we observe, we do not control
- **No external database dependency** — everything is local SQLite/JSONL

---

## 7. Data Flow & Lifecycle

```
Cron Job Due
    │
    ▼
Scheduler tick() ────────────────────────┐
    │                                     │
    ▼                                     │
run_job() spawns AIAgent                 │
    │                                     │
    ▼                                     │
agent.run_conversation() ───┐            │
    │                       │            │
    ▼                       │            │
Hook: on_session_end()      │            │
    │ (platform="cron")     │            │
    ▼                       │            │
Enqueue session_id ─────────┘            │
    │                                     │
    ▼                                     │
Deferred worker retries ─────────────────┤
    │  (wait for flush)                   │
    ▼                                     │
Query state.db ──────────────────────────┤
    │  (sessions table)                   │
    ▼                                     │
Insert into fact.db ─────────────────────┘
    │
    ▼
Dashboard queries fact.db via plugin API
```

---

## 8. Success Metrics

Early success indicators:
- Share of total Hermes spend attributable to cron (visible in dashboard)
- Number of expensive jobs identified by users
- Number of jobs tuned or disabled after visibility review
- Reduction in unnecessary cron spend after users review the dashboard

---

## 9. Positioning

> **Turn hidden automation into visible spend.**

> See what your cron jobs are costing before background automation becomes background waste.

The problem is not cron itself — it's the lack of cost visibility around unattended execution.

---

*Last updated: 2026-04-29*
*Architecture locked. Ready for development planning.*
