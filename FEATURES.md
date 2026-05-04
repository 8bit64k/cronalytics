# FEATURES.md — Cronalytics Feature Inventory

> **Version:** 0.3.0 (Polish — Badge, Labels, Detail Row)  
> **Source:** Derived from direct inspection of `/home/nick/builds/cronalytics/` as of 2026-05-03  
> **Status:** Living document — update before each release

---

## Legend

- ✅ **Implemented** — Code exists, functional, verified where noted
- ⚠️ **Partial / Bugged** — Code exists but has known defects or missing pieces
- 🚧 **Stub / Incomplete** — Skeleton exists, not wired or not functional
- ❌ **Planned / Missing** — Not yet implemented
- 📋 **Design-only** — Specified in DESIGN.md but no code written

---

## 1. Data Capture (Gateway-Side)

### 1.1 Hook Registration

| #     | Feature                                             | Status | Evidence                                     |
| ----- | --------------------------------------------------- | ------ | -------------------------------------------- |
| 1.1.1 | Registers `on_session_end` hook via `register(ctx)` | ✅      | `__init__.py` L12-18                         |
| 1.1.2 | Filters for `platform == "cron"` only               | ✅      | `ingester.py` L69                            |
| 1.1.3 | Ignores CLI chat sessions correctly                 | ✅      | Verified: `platform != "cron"` returns early |

### 1.2 Ingestion Pipeline

| #     | Feature                                               | Status | Evidence                                |
| ----- | ----------------------------------------------------- | ------ | --------------------------------------- |
| 1.2.1 | Non-blocking hook handler (immediate return)          | ✅      | `ingester.py` L56-89 — no DB IO in hook |
| 1.2.2 | Persists session_id to `pending.jsonl` before enqueue | ✅      | `ingester.py` L80, L96-104              |
| 1.2.3 | In-memory work queue with threading lock              | ✅      | `ingester.py` L27-28                    |
| 1.2.4 | Background worker thread (daemon)                     | ✅      | `ingester.py` L243-273                  |
| 1.2.5 | Crash recovery: replays `pending.jsonl` on startup    | ✅      | `ingester.py` L42-49, L138-167          |
| 1.2.6 | Queries `state.db` for session row by `id`            | ✅      | `ingester.py` L174-187                  |
| 1.2.7 | 3-attempt retry with exponential backoff + jitter     | ✅      | `ingester.py` L190-195, L221-231        |
| 1.2.8 | Drops event after max retries (logs warning)          | ✅      | `ingester.py` L234-239                  |
| 1.2.9 | Duplicate handling: `ON CONFLICT IGNORE`              | ✅      | `facts.py` L194-201                     |

### 1.3 Session Parsing

| #     | Feature                                                              | Status     | Evidence                                         |
| ----- | --------------------------------------------------------------------- | ---------- | ------------------------------------------------ |
| 1.3.1 | Parses `cron_{job_id}_{timestamp}` from `session_id`                  | ⚠️ **BUG** | `facts.py` L130-140 — see Section 10 Known Issues |
| 1.3.2 | Derives `job_id` from session token structure                       | ⚠️ **BUG** | Incorrectly includes datestamp in job_id         |
| 1.3.3 | Computes `duration_seconds` from `started_at` / `ended_at`          | ✅          | `facts.py` L178-183                              |
| 1.3.4 | Derives `success` boolean from `end_reason`                        | ✅          | `facts.py` L189-192                              |

---

## 2. Data Storage (Fact DB)

### 2.1 Schema

| #     | Feature                                           | Status | Evidence                                |
| ----- | ------------------------------------------------- | ------ | --------------------------------------- |
| 2.1.1 | `cron_runs` table with all design columns         | ✅      | `facts.py` L26-57                       |
| 2.1.2 | Indexes: `job_id`, `run_time DESC`, `ingested_at` | ✅      | `facts.py` L52-57                       |
| 2.1.3 | WAL mode enabled                                  | ✅      | `facts.py` L114                         |
| 2.1.4 | `ON CONFLICT(session_id) DO NOTHING`              | ✅      | `facts.py` L194                         |
| 2.1.5 | Append-only (no UPDATE/DELETE)                    | ✅      | Confirmed: no UPDATE/DELETE in codebase |

