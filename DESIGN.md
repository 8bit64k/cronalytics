# Design — Cronalytics
> A Hermes dashboard plugin for cron cost & operational visibility.

**One-liner:** *Turn hidden automation into visible spend.*
Cronalytics attributes session-level cost, model, and frequency data to every cron-originated run so you can see which scheduled jobs are driving your token spend.

---

## 1. Problem

Hermes makes scheduled automation easy to create and run, but ongoing cron cost is hard to attribute and manage:

- Cron jobs execute repeatedly as fresh isolated agent sessions — no chat context, no persistent history.
- Users create recurring jobs, then forget about them once they run reliably.
- Total Hermes usage is visible, but there is no cron-specific cost lens.
- A daily digest at $0.05 per run is $1.50/month. A 5-minute monitor at $0.08 per run is $70/month. Without per-job visibility, the second one hides inside the first.

The result: automation is easy to start, but ongoing cron cost compounds quietly through frequency, model choice, and long-lived schedules.

---

## 2. Solution

Cronalytics is a **dashboard plugin** (plus a standalone CLI) that attributes session-level usage and estimated cost to cron-originated runs. It lives inside `hermes dashboard` as a standalone tab at `/cronalytics`.

> **Terminology (as of Hermes 2026-05):**
> - **Hermes Agent plugin** — Has a `plugin.yaml`, registers hooks (e.g. `on_session_end`), runs inside the gateway process. Cronalytics is this.
> - **Dashboard plugin** — An agent plugin that also has a `dashboard/` directory with `manifest.json`. The dashboard process discovers it, loads its API module, and serves its JS bundle. Cronalytics is also this.
> - **Dashboard extension** — Pure frontend addon with `dashboard/manifest.json` but **no** `plugin.yaml`. No gateway hook, no backend code. Lives entirely in the dashboard process (e.g. Kanban, Omatchy).

### Core Promise
> Every scheduled job you have — how often it runs, what it costs, which model it uses, and whether your actual spend is outpacing your schedule — visible in one place.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HERMES GATEWAY PROCESS                   │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Cron Tick  │───▶│ Agent Session│───▶│on_session_end│  │
│  │ (scheduler) │    │(run_agent.py)│    │   hook fires │  │
│  └─────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                 │           │
│                              platform="cron"     │           │
│                              session_id=         │           │
│                                cron_{id}_{ts}    │           │
│                                                 ▼           │
│                                        ┌──────────────┐    │
│                                        │  Enqueue to  │    │
│                                        │ pending.jsonl│    │
│                                        └──────┬───────┘    │
│                                               │             │
│                              ┌────────────────┘             │
│                              ▼                              │
│                    ┌─────────────────┐                      │
│                    │ Background      │                      │
│                    │ Worker Thread   │                      │
│                    │ (retry w/ jitter│                      │
│                    │  up to 3x)      │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│              Query state.db │ (sessions table)              │
│                             ▼                               │
│                    ┌─────────────────┐                      │
│                    │  Fact DB Write  │                      │
│                    │  (append-only)  │                      │
│                    └─────────────────┘                      │
│                             │                               │
│         ┌───────────────────┘                               │
│         ▼                                                   │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │ Reconciliation  │     │  Bootstrap      │               │
│  │ Scanner         │     │  on plugin load │               │
│  │ (watermark +    │     │  (catches gaps) │               │
│  │  batch insert)  │     │                 │               │
│  └─────────────────┘     └─────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                              │
           API reads          │
