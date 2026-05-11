# Cronalytics Code Quality & Test Coverage Assessment

**Date:** 2026-05-11  
**Commit:** `e865b22` (master)  
**Scope:** Core plugin modules (`__init__.py`, `config.py`, `facts.py`, `ingester.py`, `scanner.py`, `schedule.py`, `dashboard/plugin_api.py`, `logger.py`, `seed_test_db.py`).  
**Exclusions:** `cli.py` and `checkpoint.py` removed from scope per directive.

---

## Executive Summary

**Test coverage has improved dramatically.** 83 test methods now cover ~90% of the 48 functions in scope (up from 40 tests covering ~48% of 84 functions when `cli.py`/`checkpoint.py` were included). The ingestion pipeline, dashboard API, and reconciliation scanner are all now tested. Only `__init__.py::register()` (held per directive) and a handful of secondary query primitives in `facts.py` remain without direct tests.

**Code standards adherence is now solid.** The `exc_info=True` refactor at `e865b22` resolved the pervasive bare-`except` issue. Specific exception types are used throughout. No hardcoded `~/.hermes` paths remain in scoped modules — `config.py` correctly uses `get_hermes_home()`.

**Quality attributes are generally strong** across readability, modularity, reliability, and consistency. The main residual risks are: (1) module-level mutable state in `ingester.py` complicates reasoning about concurrent behavior, and (2) `seed_test_db.py` retains Windows-incompatible `import pwd` / `os.getuid()` calls (acceptable for a dev-only fixture, but noted).

---

## 1. Test Coverage Analysis

### 1.1 What Is Tested (83 test methods)

| Module | Tests | Functions Tested | Coverage |
|--------|-------|-----------------|----------|
| `facts.py` | 11 | `ensure_schema`, `get_conn`, `_make_job_id`, `ingest_row`, `ingest_script_row`, `query_summary`, `query_jobs`, `query_job_runs` | 8/14 |
| `parser.py` (in facts) | 10 | `_make_job_id()` edge cases | 1/1 |
| `scanner.py` | 16 | `_read_watermark`, `_write_watermark`, `_fetch_new_sessions`, `_load_jobs_json`, `_scan_output_dirs`, `_ingest_batch`, `run_sync`, `get_status` | 8/8 |
| `schedule.py` | 11 | `_load_job_defs`, `_count_occurrences`, `get_job_projections` | 3/3 |
| `ingester.py` | 24 | `start`, `handle_session_end`, `_append_pending`, `_remove_pending`, `_recover_pending`, `_query_state_db`, `_delay_for_attempt`, `_process_one`, `_worker_loop`, `_ensure_worker` | 10/10 |
| `dashboard/plugin_api.py` | 11 | All 7 endpoints + helpers (`_load_job_names`, `_enrich_jobs_with_names`, `_get_status`, `_api_wrap`) | 12/12 |

### 1.2 What Remains Untested (5 functions)

| Module | Function | Risk | Why Untested |
|--------|----------|------|--------------|
| `__init__.py` | `register()` | Medium | Held per directive; requires mocking `ctx.register_hook` and bootstrap thread |
| `facts.py` | `query_last_ingested()` | Low | Trivial wrapper; used only by scanner watermark init |
| `facts.py` | `row_exists()` | Low | Trivial wrapper; used only by `_ingest_batch` (tested indirectly) |
| `facts.py` | `query_script_watermark()` | Low | Trivial wrapper; used only by `_scan_output_dirs` (tested indirectly) |
| `facts.py` | `query_health()` | Low | Used by `/health` endpoint (tested indirectly via `test_plugin_api.py`) |
| `facts.py` | `query_models()` | Low | Used by `/models` endpoint (tested indirectly via `test_plugin_api.py`) |
| `facts.py` | `query_trends()` | Low | Used by `/trends` endpoint (tested indirectly via `test_plugin_api.py`) |

### 1.3 Coverage by Risk

| Risk Tier | Functions | Tested? | Impact if Broken |
|-----------|-----------|---------|------------------|
| **High** | `ingester.py` (entire module) | ✅ Yes | Data loss on every cron run |
| **High** | `scanner.py::run_sync()` | ✅ Yes | Plugin silently stops backfilling |
| **High** | `dashboard/plugin_api.py` (all endpoints) | ✅ Yes | Dashboard is completely blank |
| **Medium** | `__init__.py::register()` | 🟡 Held | Bootstrap scanner won't start |
| **Low** | `facts.py` query primitives | 🟡 Indirect | Degraded dashboard detail views |
| **Low** | `seed_test_db.py` | ❌ No | Dev fixture only |

