# Features — Cronalytics

> **Version:** 0.3.1
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
    ingested_at REAL DEFAULT (unixepoch())
);
```

Indexes: `job_id`, `run_time DESC`, `ingested_at`.
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

---

## 3. Reconciliation Scanner

### 3.1 What It Does

Backfills historical cron sessions from `state.db` into `facts.db` using a timestamp watermark to avoid duplicate work.

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
```

### 3.4 Why No Auto-Run on Dashboard Load or Periodic Timer?

These were considered but not implemented. The bootstrap scanner on plugin load covers the most common gap (gateway restart). The "Sync Now" button covers the rare case where a user wants an immediate backfill. Adding dashboard-load auto-run would require the frontend to call `/sync` on every visit, which is wasteful. A periodic 6-hour background timer is deferred to a future hardening pass.

---

## 4. Dashboard API

All endpoints are mounted at `/api/plugins/cronalytics/`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Fact DB health, total runs, unique jobs, last sync watermark |
| `/summary?days=N` | `GET` | Aggregated headline stats + schedule-aware projections |
| `/jobs?days=N` | `GET` | Per-job aggregates with projections |
| `/jobs/{job_id}/runs` | `GET` | Individual run history for a specific job |
| `/models?days=N` | `GET` | Per-model cost/token breakdown |
| `/trends?days=N` | `GET` | Daily cost + runs bars over time |
| `/sync` | `POST` | Trigger manual reconciliation scan |

All endpoints return JSON wrapped as `{"plugin": "cronalytics", ...}`.
The `days` parameter accepts `0` (all time) or `1–90`.

---

## 5. Dashboard UI

### 5.1 Manifest

```json
{
  "name": "cronalytics",
  "tab": {"path": "/cronalytics", "hidden": false},
  "slots": ["pre-main", "post-main"],
  "entry": "dist/index.js",
  "api": "plugin_api.py"
}
```

### 5.2 `/cronalytics` Tab

#### Summary Cards (top row)
- **Total Runs** — count of runs in the selected window.
- **Est. Cost** — sum of `estimated_cost_usd` with trend arrow (↑/↓/→) comparing to the previous period of equal length.
- **Tokens** — total tokens broken down as `In / Out / Cached`.
- **Pace** — aggregate `trend_monthly_total / nominal_monthly_total` with color coding:
  - `< 0.85` — cyan (under-spending vs schedule)
  - `0.85–1.15` — white (on track)
  - `1.15–1.50` — amber (warm)
  - `> 1.50` — red (over-spending)
- **Top Jobs** — single card with two stacked sections:
  - *Most Run* — job name + run count (no "Last X days" label; clean name+number).
  - *Highest Cost* — job name + cost in amber. Sections divided by thin rule.

#### Cost by Model
A simple list showing model name, run count, and total cost for the selected window.

#### Jobs Table

7 columns: **Job**, **Runs**, **Total Cost**, **Avg Cost**, **Nominal/mo**, **Trend/mo**, **Pace**.

- **Job** — human-readable name from `jobs.json` (falls back to truncated `job_id`).
- **Runs** — number of executions in the window.
- **Total Cost** — sum of `estimated_cost_usd`.
- **Avg Cost** — `total_cost / runs`.
- **Nominal/mo** — `avg_cost × scheduled_runs_30d` (what it *should* cost if run exactly on schedule).
- **Trend/mo** — `(total_cost / days_filter) × 30` (what it *will* cost if current pace continues).
- **Pace** — `trend / nominal`. Color-coded with background tint.

#### Expandable Detail Rows

Clicking a job row expands a detail panel (colSpan 7) showing:
- Token breakdown: total, in, out, cached.
- Schedule metadata: human-readable schedule, last run time, model used, next run time.
- Projections: Nominal, Trend, Pace, Drift.
- If the job has no schedule, shows "No schedule" and `—` for projections.

#### Controls
- **Day Selector** — 7D / 30D / 90D / All. Uniform solid borders.
- **Refresh** — fetches `summary` and `jobs` again.
- **Sync Now** — triggers `POST /sync` and shows last-sync timestamp.

#### Empty State
If no runs exist for the selected window, the UI shows a message like:
> "No cron jobs captured in the last 7 days. Last sync: 2026-05-03 14:22:19 UTC"

---

## 6. Standalone CLI

A terminal interface that mirrors the dashboard data without requiring a browser.

```
python -m cronalytics.cli <command> [--days N]
```

| Command | Output |
|---------|--------|
| `summary` | Headline runs, cost, tokens, trend arrow, cost-by-model table |
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
| Derived analytics | `~/.hermes/plugins/cronalytics/facts.db` | Append-only fact DB owned by the plugin. |
| Sync watermark | `~/.hermes/plugins/cronalytics/watermark.json` | JSON file tracking the last `ended_at` processed by the scanner. |
| Pending queue | `~/.hermes/plugins/cronalytics/pending.jsonl` | Line-delimited JSON of sessions waiting for ingestion. Survives restarts. |

---

## 8. Configuration

All values are hardcoded defaults in `config.py`. There is no user-editable configuration file yet.

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

---

## 9. Known Limitations

These are **intentional boundaries or acknowledged gaps**, not bugs.

1. **Wrapper-level success only.** The `success` boolean is derived from `end_reason` (`cron_complete` / `complete`). It tells you whether the agent *session* finished normally, not whether the *task* succeeded. A script that errors internally but returns a clean exit will show `success = true`.
2. **Abandoned sessions are invisible.** The scanner filters `ended_at IS NOT NULL`. Cron sessions where the gateway crashed, the process was killed, or the job got stuck forever are never ingested. There are no rows in the fact DB for them. This is by design (the fact DB stores *finished* runs), but it means the dashboard cannot show "jobs that started but never finished."
3. **No tests.** There is no test suite. The highest-ROI first test would be `_make_job_id()` parser coverage.
4. **No linting or type checking.** `ruff`, `mypy`, and `pyright` are not configured.
5. **No periodic auto-sync.** The scanner only runs on plugin bootstrap and manual trigger. A 6-hour background timer is planned but not implemented.
6. **Mobile layout unverified.** The UI has not been systematically tested on narrow viewports. The table is likely to overflow horizontally on phones.
7. **Native `title` tooltips only.** Custom tooltips were explored and reverted due to viewport-edge positioning complexity on iPad Safari.
8. **Per-run expansion in UI is missing.** The API exposes `/jobs/{id}/runs`, but the dashboard does not render individual run history.

---

*Version: 0.3.1*
*Last updated: 2026-05-06*