```
┌─────────────────────────────────────────────────────────────┐
│                  HERMES DASHBOARD PROCESS                   │
│                                                             │
│  ┌────────────────────────────────────────┐  │
│  │            /cronalytics tab                     │  │
│  │                                                 │  │
│  │  Summary cards                                  │  │
│  │  Jobs table (7 columns)                         │  │
│  │  Expandable detail rows                          │  │
│  │  Day filter / Refresh / Sync Now                 │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Decisions

### 4.1 Hook: `on_session_end`

**Not `on_session_finalize`.** That hook fires only in CLI chat sessions and gateway eviction paths. It does **not** fire for cron jobs. `on_session_end` fires at the end of every `run_conversation()`, which is exactly what `run_job()` calls inside the scheduler.

We deliberately chose **non-blocking** ingestion: the hook writes the `session_id` to `pending.jsonl` and returns immediately. A background worker processes the queue so the gateway scheduler never waits on disk I/O.

### 4.2 Deferred Queue + Crash Recovery

`on_session_end` fires *inside* `run_conversation()`, but `end_session()` (which flushes the row to `state.db`) happens in the `finally:` block of `run_job()`. The session data may not exist when the hook fires.

**Solution:**
- Hook persists to `pending.jsonl` (disk-first durability).
- In-memory queue is drained by a daemon thread.
- Worker waits 3–17 seconds (base delay + jitter) before querying `state.db`.
- Up to 3 retries with exponential backoff.
- Gateway restart? `ingester.start()` replays `pending.jsonl` on plugin load.

### 4.3 Fact DB: Plugin-Owned, Append-Only SQLite

**NotHermes `state.db`.** The fact DB is a separate SQLite file owned by the plugin:

```
~/.hermes/plugins/cronalytics/facts.db
```

Why separate?
- `state.db` is operational. It may be purged, migrated, or schema-migrated by Hermes core.
- Fact DB rows are **INSERT-only**. No updates, no deletes. If upstream data changes, the snapshot remains.
- `ON CONFLICT(session_id) DO NOTHING` handles duplicate ingestion from both real-time hooks and scanner backfill.

Schema (simplified):
```sql
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
    ingested_at REAL DEFAULT (unixepoch())
);
```

### 4.4 Reconciliation Scanner

The scanner exists because hooks can crash, the plugin can be disabled, or the gateway can restart. It is **not** the primary data path — hooks capture ~99% of events in real time — but it is the safety net.

**Algorithm:**
1. Read watermark JSON (`last_ended_at`).
2. Query `state.db` for `source='cron'` rows with `ended_at > watermark`.
3. Batch-insert new rows into fact DB.
4. Write new watermark = `max(ended_at)`.

**Trigger sources:**
- Bootstrap thread on every plugin load (catches gaps from downtime).
- Manual `POST /api/plugins/cronalytics/sync` ("Sync Now" button).

### 4.5 Standalone `/cronalytics` Tab

The original design specified three slots (`cron:top`, `cron:bottom`) injected into the built-in `/cron` page. We pivoted to a standalone tab (`/cronalytics`) because:

1. Route collision: the built-in `/cron` tab renders before plugin slots mount. Plugin content was being overwritten.
2. Vertical slice delivery: a full page is faster to build and test than coordinating multiple slot injections.
3. Navigation clarity: users expect "Cronalytics" as a distinct view, not a patch on top of the scheduler CRUD.

The manifest no longer claims any sidebar slots. The `/cronalytics` tab is the sole UI surface.

### 4.6 Fixed-Window Projection Math

Early versions used the *data span* (actual days between first and last run) as the denominator for trend calculations. This broke an algebraic invariant: the sum of per-job trends did not equal the aggregate trend, because each job had a different data span.

**Decision:** Use the user's selected filter window (7D, 30D, 90D, All) as the fixed denominator for all trend math.

| Metric | Formula |
|--------|---------|
| Daily cost | `total_cost / days_filter` *(or all-time span if days=0)* |
| Trend 30d | `daily_cost × 30` |
| Nominal 30d | `avg_cost × scheduled_runs_30d` *(from croniter)* |
| Pace | `trend_30d / nominal_30d` |
| Drift | `observed_runs / scheduled_runs_in_window` *(API only; not surfaced in UI yet)* |

Why fixed-window?
- **Summation invariant:** `Σ job.trend_30d == aggregate.trend_30d` always holds.
- **Comparability:** A job with 2 runs in 7 days and a job with 20 runs in 7 days share the same denominator.
- **Honesty:** A job that hasn't run in the window shows `$0` trend, not a stale historical average.

### 4.7 Importlib-Safe Module Loading

The dashboard server loads plugin API files as **standalone scripts**, not as part of a Python package. That means `from . import facts` (a relative import) fails silently, which prevents API routes from mounting at all.

Our workaround: `plugin_api.py` and `scanner.py` both use a small `_load_module()` helper that loads sibling `.py` files by absolute disk path. It is slightly ugly but harmless — no runtime side effects, no performance cost, and no risk beyond "if you move files around, update the path helper."

Relative imports remain fine in `__init__.py` and `ingester.py` because those run inside the gateway process where normal Python package context exists.

### 4.8 Human-Readable Job Names

Job IDs in the fact DB are stable hex strings (`841aee933270`). The dashboard resolves these to names at query time by reading `~/.hermes/cron/jobs.json` and mapping `id → name`. This is read-only; Cronalytics never writes to `jobs.json`.

### 4.9 Dashboard Dev Cache Busting *(Internal)*

During active development, the browser, Tailscale proxy, and disk cache all aggressively cache `dashboard/dist/index.js`. We temporarily patched `serve_plugin_asset` in the host dashboard server to emit `Cache-Control: no-store` for plugin assets. This is a **local development convenience only** — it is not part of the Cronalytics repo and will need to be re-applied after any `hermes update` that touches the dashboard server. It is documented here solely as a reminder.

### 4.10 Tooltips: Decision and Reversion

We explored ⓘ icons with click-to-toggle `position: fixed` tooltips for column headers (Nominal/mo, Trend/mo, Pace). The implementation worked on desktop but viewport-edge positioning on iPad Safari produced clipped/wonky popups. Rather than chase responsive tooltip layout gymnastics, we reverted to native `title` attributes. This is a known trade-off: desktop users get hover-after-delay, mobile users get tap-and-hold (browser-dependent). A custom modal or portal-based tooltip is reserved for a future polish pass.

**Metrics education is an open design problem.** Pace, Nominal, Trend, and Drift are not self-evident to a first-time user. Native `title` is the bare minimum. A proper solution — inline microcopy, a "What's this?" expander, or a dedicated help panel — needs design work before V1.0.

---

## 5. Data Flow

```
Cron Job Due
    │
    ▼
