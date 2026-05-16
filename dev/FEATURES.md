# Features — Cronalytics

> **Version:** 1.0.0
> **Scope:** Living catalog of all implemented functionality.

This document lists every implemented feature, the rationale for its inclusion, and the formulas or data sources it relies on. If something is not listed here, it is not implemented.

---

## 1. Data Capture (Gateway-Side)

### 1.1 Hook Registration

Cronalytics registers for the `on_session_end` hook inside the Hermes gateway process.

- **Why `on_session_end`?** It fires at the end of every `run_conversation()`, which is exactly what the cron scheduler invokes. `on_session_finalize` does **not** fire for cron jobs.
- **Filter:** Only sessions where `platform == "cron"` are captured. CLI chat sessions are silently ignored.
- **Entrypoint:** `__init__.py` → `ctx.register_hook("on_session_end", ingester.handle_session_end)`.

### 1.2 Ingestion Pipeline

The pipeline is deliberately **non-blocking** so the gateway scheduler never waits on plugin I/O.

1. **Hook fires** → `session_id`, `model`, `completed` are received.
2. **Disk-first durability** → The `session_id` is appended to `pending.jsonl` before any memory enqueue.
3. **In-memory queue** → A background daemon thread drains the queue.
4. **Deferred lookup** → The worker waits 3–17 seconds (base delay + jitter) then queries `state.db`.
5. **Retry** → If the row is not found, the worker retries up to 3 times with exponential backoff (`RETRY_DELAYS = [3.0, 8.0, 15.0]` + `JITTER_MAX = 2.0`).
6. **Drop** → After max retries, the event is dropped with a warning log. This is rare and usually indicates a `state.db` purge or a non-standard session lifecycle.
7. **Duplicate safety** → `ON CONFLICT(session_id) DO NOTHING` in the fact DB means the same session can be ingested by both the real-time hook and the reconciliation scanner without double-counting.

### 1.3 Crash Recovery

If the gateway restarts, `ingester.start()` replays `pending.jsonl` into the in-memory queue. No captured session is lost across restarts unless the pending file itself is deleted.

### 1.4 Session Parsing

Session IDs follow the format `cron_{job_id}_{YYYYMMDD}_{HHMMSS}`. The parser drops the prefix (`cron_`) and the final two segments (date + time) to recover the stable `job_id`. Early versions incorrectly dropped only one segment, causing every run to appear as a distinct job; this was fixed in Phase 2.5.

### 1.5 Script-Job Capture (No-Agent Mode)

Hermes `no_agent` cron jobs execute scripts without invoking an LLM. They produce no `state.db` entry, so the hook never fires.

**Solution:** The reconciliation scanner scans `~/.hermes/cron/output/` for `.md` artifacts with filenames matching `output_{job_id}_{timestamp}.md`. Each discovered artifact creates a synthetic fact DB row with zero cost, zero tokens, and `job_mode = "no_agent"`.

---

## 2. Data Storage (Fact DB)

### 2.1 Schema

SQLite database at `~/.hermes/plugins/cronalytics/facts.db`.

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

Indexes: `job_id`, `run_time DESC`, `ingested_at`, `job_mode`.
WAL mode enabled for concurrent read/write safety.

### 2.2 Design Rationale

- **Append-only:** No `UPDATE` or `DELETE` operations. Historical snapshots remain valid even if Hermes core purges `state.db`.
- **Separate DB:** The plugin owns its storage. Hermes schema migrations cannot break Cronalytics queries.
- **Immutable natural key:** `session_id` is the primary key. It never changes.

### 2.3 Fields Ingested

All fields are read from `state.db` `sessions` table at ingestion time.

| Field | Source Column | Purpose |
|-------|--------------|---------|
| `session_id` | `id` | Natural key |
| `job_id` | Parsed from `id` | Stable grouping key |
| `run_time` | `started_at` | When the run began |
| `ended_at` | `ended_at` | When the run finished |
| `duration_seconds` | Computed (`ended - started`) | How long the run took |
| `model` | `model` | Which model was used |
| `input_tokens` | `input_tokens` | Prompt tokens |
| `output_tokens` | `output_tokens` | Completion tokens |
| `reasoning_tokens` | `reasoning_tokens` | Reasoning-model tokens |
| `cache_read_tokens` | `cache_read_tokens` | Cache hit tokens |
| `cache_write_tokens` | `cache_write_tokens` | Cache write tokens |
| `estimated_cost_usd` | `estimated_cost_usd` | Primary cost metric |
| `actual_cost_usd` | `actual_cost_usd` | Ground-truth when available |
| `cost_status` | `cost_status` | Validity flag |
| `cost_source` | `cost_source` | Provider that returned cost |
| `billing_provider` | `billing_provider` | Backend billing provider |
| `api_call_count` | `api_call_count` | Iteration depth |
| `message_count` | `message_count` | Activity depth |
| `tool_call_count` | `tool_call_count` | Tool calls issued |
| `end_reason` | `end_reason` | Exit reason string |
| `success` | Derived (`end_reason == 'cron_complete'` or `'complete'`) | Wrapper completion boolean |
| `job_mode` | `'agent'` for hook, `'no_agent'` for scanner | Execution mode |