### 1.4 Recommendation

For an OSS project at Hermes Agent's scale:
- **90% function coverage** meets the 70% minimum threshold ✅
- **100% coverage** on `ingester.py`, `scanner.py`, `schedule.py`, and `plugin_api.py` ✅
- The remaining untested functions are either trivial wrappers or held per directive.

**Estimated effort to close remaining gaps:** 1–2 hours (Step 4 `test_plugin_lifecycle.py` + 4–6 direct query primitive tests).

---

## 2. ISO/IEC 25010 Quality Attributes Assessment

### 2.1 Readability / Understandability ✅ PASS

**Observation:** Variable and function names convey intent clearly. Module docstrings explain *why* modules exist, not just *what* they do. Type hints are used consistently.

**Evidence:**
- `ingester.py:41` — `start()` docstring explains recovery semantics
- `facts.py:144` — `_make_job_id()` docstring explains the parsing algorithm
- `scanner.py:211` — `run_sync()` docstring describes dual-track behavior

**Minor note:** `config.py:17` comment (`# seconds before each attempt`) is obvious from the variable name. Not a defect, but redundant.

### 2.2 Maintainability ✅ PASS

**Observation:** Schema migration is handled gracefully (`facts.py:124-129` adds `job_mode` column to legacy DBs). Configuration is centralized in `config.py`. The `COLUMN_MAP` in `facts.py:95` makes it easy to adapt if `state.db` columns change.

**Evidence:**
- Forward-compatible schema migration in `ensure_schema()`
- Centralized path resolution via `get_hermes_home()`
- Retry delays and jitter are constants, not magic numbers

### 2.3 Modularity ✅ PASS

**Observation:** Each module has a single, well-defined responsibility. Functions are small and single-purpose. The scanner is cleanly split into watermark I/O, state DB query, batch ingestion, and output directory scanning.

**Evidence:**
- `facts.py` — 14 public functions, average ~30 lines each
- `scanner.py` — 8 functions, clearly grouped by comment blocks
- `schedule.py` — pure utility, no side effects, no DB access

**Caveat:** `ingester.py` uses module-level mutable state (`_queue`, `_worker_thread`, `_worker_stop`). This is necessary for the hook-worker pattern but makes the module harder to reason about in isolation. The test suite mitigates this with `_reset_globals` fixture.

### 2.4 Testability ✅ PASS (with notes)

**Observation:** The codebase is now well-tested. Hermetic tests use `tmp_path` and mocks. The importlib fake-package pattern allows testing relative imports without installing the package.

**Evidence:**
- `test_ingester.py` mocks `_ensure_worker` to prevent race conditions during queue assertions
- `test_plugin_api.py` seeds a real SQLite DB and mocks `scanner.run_sync` to avoid Hermes state.db dependency
- `test_scanner_run_sync.py` mocks `_fetch_new_sessions` and `_scan_output_dirs` to test `run_sync` in isolation

**Remaining friction:**
- `__init__.py::register()` requires mocking a gateway `ctx` object — straightforward but held
- Module-level state in `ingester.py` requires careful fixture teardown

### 2.5 Reliability ✅ PASS

**Observation:** Error handling is comprehensive. The pending file provides durability across gateway restarts. Retry logic with capped jitter prevents thundering herd. WAL mode and indexes protect SQLite integrity.

**Evidence:**
- Pending file: write-before-enqueue (`ingester.py:80`), remove-after-ingest (`ingester.py:217`)
- Retry: 3 attempts with backoff `[3.0, 8.0, 15.0]` + jitter (`ingester.py:190-195`)
- Error logging: all unexpected errors use `exc_info=True` (refactored in `e865b22`)
- SQLite: WAL mode, `PRAGMA synchronous=NORMAL`, indexes on `job_id`, `run_time`, `job_mode`

**One broad catch remains:** `scanner.py:257` catches `Exception` around the script-sync track. This is **intentional** — it prevents the no_agent track from crashing the agent track. It correctly uses `exc_info=True`.

### 2.6 Security ✅ PASS

**Observation:** No SQL injection vectors. All DB queries use parameterized placeholders. API query parameters are validated by FastAPI (`ge=0`, regex `pattern=`). No secrets or credentials in code.

**Evidence:**
- `facts.py` — f-strings are used for `WHERE` clause assembly, but values are always `?` placeholders
- `facts.py:519-521` — sort_key whitelist prevents injection in `ORDER BY`
- `plugin_api.py` — FastAPI `Query(pattern=...)` validates `outcome`, `mode`, `sort_key`, `sort_dir`

