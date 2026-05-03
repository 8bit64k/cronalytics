# # Kimi 2.6

# FEATURES.md — Cronalytics Feature Inventory

> **Version:** 0.1.0 MVP  
> **Source:** Derived from direct inspection of `/home/nick/builds/cronalytics/` as of 2026-04-30  
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

| #     | Feature                                                    | Status     | Evidence                                         |
| ----- | ---------------------------------------------------------- | ---------- | ------------------------------------------------ |
| 1.3.1 | Parses `cron_{job_id}_{timestamp}` from `session_id`       | ⚠️ **BUG** | `facts.py` L130-140 — see Section 5 Known Issues |
| 1.3.2 | Derives `job_id` from session token structure              | ⚠️ **BUG** | Incorrectly includes datestamp in job_id         |
| 1.3.3 | Computes `duration_seconds` from `started_at` / `ended_at` | ✅          | `facts.py` L178-183                              |
| 1.3.4 | Derives `success` boolean from `end_reason`                | ✅          | `facts.py` L189-192                              |

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

| Endpoint                                        | Method | Status | Evidence                                                          |
| ----------------------------------------------- | ------ | ------ | ----------------------------------------------------------------- |
| `/api/plugins/cronalytics/health`             | GET    | ✅      | `dashboard/plugin_api.py` L83-95                                  |
| `/api/plugins/cronalytics/summary?days=N`     | GET    | ✅      | `dashboard/plugin_api.py` L98-103                                 |
| `/api/plugins/cronalytics/jobs?days=N`        | GET    | ✅      | `dashboard/plugin_api.py` L106-116                                |
| `/api/plugins/cronalytics/jobs/{job_id}/runs` | GET    | ✅      | `dashboard/plugin_api.py` L119-134                                |
| `/api/plugins/cronalytics/models?days=N`      | GET    | ✅      | `dashboard/plugin_api.py` L137-147                                |
| `/api/plugins/cronalytics/trends?days=N`      | GET    | ✅      | `dashboard/plugin_api.py` L150-160                                |
| `/api/plugins/cronalytics/sync`               | POST   | ❌      | **Missing** — PLAN.md Phase 2 says this should exist but does not |

### 4.2 Endpoint Details

| #     | Feature                                                | Status     | Evidence                                                                                                                                                                            |
| ----- | ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.2.1 | `days` parameter with bounds `1 <= days <= 90`         | ✅          | `plugin_api.py` L100, L108, etc.                                                                                                                                                    |
| 4.2.2 | Returns 404 for missing job_id                         | ✅          | `plugin_api.py` L127                                                                                                                                                                |
| 4.2.3 | Wraps response with `{"plugin": "cronalytics", ...}` | ✅          | `plugin_api.py` L71-73                                                                                                                                                              |
| 4.2.4 | `_get_status()` reads watermark for health             | ⚠️ **BUG** | Reads keys `last_watermark`, `last_scan_ts`, `rows_synced` but scanner.py writes `last_ended_at`, `last_sync` — mismatch means sync metadata in health response is empty/misleading |
| 4.2.5 | Dynamic importlib loading of sibling modules           | ✅          | `plugin_api.py` L29-39, L42-48                                                                                                                                                      |

---

## 5. Dashboard UI (React via HERMES_PLUGIN_SDK)

### 5.1 Manifest & Registration

| #     | Feature                      | Status | Evidence                                           |
| ----- | ---------------------------- | ------ | -------------------------------------------------- |
| 5.1.1 | Tab route `/cronalytics`   | ✅      | `dashboard/manifest.json` L8                       |
| 5.1.2 | Header-right slot badge      | ✅      | `dashboard/manifest.json` L12, `index.js` L158-181 |
| 5.1.3 | Entry bundle `dist/index.js` | ✅      | `dashboard/manifest.json` L13                      |
| 5.1.4 | API module reference         | ✅      | `dashboard/manifest.json` L14                      |

### 5.2 Tab Content (`/cronalytics`)

| #     | Feature                                                         | Status | Evidence                                 |
| ----- | --------------------------------------------------------------- | ------ | ---------------------------------------- |
| 5.2.1 | Summary cards: Total Runs, Est. Cost, Tokens                    | ✅      | `index.js` L60-92                        |
| 5.2.2 | Cost trend arrow (↑/↓/→) with previous period                   | ✅      | `index.js` L79-82                        |
| 5.2.3 | Cost by model list                                              | ✅      | `index.js` L94-111                       |
| 5.2.4 | Jobs table: Job ID, Runs, Total Cost, Avg Cost, Last Run, Model | ✅      | `index.js` L114-154                      |
| 5.2.5 | Empty state message                                             | ✅      | `index.js` L121-123                      |
| 5.2.6 | Sortable columns                                                | ❌      | PLAN.md Phase 4 noted as not implemented |
| 5.2.7 | Top 5 most expensive jobs highlighted                           | ❌      | PLAN.md Phase 4 noted as not implemented |
| 5.2.8 | Click row to expand last 5 runs                                 | ❌      | PLAN.md Phase 4 noted as not implemented |
| 5.2.9 | Mobile layout                                                   | ❌      | PLAN.md Phase 4 noted as not verified    |