### 2.2 Fields Ingested

| Field                | From state.db         | Status |
| -------------------- | --------------------- | ------ |
| `session_id`         | `id`                  | ✅      |
| `job_id`             | Parsed from `id`      | ⚠️ bug |
| `run_time`           | `started_at`          | ✅      |
| `ended_at`           | `ended_at`            | ✅      |
| `duration_seconds`   | Computed              | ✅      |
| `model`              | `model`               | ✅      |
| `input_tokens`       | `input_tokens`        | ✅      |
| `output_tokens`      | `output_tokens`       | ✅      |
| `reasoning_tokens`   | `reasoning_tokens`    | ✅      |
| `cache_read_tokens`  | `cache_read_tokens`   | ✅      |
| `cache_write_tokens` | `cache_write_tokens`  | ✅      |
| `estimated_cost_usd` | `estimated_cost_usd`  | ✅      |
| `actual_cost_usd`    | `actual_cost_usd`     | ✅      |
| `cost_status`        | `cost_status`         | ✅      |
| `cost_source`        | `cost_source`         | ✅      |
| `billing_provider`   | `billing_provider`    | ✅      |
| `api_call_count`     | `api_call_count`      | ✅      |
| `message_count`      | `message_count`       | ✅      |
| `tool_call_count`    | `tool_call_count`     | ✅      |
| `end_reason`         | `end_reason`          | ✅      |
| `success`            | Derived               | ✅      |
| `ingested_at`        | `unixepoch()` default | ✅      |

---

## 3. Reconciliation Scanner

### 3.1 Core Scanner Logic

| #     | Feature                                                            | Status | Evidence              |
| ----- | ------------------------------------------------------------------ | ------ | --------------------- |
| 3.1.1 | Queries `state.db` for `source='cron'` with `ended_at > watermark` | ✅      | `scanner.py` L58-84   |
| 3.1.2 | Batch inserts into fact DB with dedup check                        | ✅      | `scanner.py` L91-110  |
| 3.1.3 | Updates watermark to `max(ended_at)` after batch                   | ✅      | `scanner.py` L142-148 |
| 3.1.4 | Watermark persisted as JSON                                        | ✅      | `scanner.py` L42-51   |
| 3.1.5 | Returns sync summary (inserted, skipped, elapsed)                  | ✅      | `scanner.py` L117-163 |

### 3.2 Scanner Integration

| #     | Feature                                      | Status | Evidence                               |
| ----- | -------------------------------------------- | ------ | -------------------------------------- |
| 3.2.1 | Triggers on explicit API call (`POST /sync`) | ❌      | `plugin_api.py` has no sync POST route |
| 3.2.2 | Auto-runs on first dashboard load            | ❌      | Not implemented                        |
| 3.2.3 | Periodic background run (6h default)         | ❌      | Not implemented                        |
| 3.2.4 | Logs summary after sync                      | ✅      | `scanner.py` L151-155                  |

### 3.3 Scanner Import Safety

| #     | Feature                                   | Status | Evidence                                                                                                                                  |
| ----- | ----------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 3.3.1 | Importlib-safe loading from dashboard API | ❌      | `scanner.py` uses relative imports (`from . import facts`) — cannot be dynamically loaded like `plugin_api.py` does with `_load_module()` |
| 3.3.2 | Scanner callable from gateway context     | ✅      | Works as package import when loaded normally                                                                                              |

---

## 4. Dashboard API (FastAPI)

### 4.1 Endpoints

| Endpoint                                        | Method | Status | Evidence                                         |
| ----------------------------------------------- | ------ | ------ | ----------------------------------------------------------------- |
| `/api/plugins/cronalytics/health`             | GET    | ✅      | `dashboard/plugin_api.py` L83-95                                  |
| `/api/plugins/cronalytics/summary?days=N`     | GET    | ✅      | Returns `nominal_monthly_total`, `trend_monthly_total`, `pace`      |
| `/api/plugins/cronalytics/jobs?days=N`          | GET    | ✅      | Per-job projections include `pace`                                |
| `/api/plugins/cronalytics/jobs/{job_id}/runs`   | GET    | ✅      | `dashboard/plugin_api.py` L119-134                                |
| `/api/plugins/cronalytics/models?days=N`        | GET    | ✅      | `dashboard/plugin_api.py` L137-147                                |
| `/api/plugins/cronalytics/trends?days=N`        | GET    | ✅      | `dashboard/plugin_api.py` L150-160                                |
| `/api/plugins/cronalytics/sync`                 | POST   | ❌      | **Missing** — PLAN.md Phase 2 says this should exist but does not |

