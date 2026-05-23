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

Cronalytics is a **dashboard plugin** with an optional terminal CLI that attributes session-level usage and estimated cost to cron-originated runs. It lives inside `hermes dashboard` as a dedicated tab at `/cronalytics`.

> **Terminology (as of Hermes 2026-05):**
> - **Hermes Agent plugin** — Has a `plugin.yaml`, registers hooks (e.g. `on_session_end`), runs inside the gateway process. Cronalytics is this.
> - **Dashboard plugin** — An agent plugin that also has a `dashboard/` directory with `manifest.json`. The dashboard process discovers it, loads its API module, and serves its JS bundle. Cronalytics is also this.
> - **Dashboard extension** — Pure frontend addon with `dashboard/manifest.json` but **no** `plugin.yaml`. No gateway hook, no backend code. Lives entirely in the dashboard process (e.g. Kanban, Omatchy).

### Core Promise
> Every scheduled job you have — how often it runs, what it costs, which model it uses, and whether your actual spend is outpacing your schedule — visible in one place.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HERMES GATEWAY PROCESS                     │
│                                                                 │
│  ┌───────────────┐ ──▶ ┌───────────────┐ ──▶ ┌───────────────┐  │
│  │   Cron Tick   │     │ Agent Session │     │ on_session_end│  │
│  │  (scheduler)  │     │ (run_agent.py)│     │   hook fires  │  │
│  └───────────────┘ ──▶ └───────────────┘ ──▶ └───────────────┘  │
│                         platform="cron"                         │
│                           session_id=                           │
│                           cron_{id}_{ts}                        │
│                                                                 │
│                        ┌───────────────┐                        │
│                        │   Enqueue to  │                        │
│                        │ pending.jsonl │                        │
│                        └───────────────┘                        │
│                                │                                │
│                               ▼                                 │
│                     ┌─────────────────────┐                     │
│                     │  Background Worker  │                     │
│                     │        Thread       │                     │
│                     │   (retry w/ jitter  │                     │
│                     │       up to 3x)     │                     │
│                     └─────────────────────┘                     │
│                                │                                │
│                Query state.db │ (sessions table)                │
│                               ▼                                 │
│                     ┌─────────────────────┐                     │
│                     │    Fact DB Write    │                     │
│                     │    (append-only)    │                     │
│                     └─────────────────────┘                     │
│                                │                                │
│                               ▼                                 │
│           ┌─────────────────┐     ┌─────────────────┐           │
│           │  Reconciliation │     │    Bootstrap    │           │
│           │     Scanner     │     │  on plugin load │           │
│           │   (watermark +  │     │  (catches gaps) │           │
│           │  batch insert)  │     │                 │           │
│           └─────────────────┘     └─────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                               │                                 
                            API reads                            
┌─────────────────────────────────────────────────────────────────┐
│                     HERMES DASHBOARD PROCESS                    │
│                                                                 │
│    ┌───────────────────────────────────────────────────────┐    │
│    │                    /cronalytics tab                   │    │
│    │                                                       │    │
│    │              Hero banner + sticky toolbar             │    │
│    │                Summary Board (4 cards)                │    │
│    │            Leader Board (4 spotlight cards)           │    │
│    │            Per-Model Breakdown (bar chart)            │    │
│    │        Jobs Breakdown (8-column sortable table)       │    │
│    │       Expandable detail rows + Job Detail Modal       │    │
│    │     Educational modals (Pace, Cost, Runs, Tokens)     │    │
│    └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
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

**Not Hermes `state.db`.** The fact DB is a separate SQLite file owned by the plugin:

```
~/.hermes/plugins/cronalytics/facts.db
```