---

## 3. Reconciliation Scanner

### 3.1 What It Does

Backfills historical cron sessions from `state.db` into `facts.db` using a timestamp watermark to avoid duplicate work. Also scans `~/.hermes/cron/output/` for no-agent script artifacts.

### 3.2 Trigger Sources

- **Bootstrap on plugin load:** `__init__.py` starts a daemon thread that runs `scanner.run_sync()` immediately. This catches any runs that completed while the gateway was down.
- **Manual sync:** `POST /api/plugins/cronalytics/sync` (exposed via "Sync Now" button in the dashboard).

### 3.3 Algorithm

```
watermark = read_json(WATERMARK_FILE)  # {last_ended_at, last_sync, rows_synced}
rows = query_state_db(
    "SELECT * FROM sessions WHERE source = 'cron' AND ended_at IS NOT NULL AND ended_at > ?",
    watermark.last_ended_at
)
for row in rows:
    if not row_exists(row.id):
        insert(row)
new_watermark = max(ended_at for row in rows)
write_json(WATERMARK_FILE, new_watermark, rows_synced + inserted + skipped)

# Dual-track: scan output dir for no-agent script artifacts
script_rows = scan_output_dir(OUTPUT_DIR)
for artifact in script_rows:
    ingest_script_row(job_id, run_time)
```

### 3.4 Why No Auto-Run on Dashboard Load or Periodic Timer?

These were considered but not implemented. The bootstrap scanner on plugin load covers the most common gap (gateway restart). The "Sync Now" button covers the rare case where a user wants an immediate backfill. Adding dashboard-load auto-run would require the frontend to call `/sync` on every visit, which is wasteful. A periodic 6-hour background timer is deferred to a future hardening pass.

---

## 4. Dashboard API

All endpoints are mounted at `/api/plugins/cronalytics/`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Fact DB health, total runs, unique jobs, last sync watermark |
| `/summary?days=N&outcome=both&mode=all` | `GET` | Aggregated headline stats + schedule-aware projections |
| `/jobs?days=N&outcome=both&mode=all` | `GET` | Per-job aggregates with projections |
| `/jobs/{job_id}/runs` | `GET` | Individual run history for a specific job |
| `/models?days=N&outcome=both&mode=all` | `GET` | Per-model cost/token breakdown |
| `/trends?days=N&outcome=both&mode=all` | `GET` | Daily cost + runs bars over time |
| `/sync` | `POST` | Trigger manual reconciliation scan |

All endpoints return JSON wrapped as `{"plugin": "cronalytics", ...}`.
The `days` parameter accepts `0` (all time) or `1–365`.
The `outcome` parameter accepts `both`, `success`, `failure`.
The `mode` parameter accepts `all`, `agent`, `no_agent`.

---

## 5. Dashboard UI

### 5.1 Manifest

```json
{
  "name": "cronalytics",
  "label": "Cronalytics",
  "description": "Cost and operational observability for Hermes cron jobs",
  "icon": "Clock",
  "version": "1.1.0",
  "tab": {"path": "/cronalytics", "position": "end", "hidden": false},
  "slots": ["pre-main", "post-main"],
  "entry": "dist/index.js",
  "api": "plugin_api.py"
}
```

### 5.2 `/cronalytics` Tab

#### Hero Banner

Dictionary-style header with phonetic pronunciation (`/ˈkrɒn.əˌlɪt.ɪks/`), two definition lines, and the tagline **Observe. Measure. Optimize.** Left border accent in `var(--color-accent)`.

#### Sticky Toolbar

- **Outcome toggle** — `All | Success | Failure`
- **Mode toggle** — `All | Agent | No agent`
- **Day selector** — `7D | 30D | 90D` presets + custom input (max 365)
- **Refresh** — re-fetches summary and jobs
- **Sync Now** — triggers reconciliation scan

Progressive zoom-responsive wrapping: at high zoom levels, Refresh breaks away first, then custom+Go, then the entire DaySelector cluster.

#### Row 1 — Summary Board

- **Job Runs** — total run count in selected window vs. prior period delta (↑/↓ %).
- **Cost** — total `estimated_cost_usd` in amber `#f5a623`; vs-prior delta + ✓/✗ success/failure breakdown + wasted cost. Actual cost sub-line is suppressed until provider billing coverage is reliable. In Failure mode, headline flips to red and label changes to "Wasted".
- **Tokens** — total tokens in blue `#5b8def`; 3-row micro proportion bars (In, Out, Cached).
- **Pace** — aggregate `trend_monthly_total / nominal_monthly_total`; font-only color:
  - `< 1.0×` — green `#4ade80` (under nominal)
  - `< 2.0×` — neutral (on track)
  - `≥ 2.0×` — red `#ef4444` (over nominal)