### 4.2 Endpoint Details

| #     | Feature                                                | Status     | Evidence                                                                                                                                                                            |
| ----- | ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.2.1 | `days` parameter with bounds `1 <= days <= 90`         | ✅          | `plugin_api.py` L100, L108, etc.                                                                                                                                                    |
| 4.2.2 | Returns 404 for missing job_id                         | ✅          | `plugin_api.py` L127                                                                                                                                                                |
| 4.2.3 | Wraps response with `{"plugin": "cronalytics", ...}` | ✅          | `plugin_api.py` L71-73                                                                                                                                                              |
| 4.2.4 | Fixed-window projection math (selected days as denominator) | ✅     | `schedule.py` L136-141; `plugin_api.py` `/summary` sums per-job projections with consistent fixed window                                                                   |
| 4.2.5 | Aggregate pace = trend_total / nominal_total           | ✅          | `plugin_api.py` `/summary` L39-42 (new implementation)                                                                                                                             |
| 4.2.6 | Per-job pace = trend_30d / projected_cost_30d          | ✅          | `schedule.py` L152-156                                                                                                                                                              |
| 4.2.7 | `_get_status()` reads watermark for health               | ⚠️ **BUG** | Reads keys `last_watermark`, `last_scan_ts`, `rows_synced` but scanner.py writes `last_ended_at`, `last_sync` — mismatch means sync metadata in health response is empty/misleading |
| 4.2.8 | Dynamic importlib loading of sibling modules           | ✅          | `plugin_api.py` L29-39, L42-48                                                                                                                                                      |

---

## 5. Dashboard UI (React via HERMES_PLUGIN_SDK)

### 5.1 Manifest & Registration

| #     | Feature                      | Status | Evidence                                           |
| ----- | ---------------------------- | ------ | -------------------------------------------------- |
| 5.1.1 | Tab route `/cronalytics`     | ✅      | `dashboard/manifest.json` L8                       |
| 5.1.2 | Header-right slot badge       | ✅      | `dashboard/manifest.json` L12, `index.js` L158-181 |
| 5.1.3 | Entry bundle `dist/index.js`  | ✅      | `dashboard/manifest.json` L13                      |
| 5.1.4 | API module reference          | ✅      | `dashboard/manifest.json` L14                      |

### 5.2 Tab Content (`/cronalytics`)

| #     | Feature                                                            | Status | Evidence                                 |
| ----- | ------------------------------------------------------------------ | ------ | ---------------------------------------- |
| 5.2.1 | Summary cards: Total Runs, Cost (estimated), Tokens, Pace | ✅ | `index.js` — 4-card grid |
| 5.2.2 | Pace card: colored ratio with Nominal + Trend sub-lines | ✅ | `index.js` — `paceColor(s.pace)` |
| 5.2.3 | Cost trend arrow (↑/↓/→) with previous period                    | ✅      | `index.js`                               |
| 5.2.4 | Cost by model list                                               | ✅      | `index.js`                               |
| 5.2.5 | Jobs table: Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace | ✅ | `index.js` |
| 5.2.6 | Pace column: colored text + background tint (cyan/white/amber/red) | ✅      | `paceColor()` + `paceBg()` helpers       |
| 5.2.7 | Expandable detail rows (colSpan 7)                                 | ✅      | `index.js` L420+                         |
| 5.2.8 | Detail row content: Tokens, single-line cron schedule (Last run / Next run) | ✅ | `index.js` L440+ |
| 5.2.9 | Native `title` tooltips on table headers                             | ✅      | `index.js` L370-374                      |
| 5.2.10 | Sync Now button in Jobs card                                        | ✅      | `index.js` L348-352                       |
| 5.2.11 | Empty state message                                                 | ✅      | `index.js`                               |
| 5.2.12 | Sortable columns                                                    | ❌      | Not implemented                          |
| 5.2.13 | Top 5 most expensive jobs highlighted                                  | ❌      | Not implemented                          |
| 5.2.14 | Mobile layout                                                        | ⚠️      | Unverified on small screens              |