**Concurrency:** The database explicitly enables **WAL (Write-Ahead Logging)** mode via `PRAGMA journal_mode=WAL;`. This ensures the background ingester thread can write new runs while the Dashboard API performs aggregation queries simultaneously without "Database is locked" errors.

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
    job_mode TEXT DEFAULT 'agent',
    ingested_at REAL DEFAULT (unixepoch())
);
```

### 4.4 Reconciliation Scanner

The scanner exists because hooks can crash, the plugin can be disabled, or the gateway can restart. It is **not** the primary data path — hooks capture ~99% of events in real time — but it is the safety net. It specifically targets both `state.db` (for agent sessions) and `~/.hermes/cron/output/` (for script-only `no_agent` jobs).

**Algorithm:**
1. Read watermark JSON (`last_ended_at` for agent jobs; `last_modified` for script offsets).
2. Query `state.db` for `source='cron'` rows with `ended_at > watermark`.
3. Scan filesystem for script output artifacts newer than watermark.
4. Batch-insert new rows into fact DB.
5. Write new watermark.

**Trigger sources:**
- Bootstrap thread on every plugin load (catches gaps from downtime).
- Manual `POST /api/plugins/cronalytics/sync` ("Sync Now" button).
- Background worker fallback if `on_session_end` fails to resolve a session.

### 4.5 Standalone `/cronalytics` Tab

The original design specified three slots (`cron:top`, `cron:bottom`) injected into the built-in `/cron` page. We pivoted to a standalone tab (`/cronalytics`) because:

1. Route collision: the built-in `/cron` tab renders before plugin slots mount. Plugin content was being overwritten.
2. Vertical slice delivery: a full page is faster to build and test than coordinating multiple slot injections.
3. Navigation clarity: users expect "Cronalytics" as a distinct view, not a patch on top of the scheduler CRUD.

The manifest no longer claims any sidebar slots. The `/cronalytics` tab is the sole UI surface.

### 4.6 Fixed-Window Projection Math

Early versions used the *data span* (actual days between first and last run) as the denominator for trend calculations. This broke an algebraic invariant: the sum of per-job trends did not equal the aggregate trend, because each job had a different data span.

**Decision:** Use the user's selected filter window (7D, 30D, 90D) as the fixed denominator for all trend math. Type `0` for all time.

| Metric | Formula |
|--------|---------|
| Daily cost | `tot_estimated_cost / days_filter` *(or all-time span if days=0)* |
| Trend 30d | `daily_cost × 30` |
| Nominal 30d | `avg_estimated_cost × scheduled_runs_30d` *(from croniter)* |
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

### 4.9 Agent / No-Agent Mode Awareness

Hermes supports `no_agent` cron jobs that execute scripts without invoking an LLM. These produce no `state.db` entry, so the hook never fires for them.

**Solution:** Dual-track sync:
- Agent jobs: captured by `on_session_end` hook + scanner querying `state.db`.
- No-agent jobs: scanner scans `~/.hermes/cron/output/` for `.md` artifacts and creates synthetic rows with zero cost/tokens.

The dashboard exposes a **Mode toggle** (`All | Agent | No agent`) so users can see script-only jobs alongside agent jobs.

### 4.10 Dashboard Frontend Architecture

The frontend was originally a 1,811-line IIFE monolith. It has been split into a modular `src/` tree:

```
dashboard/src/
├── index.js                 # Entry point: ErrorBoundary + PLUGINS.register
├── lib/
│   ├── sdk.js             # React, hooks, fetchJSON, UI primitives from HERMES_PLUGIN_SDK
│   ├── formatters.js      # fmtCost, fmtCompact, fmtDuration, paceColor, etc.
│   ├── icons.js           # SVG icon components
│   └── validate.js        # API response shape validation (dev-only)
├── hooks/
│   └── useApi.js          # Data fetching + modal toggle hooks
└── components/
    ├── CronalyticsTab.js  # Main orchestrator (~370 lines)
    ├── HeroBanner.js      # Dictionary-style header
    ├── SummaryBoard.js    # 4-card metric grid
    ├── LeaderBoard.js     # 4-card spotlight grid
    ├── ModelBreakdown.js  # Per-model cost bars
    ├── JobBreakdown.js    # Sortable jobs table + expand rows
    ├── JobDetailView.js   # Modal run history table
    ├── DaySelector.js     # Day presets + custom input
    ├── OutcomeToggle.js   # All/Success/Failure toggle
    ├── ModeToggle.js      # All/Agent/No agent toggle
    ├── SparkLine.js       # Hoverable trend chart
    ├── Modal.js           # Overlay with Escape/backdrop/resize
    └── ErrorBoundary.js   # Plugin-level error boundary