All four cards are clickable and open educational modals.

#### Row 2 — Leader Board

Four spotlight cards derived live from `jobList`, icon accent `#ff5722`:
- **Top Runs** — highest `runs` job; `% of total runs` sub-line.
- **Top Cost** — highest `total_cost` job; amber headline `#f5a623`; `% of total cost` sub-line.
- **Top Tokens** — highest `total_tokens` job; blue headline `#5b8def`; `% of total tokens` sub-line.
- **Top Pace** — highest `projections.pace` job; font-colored via `paceColor()`. Surfaces the job most at risk of exceeding its nominal budget.

All four cards are clickable and open detail modals with job metadata.

#### Per-Model Breakdown

Proportional bar chart showing the top 5 models by estimated cost. Each row shows model name, proportional bar, cost in amber, and run count. Remaining models collapsed with "and N more."

#### Jobs Breakdown Table

Eight sortable columns: **Job**, **Runs**, **Avg Time**, **Total Cost**, **Avg Cost**, **Nominal/mo**, **Trend/mo**, **Pace**.

- **Job** — human-readable name from `jobs.json` (falls back to `job_id`). Shows `[No agent]` badge for script jobs.
- **Runs** — number of executions in the window.
- **Avg Time** — average duration per run.
- **Total Cost** — sum of `estimated_cost_usd`.
- **Avg Cost** — `total_cost / runs`.
- **Nominal/mo** — `avg_cost × scheduled_runs_30d` (what it *should* cost if run exactly on schedule).
- **Trend/mo** — `(total_cost / days_filter) × 30` (what it *will* cost if current pace continues).
- **Pace** — `trend / nominal`. Color-coded badge with background tint.

Clicking a row expands a detail panel (colSpan 8) showing:
- Token breakdown: total, in, out, cached.
- Success/failure split with cost attribution.
- Schedule metadata: human-readable schedule, last run time, model used, next run time.
- **See Runs** button opening the Job Detail Modal.

#### Job Detail Modal

Full run history for the selected job:
- 95% width, sticky headers
- Sortable by run time, cost, duration, success, model
- 200-run default limit (backend ceiling: 500)
- Mode column showing Agent vs No agent
- Inherits parent sort preference from Jobs Breakdown table

#### Educational Modals

Clicking any Summary Board card opens a contextual modal:
- **Pace modal** — explains Nominal vs Trend, shows proportional bars, defines color guide, includes formula.
- **Runs modal** — explains total runs, trend % calculation, window context.
- **Cost modal** — explains estimated vs actual cost, trend %, window context.
- **Tokens modal** — explains input/output/cached tokens, shows proportion bars, includes percentage breakdown.

Leader Board cards open job-specific detail modals with schedule, last run, model, and duration.

#### Empty State

If no runs exist for the selected window, the UI shows:
> "No jobs in last N days. Last sync: 2026-05-03 14:22:19 UTC"

If no data exists at all:
> "No cron jobs captured. Click Sync Now to backfill from state.db."

---

## 6. Standalone CLI

A terminal interface that mirrors the dashboard data without requiring a browser.

```
python -m cronalytics.cli <command> [--days N]
```

| Command | Output |
|---------|--------|
| `summary` | Headline runs, cost, tokens, trend arrow, cost-by-model table, **Leader Board** (top runs, cost, tokens, pace) |
| `jobs` | Per-job table with ID, runs, cost, tokens, pace |
| `runs --job ID` | Individual run history (time, duration, cost, tokens, model) |
| `models` | Per-model aggregate table |
| `trends` | Daily bar chart (ASCII) of cost + runs |
| `health` | Fact DB metadata, job count, last sync |

**Shared flag:** `--days N` (default 30, `0` = all time).

Formatting conventions:
- Cost: `$X.XX`
- Tokens: `K`/`M` suffixes
- Tables: monospace-aligned ASCII boxes matching `hermes insights` style

---

## 7. Formulas & Data Sources

### 7.1 Fixed-Window Projection Math

All trend calculations use the **user-selected filter window** as the denominator, not the actual data span.

```
daily_cost = total_cost / days_filter         # days_filter = 7, 30, 90, or all-time span
trend_30d  = daily_cost * 30
trend_90d  = daily_cost * 90
trend_1yr  = daily_cost * 365
```

**Why fixed-window?**
- Guarantees `Σ(per-job trend) == aggregate trend`.
- Prevents stale averages from jobs with sparse runs.
- Makes jobs comparable: same denominator, same time horizon.