### 5.3 Header & Controls

| #     | Feature                                                     | Status | Evidence                         |
| ----- | ------------------------------------------------------------ | ------ | -------------------------------- |
| 5.3.1 | Shared PageHeader: title + afterTitle badge + end slot      | ✅      | `index.js` useEffect header setup |
| 5.3.2 | Day selector: 7D/30D/90D/All — uniform solid borders         | ✅      | `DaySelector` component            |
| 5.3.3 | Refresh button in header right                               | ✅      | `Button` in `setEnd()`              |
| 5.3.4 | Header slot survives route changes (useEffect, not uLE)      | ✅      | Race-condition fix documented       |

### 5.4 Architecture Divergence from Design

| Design Spec                                      | Actual                                         | Rationale                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Slots: `cron:top`, `cron:bottom`, `header-right` | Slots: `header-right`, standalone tab         | `/cron` built-in collision — pragmatic pivot to standalone tab acceptable for MVP |
| Tab `hidden: true`                               | Tab `hidden: false`                            | Route changed from `/cron` to `/cronalytics`                                                             |

---

## 6. Configuration & Paths

| #   | Feature                                             | Status | Evidence                                |
| --- | --------------------------------------------------- | ------ | --------------------------------------- |
| 6.1 | `RETRY_DELAYS = [3.0, 8.0, 15.0]`                   | ✅      | `config.py` L18                         |
| 6.2 | `JITTER_MAX = 2.0`                                  | ✅      | `config.py` L19                         |
| 6.3 | Fact DB inside plugin dir (`.gitignore`d)           | ✅      | `config.py` L34-35, `.gitignore` L10-11 |
| 6.4 | Watermark inside plugin dir (`.gitignore`d)          | ✅      | `config.py` L38, `.gitignore` L14       |
| 6.5 | Pending file inside plugin dir (`.gitignore`d)      | ✅      | `config.py` L41, `.gitignore` L17       |
| 6.6 | Checkpoint uses real POSIX home (not `Path.home()`) | ✅      | `checkpoint.py` L44-47                  |

---

## 7. Quality & Tooling

| #    | Feature                                       | Status | Evidence                                 |
| ---- | --------------------------------------------- | ------ | ---------------------------------------- |
| 7.1  | Python syntax check (`python3 -m compileall`) | ✅      | Passed clean — 2026-04-30                |
| 7.2  | No SQL injection (parameterized queries)      | ✅      | All queries use `?` placeholders         |
| 7.3  | No tests (unit, integration, or e2e)          | ❌      | No test files found                      |
| 7.4  | No type checking (`mypy` / `pyright`)         | ❌      | Not configured                           |
| 7.5  | No linting (`ruff` / `flake8`)                | ❌      | Not configured                           |
| 7.6  | README                                        | ❌      | Not present                              |
| 7.7  | CHANGELOG                                     | ❌      | Not present                              |
| 7.8  | CONTRIBUTING                                  | ❌      | Not present                              |
| 7.9  | `.gitignore` misses `*.db-wal` and `*.db-shm` | ⚠️      | Repo currently dirty with these files    |
| 7.10 | Git repo at `/home/nick/builds/cronalytics`  | ✅      | Branch `master`, commit `6c4fefe`       |
| 7.11 | Deployed copy synced with build dir           | ✅      | diff clean (excluding runtime artifacts) |

---

## 8. Fixed-Window Projection Math (New in 0.2.0)

### 8.1 Overview

Cronalytics now uses **fixed-window projections** rather than data-span denominators. When a user selects "7D", all math uses exactly 7 days as the denominator.

### 8.2 Per-Job Projections (`schedule.py`)

| Field | Formula | Example (7D, $1.77 total, 7 runs) |
| ----- | ------- | ----------------------------------- |
| `daily_cost` | `total_cost / days_filter` | `$1.77 / 7 = $0.253` |
| `trend_30d` | `daily_cost * 30` | `$0.253 * 30 = $7.57` |
| `nominal_30d` | `avg_cost * scheduled_runs_30d` | `$0.2523 * 30 = $7.57` |
| `pace` | `trend_30d / nominal_30d` | `7.57 / 7.57 = 1.0×` |