### 5.3 Header-Right Badge

| #     | Feature                                 | Status | Evidence            |
| ----- | --------------------------------------- | ------ | ------------------- |
| 5.3.1 | Polls `/health` every 30s               | ✅      | `index.js` L167-171 |
| 5.3.2 | Shows total run count or fallback label | ✅      | `index.js` L177-180 |

### 5.4 Architecture Divergence from Design

| Design Spec                                      | Actual                                         | Rationale                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Slots: `cron:top`, `cron:bottom`, `header-right` | Slots: `header-right`, `pre-main`, `post-main` | `/cron` built-in collision — pragmatic pivot to standalone tab acceptable for MVP but should be documented |
| Tab `hidden: true`                               | Tab `hidden: false`                            | Route changed from `/cron` to `/cronalytics`                                                             |

---

## 6. Configuration & Paths

| #   | Feature                                             | Status | Evidence                                |
| --- | --------------------------------------------------- | ------ | --------------------------------------- |
| 6.1 | `RETRY_DELAYS = [3.0, 8.0, 15.0]`                   | ✅      | `config.py` L18                         |
| 6.2 | `JITTER_MAX = 2.0`                                  | ✅      | `config.py` L19                         |
| 6.3 | Fact DB inside plugin dir (`.gitignore`d)           | ✅      | `config.py` L34-35, `.gitignore` L10-11 |
| 6.4 | Watermark inside plugin dir (`.gitignore`d)         | ✅      | `config.py` L38, `.gitignore` L14       |
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
| 7.9  | `.gitignore` misses `*.db-wal` and `*.db-shm` | ⚠️     | Repo currently dirty with these files    |
| 7.10 | Git repo at `/home/nick/builds/cronalytics` | ✅      | Branch `main`, commit `3e55493`          |
| 7.11 | Deployed copy synced with build dir           | ✅      | diff clean (excluding runtime artifacts) |

---

## 8. Known Issues

| #   | Issue                                                             | Severity    | File.Line                        | Details                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------- | ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | **Job ID parser treats datestamp as part of job_id**              | 🔴 Critical | `facts.py` L130-140              | `cron_841aee933270_20260429_222224` → `841aee933270_20260429`. Each run of the same job appears as a different job. Breaks per-job aggregation, cost ranking, and trend analysis. Root cause: `split("_")` + `join(parts[1:-1])` drops only the last segment. |
| 8.2 | **Health sync metadata key mismatch**                             | 🟡 Medium   | `dashboard/plugin_api.py` L54-68 | `_get_status()` reads `last_watermark`, `last_scan_ts`, `rows_synced` but `scanner.py` writes `last_ended_at`, `last_sync`. Result: health endpoint reports null/misleading sync metadata even after successful sync.                                         |
| 8.3 | **POST /sync endpoint missing**                                   | 🟡 Medium   | `dashboard/plugin_api.py`        | PLAN.md Phase 2 lists this as implemented but only a `_get_status()` helper exists; no route. Scanner `run_sync()` exists but isn't wired to API.                                                                                                             |
| 8.4 | **Scanner not importlib-safe**                                    | 🟡 Medium   | `scanner.py` L21-22              | Uses `from . import facts` and `from .logger import logger`, which fail under dashboard server's standalone `importlib.util` loading. Blocks calling scanner from API.                                                                                        |
| 8.5 | **No tests**                                                      | 🟡 Medium   | Entire repo                      | No test files, no test runner config. Parser bug (8.1) would have been caught by a single unit test.                                                                                                                                                          |
| 8.6 | **.gitignore omits WAL/SHM**                                      | 🟢 Low      | `.gitignore`                     | Should add `*.db-wal` and `*.db-shm` to keep repo clean.                                                                                                                                                                                                      |
| 8.7 | **Design docs still describe 3-slot model**                       | 🟢 Low      | `DESIGN.md`                      | Manifest and code diverged to standalone tab + header-right. Docs should reflect actual architecture.                                                                                                                                                         |
| 8.8 | **scanner.py watermark path defaults to `config.WATERMARK_FILE`** | 🟡 Medium   | `scanner.py`                     | Scanner reads/writes watermark to plugin dir, but `plugin_api.py` reads from `_config_mod.WATERMARK_FILE` — paths align but integration gap means scanner state and API health are decoupled.                                                                 |

---

## 9. Design vs. Implementation Compliance Matrix