Scheduler tick()
    │
    ▼
run_job() ──▶ run_conversation() ──▶ on_session_end(platform="cron")
                                          │
                                          ▼
                                    Write session_id to pending.jsonl
                                          │
                                          ▼
                                    Background worker (after delay)
                                          │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                   state.db found               state.db not found
                          │                           │
                          ▼                           ▼
                   Insert into fact.db          Retry (up to 3x)
                                                          │
                                                          ▼
                                                    Max retries ──▶ Drop + log
```

---

## 6. Boundaries

### What Cronalytics Does
- Observe cron job runs and attribute cost, tokens, model, and duration per run.
- Surface aggregates (total cost, runs, tokens, pace) in a dashboard tab.
- Project future spend based on schedule (nominal) and current pace (trend).
- Provide a standalone CLI for terminal-based inspection.

### What Cronalytics Does NOT Do
- **Create or edit jobs** — use the built-in `/cron` page.
- **Control execution** — no Pause/Trigger/Delete.
- **Stream logs** — output files live at `~/.hermes/cron/output/`; streaming is out of scope.
- **Replace the scheduler** — we observe, we do not control.
- **External DB** — everything is local SQLite/JSONL.
- **True payload-level success detection** — we track whether the *wrapper* completed (`end_reason`), not whether the *agent task* succeeded. This is a known limitation.

---

## 7. File Layout

```
cronalytics/
├── plugin.yaml              -- Manifest: name, version, hooks
├── __init__.py              -- register(ctx): schema, recovery, hook, bootstrap scanner
├── config.py                -- Paths, retry delays, jitter
├── facts.py                 -- Fact DB: schema, insert, queries
├── ingester.py              -- Hook handler, pending.jsonl, background worker
├── scanner.py               -- Reconciliation scanner + watermark I/O
├── schedule.py              -- Cron parsing, projection math (croniter)
├── cli.py                   -- Standalone terminal interface
├── logger.py                -- Simple prefixed logger
├── checkpoint.py            -- Session state serialization for multi-session dev
├── dashboard/
│   ├── manifest.json        -- Dashboard plugin manifest
│   ├── plugin_api.py        -- FastAPI router (importlib-safe)
│   └── dist/
│       └── index.js         -- Frontend bundle (React + HERMES_PLUGIN_SDK)
```

---

## 8. Positioning

> Turn hidden automation into visible spend.

See what your cron jobs are costing before background automation becomes background waste. The problem is not cron itself — it's the lack of cost visibility around unattended execution.

---

*Version: 0.3.0 (Design refresh)*
*Last updated: 2026-05-04*