### 8.3 Aggregate Projections (`plugin_api.py`)

| Field | Formula | Example (7D, all jobs) |
| ----- | ------- | ---------------------- |
| `nominal_monthly_total` | `Σ nominal_30d across all jobs` | `$18.96` |
| `trend_monthly_total` | `Σ trend_30d across all jobs` | `$19.96` |
| `pace` | `trend_monthly_total / nominal_monthly_total` | `19.96 / 18.96 = 1.05×` |

**Algebraic invariant:** `Σ trend_30d = trend_monthly_total` and `Σ nominal_30d = nominal_monthly_total`.

### 8.4 Previous-Behavior Comparison

| Metric | Before (data-span) | After (fixed-window) | Invariant Fixed |
| ------ | ------------------- | --------------------- | ---------------- |
| 7D summary pace | $23.50/mo (div by 5.9 days) | $19.96/mo (div by 7 days) | ✅ Sum of rows = aggregate |
| Per-job trend | Inconsistent (rows vs summary diff) | Consistent | ✅ Row-level sums to total |
| Zero-occurrence jobs | Missing from trend | Explicitly $0 nominal | ✅ Preserved in aggregation |

---

## 9. Near-Term Planned Features

| # | Feature                                                       | Status | Notes |
| - | ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **Success/failure cost split in dashboard**                   | 📋     | `success` field exists in DB but is **not surfaced** in `/summary` or `/jobs` aggregates. Requires SQL changes in `facts.py` (`SUM(CASE WHEN success=1 ...)` + inverse) and frontend two-tone display. |
| 9.2 | **Abandoned/hanging session visibility**                      | 📋     | Scanner filters `ended_at IS NOT NULL`, so 7 cron sessions with `ended_at = NULL` are invisible in fact DB. These may represent true failures (gateway crash, killed process, stuck job). Consider a separate "abandoned" tracker. |
| 9.3 | **Per-job token columns in jobs table**                       | 📋     | Summary shows total tokens, but jobs table has no attribution. Need `SUM(input_tokens)` / `SUM(output_tokens)` added to `query_jobs()` and a compact column in the frontend table. |
| 9.4 | **Cost projections + Pace (30d / 90d / 1yr) + frequency drift** | ✅      | **IMPLEMENTED** — Fixed-window math, per-job + aggregate pace, color-coded indicators, expandable detail rows. See Section 8. |
| 9.5 | **CLI: `cronalytics` standalone command**                     | 🚧     | Prototype planned — mirrors `hermes insights` format with Rich tables. `--days` flag, subcommands: `summary`, `trends`, `models`, `runs`, `health`. Nick calls this "most value + polish for V1.0 release". |

---

## 10. Known Issues

| #   | Issue                                                             | Severity    | File.Line                        | Details                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------- | ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | **Job ID parser treats datestamp as part of job_id**              | 🔴 Critical | `facts.py` L130-140              | `cron_841aee933270_20260429_222224` → `841aee933270_20260429`. Each run of the same job appears as a different job. Breaks per-job aggregation, cost ranking, and trend analysis. Root cause: `split("_")` + `join(parts[1:-1])` drops only the last segment. |
| 10.2 | **Health sync metadata key mismatch**                             | 🟡 Medium   | `dashboard/plugin_api.py` L54-68 | `_get_status()` reads `last_watermark`, `last_scan_ts`, `rows_synced` but `scanner.py` writes `last_ended_at`, `last_sync`. Result: health endpoint reports null/misleading sync metadata even after successful sync.                                         |
| 10.3 | **POST /sync endpoint missing**                                   | 🟡 Medium   | `dashboard/plugin_api.py`        | PLAN.md Phase 2 lists this as implemented but only a `_get_status()` helper exists; no route. Scanner `run_sync()` exists but isn't wired to API.                                                                                                             |
| 10.4 | **Scanner not importlib-safe**                                    | 🟡 Medium   | `scanner.py` L21-22              | Uses `from . import facts` and `from .logger import logger`, which fail under dashboard server's standalone `importlib.util` loading. Blocks calling scanner from API.                                                                                        |
| 10.5 | **No tests**                                                      | 🟡 Medium   | Entire repo                      | No test files, no test runner config. Parser bug (10.1) would have been caught by a single unit test.                                                                                                                                                          |
| 10.6 | **.gitignore omits WAL/SHM**                                      | 🟢 Low      | `.gitignore`                     | Should add `*.db-wal` and `*.db-shm` to keep repo clean.                                                                                                                                                                                                      |
| 10.7 | **Design docs still describe 3-slot model**                       | 🟢 Low      | `DESIGN.md`                      | Manifest and code diverged to standalone tab + header-right. Docs should reflect actual architecture.                                                                                                                                                         |
| 10.8 | **scanner.py watermark path defaults to `config.WATERMARK_FILE`**   | 🟡 Medium   | `scanner.py`                     | Scanner reads/writes watermark to plugin dir, but `plugin_api.py` reads from `_config_mod.WATERMARK_FILE` — paths align but integration gap means scanner state and API health are decoupled.                                                                 |
| 10.9 | **Tooltips on iPad**                                              | 🟢 Low      | `index.js`                       | `title` attributes show on hover (desktop) but may not on tap-and-hold on iPad Safari. Consider modal or custom tooltip component.                                                                                                                         |