```

Build: `node dashboard/build.js` (esbuild) produces `dist/index.js` as an IIFE bundle consumed by Hermes.

### 4.11 API Validation Layer

Because the frontend consumes API responses without TypeScript, field renames or type changes in the backend can cause silent failures. We added a lightweight validation layer:

- JSDoc `@typedef` annotations for all 6 API response shapes.
- `assertType()` runtime guard that validates expected fields in development (`NODE_ENV !== "production"`).
- Validation errors are swallowed gracefully in production; they only log to console in dev.

This is a deliberate compromise: no TypeScript migration (1–2 days of work), no Zod dependency (bundle size), just enough guardrails to catch backend drift during development.

### 4.12 Accessibility

All interactive elements are keyboard-accessible:
- Table headers: `tabIndex=0`, `role="button"`, `aria-label`, `onKeyDown` for Enter/Space.
- Summary and Leader cards: same pattern — Tab to focus, Enter/Space to activate.
- Modals: Escape closes, backdrop click closes, focus remains inside modal while open.

### 4.13 Large-Font Theme Resilience

Hermes themes can override base font sizes. We use defensive CSS to prevent layout breakage:
- `grid-template-columns: repeat(4, minmax(0, 1fr))` instead of `repeat(4, 1fr)` so columns shrink below content width.
- `min-width: 0` on all grid children with `overflow: hidden`.
- `white-space: nowrap` + `text-overflow: ellipsis` on overflow-prone text.
- Flex-basis instead of fixed widths in proportional bars.

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
                          ┌────────────────────────┐
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
- Distinguish agent vs script-only jobs.
- Provide a terminal CLI for terminal-based inspection.

### What Cronalytics Does NOT Do
- **Create or edit jobs** — use the built-in `/cron` page.
- **Control execution** — no Pause/Trigger/Delete.
- **Stream logs** — output files live at `~/.hermes/cron/output/`; streaming is out of scope.
- **Replace the scheduler** — we observe, we do not control.
- **External DB** — everything is local SQLite/JSONL.
- **True payload-level success detection** — we track whether the *wrapper* completed (`end_reason`), not whether the *agent task* succeeded. This is a known limitation.

---

## 7. i18n / Localization

**Status:** Production-ready Multi-locale support (`en`, `es`, `zh-CN`, `zh-TW`). 

**Architecture:** 
Cronalytics implements a custom i18n layer that bridges with the Hermes Core `locale` state. Detects locale from `navigator.language` and syncs via `locale-changed` events.

**The "2/4 Consensus" Protocol:**
Validated through 4 independent models (Sonnet, Kimi, DeepSeek, Gemini). Requires 2/4 matching identity. Outliers rejected. Final technical alignment enforced (e.g., "Token" as English).

**Developer Requirement:**
Zero hardcoded strings in JSX. Every label must use `t()` hook with technical key + English fallback. See `docs/I18N_PROTOCOL.md` and `AGENTS.md`.

---
## 8. Terminal CLI

Cronalytics ships a terminal data tool (`cronalytics/cli.py`) that queries `facts.db` directly and renders monospace-aligned ASCII tables or `--json` envelopes. It is designed for **scripts, agents, and programmatic consumption** — not human visual exploration.

### Design Philosophy: Dashboard for People, CLI for Agents

The CLI is a **dumb data pipe**. It aggregates, formats, and emits. It never interprets.

| Layer | Role | Consumer |
|-------|------|----------|
| **CLI** | Data pipe | Scripts, agents, `jq`, Python |
| **Skill** | Interpretation framework | Hermes agent (fuzzy reasoning) |
| **Agent** | Force multiplier | Human operator |
| **Human** | Final authority | Decision maker |

### Architecture

```
User / Agent
    │
    ▼