### 7.2 Nominal (Schedule-Based) Projection

```
scheduled_runs_30d = count_occurrences(schedule_expr, now, now + 30 days)
nominal_30d        = avg_cost * scheduled_runs_30d
```

Uses `croniter` for cron expressions and simple `timedelta` math for interval schedules (`every N minutes`).

### 7.3 Pace

```
pace = trend_30d / nominal_30d
```

- `pace < 1.0` — actual spend is below scheduled expectation (under-running).
- `pace == 1.0` — actual spend matches scheduled expectation.
- `pace > 1.0` — actual spend exceeds scheduled expectation (over-running or drifting).

### 7.4 Drift Ratio

```
scheduled_in_window = count_occurrences(schedule_expr, now - observed_window, now)
drift_ratio         = observed_runs / scheduled_in_window
```

Drift answers: *"How many times did this job actually run, compared to how many times it was supposed to run?"*
- `drift == 1.0` — exactly on schedule.
- `drift > 1.0` — running more often than scheduled (retries, external triggers, interval overlap).
- `drift < 1.0` — running less often than scheduled (missed ticks, job disabled).

### 7.5 Aggregate Pace

```
nominal_monthly_total = Σ(nominal_30d across all jobs)
trend_monthly_total   = Σ(trend_30d across all jobs)
aggregate_pace        = trend_monthly_total / nominal_monthly_total
```

Because the math is fixed-window, the aggregate pace is always the exact sum of its parts.

### 7.6 Data Sources

| Data | Source File | Description |
|------|-------------|-------------|
| Session cost, tokens, model | `~/.hermes/state.db` (Hermes core) | Operational SQLite. Queried at ingestion time. |
| Job schedules, names | `~/.hermes/cron/jobs.json` (Hermes core) | Read-only at query time for name resolution and cron expression parsing. |
| Script job artifacts | `~/.hermes/cron/output/*.md` | No-agent job output files. Scanned for timestamps. |
| Derived analytics | `~/.hermes/plugins/cronalytics/facts.db` | Append-only fact DB owned by the plugin. |
| Sync watermark | `~/.hermes/plugins/cronalytics/watermark.json` | JSON file tracking last `ended_at` processed. |
| Pending queue | `~/.hermes/plugins/cronalytics/pending.jsonl` | Line-delimited JSON of sessions waiting for ingestion. |

---

## 8. Configuration

All values are hardcoded defaults in `config.py`. There is no user-editable configuration file yet (planned for v1.1).

```python
RETRY_DELAYS = [3.0, 8.0, 15.0]   # seconds before each worker attempt
JITTER_MAX   = 2.0                # random(0, 2.0) added to each delay
MAX_RETRIES  = 3                  # derived from len(RETRY_DELAYS)
```

Paths:
- `STATE_DB` = `~/.hermes/state.db`
- `FACT_DB` = `<plugin_dir>/facts.db`
- `WATERMARK_FILE` = `<plugin_dir>/watermark.json`
- `PENDING_FILE` = `<plugin_dir>/pending.jsonl`
- `OUTPUT_DIR` = `~/.hermes/cron/output`

---

## 9. Test Coverage

83 pytest tests covering:
- `facts.py` — schema creation, ingestion, aggregation queries, job_id parsing
- `scanner.py` — watermark I/O, session fetching, batch insert, script scanning
- `schedule.py` — cron expression parsing, projection math, edge cases
- `ingester.py` — hook handler, pending file ops, worker loop, retry logic
- `plugin_api.py` — all 7 API endpoints, response shapes, filter params

Run: `uv run pytest -q`

Lint/type: `uv run ruff check . && uv run mypy .`

---

## 10. Known Limitations

These are **intentional boundaries or acknowledged gaps**, not bugs.

1. **Wrapper-level success only.** The `success` boolean is derived from `end_reason` (`cron_complete` / `complete`). It tells you whether the agent *session* finished normally, not whether the *task* succeeded.
2. **Abandoned sessions are invisible.** The scanner filters `ended_at IS NOT NULL`. Cron sessions where the gateway crashed or the job got stuck are never ingested.
3. **No user-editable config file.** All tuning values are hardcoded in `config.py`.
4. **No periodic auto-sync.** The scanner only runs on plugin bootstrap and manual trigger.
5. **Job detail modal capped at 200 runs.** High-frequency jobs show full count in the table but drill-down is limited.
6. **Native `title` tooltips on table headers only.** Column headers use browser-native `title` for simple explanations. Custom tooltips were explored and reverted due to viewport-edge positioning complexity on iPad Safari.
7. **Mobile layout functional but not optimized.** The table uses horizontal scroll on narrow viewports.
8. **Focus trap deferred to v1.1.** Modal focus management works for typical usage but does not trap Tab cycles inside the modal.

---

*Version: 1.1.0*  
*Last updated: 2026-05-16*