**Minor note:** `seed_test_db.py` is a dev tool and not security-critical, but it does construct dynamic SQL without parameterization (acceptable for a test fixture that uses hardcoded data).

### 2.7 Performance Efficiency ✅ PASS

**Observation:** Appropriate use of SQLite features. No N+1 queries in the hot path. Lazy loading throughout. croniter safety valve prevents runaway iteration.

**Evidence:**
- WAL mode reduces write contention
- Indexes on frequently filtered columns (`job_id`, `run_time`, `job_mode`)
- `croniter` safety valve at 100k iterations (`schedule.py:53`)
- Batch ingestion in scanner avoids per-row connection open/close

**Note:** `query_summary()` issues 4 separate queries. For large datasets this could be optimized into a single CTE, but for the expected scale (<100k rows) this is fine.

### 2.8 Consistency ✅ PASS

**Observation:** The codebase follows a consistent style. Google docstring convention (per `pyproject.toml`). Type hints throughout. Consistent prefix logging (`[ingester]`, `[scanner]`, `[facts]`).

**Evidence:**
- `ruff` passes with no violations
- All files use `from __future__ import annotations`
- All files use `pathlib.Path` for path construction
- All file I/O specifies `encoding="utf-8"`

---

## 3. Core Areas to Assess in Reviews

### 3.1 Logic and Functionality ✅ PASS

**Does the code meet requirements and handle edge cases?**

Yes. Edge cases are handled comprehensively:
- Empty fact DB → zero-value aggregates (`test_empty_db`)
- Corrupt watermark → reset to defaults (`test_corrupt_watermark_reset`)
- Missing jobs.json → empty list, no crash (`test_missing_file`)
- Unparseable session ID → rejected gracefully (`test_unparseable_session_id`)
- Zero-minute interval → no divide-by-zero (`test_interval_zero_minutes`)
- Invalid sort key → fallback to `run_time` (`test_invalid_sort_key_fallback`)
- State.db row missing → retry then drop (`test_retry_when_row_not_found`, `test_drop_after_max_retries`)

### 3.2 Code Structure ✅ PASS

**Avoids overengineering, unnecessary abstractions, and redundant code (DRY).**

The code is pragmatic. No unnecessary abstraction layers. The `COLUMN_MAP` in `facts.py` avoids duplicating column mappings. The `_api_wrap()` helper in `plugin_api.py` centralizes response wrapping. The `_load_module()` pattern is repeated in `scanner.py` and `plugin_api.py` — acceptable given the importlib constraints of the dashboard server.

**Minor duplication:** `query_summary`, `query_jobs`, `query_models`, and `query_trends` all build `conditions`/`params` lists with identical day/outcome/mode filtering logic. A shared helper could DRY this, but the repetition is only ~8 lines per function and keeps each query self-contained. Defer to post-launch.

### 3.3 Documentation ✅ PASS

**Clear, concise comments for complex logic.**

Module docstrings explain architectural intent. Function docstrings describe arguments and return values. Comments are present only where intent is non-obvious:

- `checkpoint.py:41-43` (excluded from scope but good example) — explains POSIX home workaround
- `ingester.py:7-8` — explains pending file durability semantics
- `scanner.py:6-9` — explains when `run_sync` is called

The README is comprehensive and includes the "Understanding Success" section that clarifies wrapper vs payload success — a critical conceptual distinction for users.

### 3.4 Performance ✅ PASS

**Avoids premature optimization but ensures efficient loading and caching.**

- Thread-local SQLite connections avoid per-call `connect()` overhead
- `ensure_schema()` is idempotent and only runs when connection cache misses
- `query_job_runs` uses `LIMIT` to prevent unbounded result sets
- Dashboard endpoints do not cache, but the underlying DB is local SQLite — latency is negligible

### 3.5 Security ✅ PASS

**Checks for vulnerability risks in inputs and resource management.**

- No shell execution
- No eval/exec of user input
- No file paths constructed from user input (except `job_id` in URL path, which is passed as a query parameter to SQLite with parameterization)
- No hardcoded secrets
- `plugin_api.py` regex validation on all enum-like query parameters

---

## 4. Hermes Coding Standards Compliance

### 4.1 Profile-Safe Paths ✅ PASS

**Standard:** Never hardcode `~/.hermes`. Use `get_hermes_home()`.