+------------+    +------------+    +------------+
│   Skill    │ → │    CLI     │ → │  facts.db   │
│ (heuristics,│    │ (queries,  │    │ (append-   │
│ guardrails,│    │  renders)  │    │  only)     │
│ confidence)│    +------------+    +------------+
+------------+         ↑
                       │
                  state.db
                  (cron sessions)
```

### CLI Design Decisions

1. **Single file** (`cli.py`, ~1000 lines) — self-contained, no external deps beyond Python stdlib + croniter. Works from the plugin directory directly.
2. **Shell entry point** — `cronalytics` (via `pip install -e`) or `alias cronalytics='python -m cronalytics.cli'` for the module path.
3. **Every data command except `all` supports `--json`** — structured envelopes with `period`, `start_date`, `end_date`, `outcome`, `mode`, and `data`. Pipe-friendly.
4. **Job name resolution** — reads `~/.hermes/cron/jobs.json` to map `job_id` → human-readable name, applies truncation + `[N]` badge.
5. **Projection computation** — calls `schedule.get_job_projections()` per-job to compute `pace`, `drift_ratio`, `scheduled_runs_*`, etc. JSON path mirrors rendered path exactly.
6. **Leader Board** — `summary` command selects top job per category (runs, cost, tokens, pace) and computes `% of total` share, matching the dashboard's spotlight cards.
7. **ASCII art banners** — Unicode box-drawing with emoji-aware width calculation (`_visual_len()`). Consistent with `hermes insights` visual style.

### Filter Grammar

Every data command shares the same filter surface:

- `--days N` — window in days (`0` = all time)
- `--outcome all|success|failure` — outcome filter
- `--mode all|agent|no_agent` — job mode filter

This means `cronalytics jobs --days 7 --json` and `cronalytics models --days 7 --json` apply identical filters. An agent reading the skill learns one grammar and applies it everywhere.

---

## 9. File Layout

```
cronalytics/
├── plugin.yaml              # Manifest: name, version, hooks
├── __init__.py              # register(ctx): schema, recovery, hook, bootstrap scanner
├── cronalytics/             # Core package
│   ├── cli.py             # Terminal interface (entry point)
│   ├── config.py          # Paths, retry delays, jitter
│   ├── facts.py           # Fact DB: schema, insert, queries
│   ├── ingester.py        # Hook handler, pending.jsonl, background worker
│   ├── scanner.py         # Reconciliation scanner + watermark I/O
│   ├── schedule.py        # Cron parsing, projection math (croniter)
│   ├── logger.py          # Simple prefixed logger
│   └── checkpoint.py      # Session state serialization for multi-session dev
├── skills/
│   └── devops/
│       └── cronalytics/
│           └── SKILL.md     # Built-in diagnostic skill for agents
├── dashboard/
│   ├── manifest.json        # Dashboard plugin manifest
│   ├── plugin_api.py        # FastAPI router (importlib-safe)
│   ├── build.js             # esbuild bundler script
│   ├── src/                 # Modular frontend source (13 components)
│   └── dist/
│       └── index.js         # Frontend bundle (React + HERMES_PLUGIN_SDK)
└── tests/                   # 149 pytest tests (83 original + 66 CLI)
```

---

## 9. Positioning

> Turn hidden automation into visible spend.

See what your cron jobs are costing before background automation becomes background waste. The problem is not cron itself — it's the lack of cost visibility around unattended execution.

---

*Version: 1.1.0*  
*Last updated: 2026-05-23*