| Plan Phase                | Status                            | Plan Claims      | Reality                                                                                                                  | Δ      |
| ------------------------- | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| **Phase 0: Skeleton**     | ✅ Complete                        | 4/4 deliverables | All met                                                                                                                  | —      |
| **Phase 1: Ingestion**    | ✅ Complete                        | 8/8 deliverables | All met                                                                                                                  | —      |
| **Phase 1.5: Checkpoint** | ✅ Complete                        | 1/1 deliverable  | Met                                                                                                                      | —      |
| **Phase 2: Scanner**      | 🟡 Core done, integration missing | 8 deliverables   | 6/8: backfill works, watermark works, but `/sync` endpoint not wired, auto-run not implemented, periodic not implemented | 2 gaps |
| **Phase 3: API**          | ✅ Complete                        | 7/7 endpoints    | 6/7 implemented (missing POST /sync)                                                                                     | 1 gap  |
| **Phase 4: Frontend**     | 🟡 MVP cut                        | 9 deliverables   | 5/9: tab renders, header badge works, data loads, empty state handled; sort, expand, highlight, mobile — undone          | 4 gaps |
| **Phase 5: Hardening**    | 🟡 Partial                        | 8 tasks          | 2/8: importlib fix done, route collision fixed; rest untested/unimplemented                                              | 6 gaps |
| **Phase 6: Docs**         | ❌ Not started                     | 6 tasks          | 0/6                                                                                                                      | 6 gaps |

---

## 10. Recommendations by Priority

### 🔴 Critical (fix before next release)

1. **Fix `_make_job_id()`** to extract stable job ID. Session IDs are `cron_<job_id>_<YYYYMMDD>_<HHMMSS>`. The timestamp is always 2 underscore-separated segments at the end. Parser should drop the final 2 segments, not just the last 1.
2. **Rebuild or migrate fact DB** after parser fix — existing rows have wrong `job_id` values.

### 🟡 High (significant user impact)

3. **Add `POST /sync` endpoint** in `dashboard/plugin_api.py` that calls `scanner.run_sync()`.
4. **Refactor `scanner.py`** to be importlib-safe (dynamic loading or absolute paths) so the API can import it.
5. **Fix `_get_status()` key names** to match `scanner.py` watermark schema, or align schemas.
6. **Add tests** starting with `_make_job_id()` parser — highest ROI given bug 8.1.

### 🟢 Medium (quality of life)

7. Add `*.db-wal` and `*.db-shm` to `.gitignore`.
8. Update DESIGN.md to reflect actual slot architecture (`/cronalytics` tab vs `cron:top`/`cron:bottom`).
9. Implement scanner auto-run on first dashboard visit and periodic background sync.
10. Phase 6: README, CHANGELOG, install instructions.

## 9. Near-Term Planned Features

| #     | Feature                                                       | Status | Notes |
| ----- | ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 9.1   | **Success/failure cost split in dashboard**                   | 📋     | `success` field exists in DB but is **not surfaced** in `/summary` or `/jobs` aggregates. Requires SQL changes in `facts.py` (`SUM(CASE WHEN success=1 ...)` + inverse) and frontend two-tone display. See PLAN.md Phase 4.5. |
| 9.2   | **Abandoned/hanging session visibility**                      | 📋     | Scanner filters `ended_at IS NOT NULL`, so 7 cron sessions with `ended_at = NULL` are invisible in fact DB. These may represent true failures (gateway crash, killed process, stuck job). Consider a separate "abandoned" tracker or scanner option. |
| 9.3   | **Per-job token columns in jobs table**                       | 📋     | Summary shows total tokens, but jobs table has no attribution. Need `SUM(input_tokens)` / `SUM(output_tokens)` added to `query_jobs()` and a compact column in the frontend table. See PLAN.md Phase 4.6. |
| 9.4   | **Cost projections (30d / 90d / 1yr) + frequency drift**        | 📋     | Rear-view metric is useful; forward-looking budget is better. Augment `query_jobs()` with `scheduled_runs_{horizon}` and `projected_cost_{horizon}` using cron parser (e.g. `croniter`). Expose "Projected monthly spend" summary card and per-job drift ratio. See PLAN.md Phase 4.7. |

### 9.1 Design Context — Why the split matters

The `success` boolean is derived from `end_reason` in `facts.py` L189-192: `cron_complete`/`complete` → `1`, else `0`. However:

- **In state.db:** 41 cron sessions have `end_reason = "cron_complete"`, 7 have `end_reason = NULL`.
- **In fact.db:** The 7 NULL sessions are **absent** because the scanner requires `ended_at IS NOT NULL`.
- **This means** a cron job whose *payload* errors internally but whose *wrapper* exits cleanly will show as `success=1` and "successful cost." The real failure modes (abandoned sessions) are invisible.

A dashboard split labeled "Successful Cost" vs "Failed Cost" must therefore be honest that it measures **wrapper completion status**, not true job outcome. The more valuable signal may actually be:
1. **Completed cost** vs **Abandoned cost** (by `ended_at` presence)
2. **Zero-output sessions** — sessions with `message_count = 0` or `tool_call_count = 0` despite completing

These considerations should inform the Phase 4.5 implementation.

---

*Generated by direct code inspection. No prior analysis referenced.*