---

## 11. Recommendations by Priority

### 🔴 Critical (fix before next release)

1. **Fix `_make_job_id()`** to extract stable job ID. Session IDs are `cron_<job_id>_<YYYYMMDD>_<HHMMSS>`. The timestamp is always 2 underscore-separated segments at the end. Parser should drop the final 2 segments, not just the last 1.
2. **Rebuild or migrate fact DB** after parser fix — existing rows have wrong `job_id` values.

### 🟡 High (significant user impact)

3. **Add `POST /sync` endpoint** in `dashboard/plugin_api.py` that calls `scanner.run_sync()`.
4. **Refactor `scanner.py`** to be importlib-safe (dynamic loading or absolute paths) so the API can import it.
5. **Fix `_get_status()` key names** to match `scanner.py` watermark schema, or align schemas.
6. **Add tests** starting with `_make_job_id()` parser — highest ROI given bug 10.1.

### 🟢 Medium (quality of life)

7. Add `*.db-wal` and `*.db-shm` to `.gitignore`.
8. Update DESIGN.md to reflect actual slot architecture (`/cronalytics` tab vs `cron:top`/`cron:bottom`).
9. Implement scanner auto-run on first dashboard visit and periodic background sync.
10. Phase 6: README, CHANGELOG, install instructions.
11. Custom tooltip component for iPad tap-and-hold.

---

## 12. Design vs. Implementation Compliance Matrix

| Plan Phase                | Status                            | Plan Claims      | Reality                                                                                                                  | Δ      |
| ------------------------- | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Phase 0: Skeleton**     | ✅ Complete                        | 4/4 deliverables | All met                                                                                                                  | —      |
| **Phase 1: Ingestion**    | ✅ Complete                        | 8/8 deliverables | All met                                                                                                                  | —      |
| **Phase 1.5: Checkpoint** | ✅ Complete                        | 1/1 deliverable  | Met                                                                                                                      | —      |
| **Phase 2: Scanner**      | 🟡 Core done, integration missing | 8 deliverables   | 6/8: backfill works, watermark works, but `/sync` endpoint not wired, auto-run not implemented, periodic not implemented | 2 gaps |
| **Phase 3: API**          | ✅ Complete                        | 7/7 endpoints    | 6/7 implemented (missing POST /sync)                                                                                     | 1 gap  |
| **Phase 4: Frontend**     | 🟡 MVP cut — Pace redesign landed  | 9 deliverables   | 8/9: tab renders, header badge works, data loads, empty state, sortable missing — Pace redesign adds 5.2.1-5.2.11       | 1 gap  |
| **Phase 5: Hardening**    | 🟡 Partial                        | 8 tasks          | 2/8: importlib fix done, route collision fixed; rest untested/unimplemented                                              | 6 gaps |
| **Phase 6: Docs**         | ❌ Not started                     | 6 tasks          | 0/6                                                                                                                      | 6 gaps |