**Status:** All scoped modules use `get_hermes_home()` via `config.py`. `dashboard/plugin_api.py:57` constructs `_JOBS_PATH = HERMES_HOME / "cron" / "jobs.json"` where `HERMES_HOME` is resolved from `config.HERMES_HOME`, which uses `get_hermes_home()`.

### 4.2 Cross-Platform Compatibility ✅ PASS (scoped modules)

**Standard:** Never assume Unix. Gate POSIX-only calls.

**Status:** No POSIX-only calls in scoped production modules. `seed_test_db.py` (dev fixture) uses `import pwd` and `os.getuid()` — acceptable for a tool that requires a real Hermes environment anyway, but documented as a limitation.

### 4.3 Error Handling: Specific Exceptions ✅ PASS

**Standard:** Catch specific exceptions. Use `logger.warning()` / `logger.error()` with `exc_info=True`.

**Status:** All unexpected-error loggers now use `exc_info=True` (fixed in `e865b22`). Specific exception types are used:
- `OSError` for file I/O (`ingester.py:103`, `scanner.py:60`)
- `json.JSONDecodeError` for JSON parsing (`ingester.py:125`, `scanner.py:60`)
- `sqlite3.Error` for DB operations (`facts.py:221`, `ingester.py:185`)
- `ValueError` / `TypeError` for croniter parsing (`schedule.py:57`)

The one remaining broad catch (`scanner.py:257`) is a deliberate safety boundary between the agent and script sync tracks and correctly logs with `exc_info=True`.

### 4.4 File I/O: Explicit Encoding ✅ PASS

All file opens specify `encoding="utf-8"`.

### 4.5 Path Construction ✅ PASS

All paths use `pathlib.Path` and the `/` operator. No string concatenation.

### 4.6 Signal Handling ✅ PASS (N/A)

No signal handling code in scoped modules.

### 4.7 Process Management ✅ PASS (N/A)

No process management code in scoped modules.

---

## 5. Prioritized Remediation Plan

### P0 — None Remaining in Scope

All P0 items from the previous assessment either:
- Were fixed in `e865b22` (error handling, exc_info=True)
- Belonged to `cli.py` / `checkpoint.py` (now out of scope)

### P1 — Close Remaining Coverage Gaps (2–3 hours)

1. **Write `test_plugin_lifecycle.py`** for `__init__.py::register()`
   - Mock `ctx.register_hook` and verify hook registration
   - Verify bootstrap thread starts
   - Verify idempotent second call

2. **Add direct tests for untested `facts.py` query primitives**
   - `query_last_ingested()` — empty DB vs populated DB
   - `row_exists()` — True/False cases
   - `query_script_watermark()` — empty vs populated
   - `query_health()` — verify dict shape
   - `query_models()` — verify aggregation and "unknown" fallback
   - `query_trends()` — verify daily grouping and sort order

### P2 — Polish & Hardening (Post-V1.0)

3. **DRY up filter building** in `facts.py` — extract a `_build_where_clause(days, outcome, mode)` helper
4. **Property-based tests** for `_count_occurrences()` with `hypothesis`
5. **Integration test** — full flow from hook call → pending file → worker → API response
6. **Fix `seed_test_db.py` cross-platform issue** — replace `import pwd` with `os.path.expanduser("~")` or `get_hermes_home()`
7. **Consider typed returns** — replace `dict[str, Any]` with Pydantic models or TypedDict for API responses

---

## 6. Quick Reference: Files and Their Status

| File | Lines | Tests | Key Quality Notes |
|------|-------|-------|-------------------|
| `__init__.py` | 39 | 0 | Held per directive; 1 intentional broad catch with `exc_info=True` |
| `config.py` | 43 | 0 | Trivial constants; uses `get_hermes_home()` correctly ✅ |
| `facts.py` | 671 | 11 | Good coverage; 6 query primitives untested (all trivial wrappers) |
| `dashboard/plugin_api.py` | ~297 | 11 | All 7 endpoints tested; FastAPI validation on params ✅ |
| `ingester.py` | 273 | 24 | **Fully tested**; durable queue, retry logic, worker lifecycle ✅ |
| `scanner.py` | 290 | 16 | **Fully tested**; dual-track sync, watermark, output dir scanning ✅ |
| `schedule.py` | 184 | 11 | **Fully tested**; croniter safety valve, graceful fallback ✅ |
| `logger.py` | 5 | 0 | Trivial namespace logger |
| `seed_test_db.py` | ~244 | 0 | Dev fixture; uses `import pwd` (Windows issue, low priority) |

---

*Assessment written for a developer picking up the project. Every issue is actionable with file:line references and fix patterns.*
