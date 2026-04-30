# Cron Insights — Development Plan

## Overview

Phased implementation of the Cron Insights dashboard plugin. Each phase is a vertical slice that produces working, testable functionality. Phases build on each other but are designed so that each one could be demoed independently.

---

## Phase 0: Plugin Skeleton & Hook Registration

**Goal:** A plugin that loads into Hermes, registers for `on_session_end`, and logs when cron jobs complete. Nothing else.

**Files:**
```
~/.hermes/plugins/cron-insights/
├── plugin.yaml                      -- Manifest: name, version, hooks
├── __init__.py                      -- register(ctx) → ctx.on_session_end(handler)
├── ingester.py                      -- Handler: filter platform=="cron", log session_id
└── logger.py                        -- Simple logger (plugin_name prefix)
```

**Deliverables:**
- [x] Plugin discovered by `hermes_cli.plugins.discover_plugins()`
- [x] Plugin loads without errors on gateway startup
- [x] When a cron job runs, a log line appears: `[cron-insights] Captured: cron_abc123_20260429_143022`
- [x] When a CLI chat session ends, nothing is logged (platform != "cron")

**Key decisions validated:**
- Hook fires correctly for cron jobs (verified live: `cron_841aee933270_20260429_222224`)
- `session_id` is parseable (`cron_{job_id}_{timestamp}`)
- Gateway picks up the plugin from `~/.hermes/plugins/`

**Status:** Complete. No blockers.

---

## Phase 1: Fact DB & Real-Time Ingestion

**Goal:** Hook handler writes cron session data to a local SQLite fact DB with deferred async processing.

**Files:**
```
├── facts.py                          -- Fact DB: schema, insert, query
├── config.py                         -- Plugin paths (delay, retry count)
└── ingester.py                       -- Queue + deferred worker + pending.jsonl
```

**Deliverables:**
- [x] Fact DB schema created on first load (`~/.hermes/plugins/cron-insights/facts.db`)
- [x] Hook handler writes session_id to `pending.jsonl`
- [x] Background worker processes pending.jsonl with 5-second initial delay
- [x] Worker queries `state.db` for session row by `id`
- [x] If row found: insert into fact DB with all cost/token fields
- [x] If row not found: retry up to 3 times with exponential backoff, then drop
- [x] Duplicate session_ids handled gracefully (`ON CONFLICT IGNORE`)
- [x] Manual verification: run a cron job, verify row appears in fact DB

**Status:** Complete. Real-time ingestion verified live with `phosphor-daily-backup` and other cron jobs. `facts.db` holds 31 rows.

---

## Phase 1.5: Checkpoint Persistence

**Goal:** Serialize session state across context windows so work can resume after compression.

**Files:**
```
└── checkpoint.py                     -- JSON read/write with real-POSIX-home fix
```

**Deliverables:**
- [x] Checkpoint file saved after each session (`~/.hermes/sessions/cron-insights-checkpoint.json`)
- [x] Uses `pwd.getpwuid(os.getuid()).pw_dir` instead of `Path.home()` to avoid Hermes profile path bug
- [x] Captures phase, commit, touched files, and next step

**Status:** Complete.

---

## Phase 2: Reconciliation Scanner

**Goal:** Backfill historical data and repair gaps from plugin downtime.

**Files:**
```
├── scanner.py                        -- Backfill + watermark logic
└── watermark.json                    -- Persisted high-water mark (auto-created)
```

**Deliverables:**
- [x] Scanner queries `state.db` for all `source='cron'` sessions with `ended_at > watermark`
- [x] Inserts missing sessions into fact DB in batch (transaction)
- [x] Updates watermark to max `ended_at` processed
- [x] Watermark persisted to JSON file (`~/.hermes/sessions/cron-insights-watermark.json`)
- [x] Deduplication via `facts.row_exists(session_id)` before insert
- [x] Backfill verified: 28 historical sessions inserted (1 already present, skipped)
- [ ] `/api/plugins/cron-insights/sync` endpoint triggers scanner on demand
  - *NOTE:* POST /sync exists in API but currently uses an inline `_get_status()` helper rather than importing `scanner.py` (due to importlib dynamic-loading constraints; `scanner.py` still uses relative imports and cannot be loaded as a standalone module). Needs refactor.
- [ ] Scanner runs automatically on first dashboard load after install
- [ ] Scanner runs periodically (configurable, default 6 hours) if gateway stays up
- [ ] Test: disable plugin for 2 cron runs, re-enable, verify scanner catches both

**Status:** Core backfill logic complete. 28 historical sessions ingested.
Outstanding: `sync` endpoint needs to be wired back to actual `scanner.py`; auto-run and periodic run not implemented.

---

## Phase 3: Dashboard API

**Goal:** REST API endpoints that serve aggregated analytics data to the frontend.

**Files:**
```
dashboard/
└── plugin_api.py                     -- FastAPI APIRouter (not flat `api.py` at root)
```

**Endpoints implemented:**

| Endpoint | Status |
|----------|--------|
| `GET  /api/plugins/cron-insights/health`                  | ✅ |
| `GET  /api/plugins/cron-insights/summary?days=7`        | ✅ |
| `GET  /api/plugins/cron-insights/jobs?days=7`            | ✅ |
| `GET  /api/plugins/cron-insights/jobs/{job_id}/runs`    | ✅ |
| `GET  /api/plugins/cron-insights/models?days=7`         | ✅ (unplanned bonus) |
| `GET  /api/plugins/cron-insights/trends?days=7`         | ✅ (unplanned bonus) |
| `POST /api/plugins/cron-insights/sync`                  | ✅ (see Phase 2 note) |

**Deliverables:**
- [x] All endpoints return JSON with correct aggregation
- [x] Date filtering works (`days` parameter)
- [x] Error handling for missing job_id (HTTP 404)
- [x] Verified with HTTP requests — numbers match fact DB
- [x] API routes mount correctly after dashboard server restart

**Key fixes required during implementation:**
- Dashboard server loads plugin API files via `importlib` as standalone modules. Relative imports (`from .. import facts`) fail silently, causing routes to not mount at all. Fixed by using dynamic `importlib.util` loading in `plugin_api.py`.
- `facts.py` originally used `from .logger import logger` — also failed under dynamic load. Fixed by inlining `logging.getLogger("cron-insights")`.

**Status:** Complete. All endpoints verified returning JSON.

---

## Phase 4: Frontend Slots (MVP Dashboard)

**Goal:** React components rendered in the Hermes dashboard UI.

**Files:**
```
dashboard/
├── manifest.json                     -- Tab route, slots, api reference, entry bundle
├── dist/
│   └── index.js                        -- Bundled React components
└── plugin_api.py                     -- Backend API (see Phase 3)
```

**What was built:**
- **Tab route `/cron-insights`** — Full page showing aggregated summary cards, cost-by-model list, and per-job table.
- **Header-right badge** — "31 CRON RUNS" rendered in dashboard sidebar (polls `/health` every 30s).
- **Summary cards** — Total Runs, Est. Cost (with trend ↑/↓), Tokens in/out.
- **Jobs table** — Job ID, Runs, Total Cost, Avg Cost, Last Run, Model.

**Deliverables:**
- [x] Dashboard loads plugin JS bundle (verified in browser)
- [x] Tab renders on `/cron-insights` (route changed from `/cron` to avoid built-in collision)
- [x] Header-right slot renders correctly
- [x] Data refreshes on page visit
- [x] Empty state handled ("No cron jobs captured in the last 7 days")
- [ ] Sortable columns — not implemented
- [ ] Top 5 most expensive jobs highlighted — not implemented
- [ ] Click row to expand last 5 individual runs — not implemented
- [ ] Mobile layout verified — not verified

**Status:** MVP complete. Cut from original 3-slot model (top, bottom, header-right) to a single tab + header-right badge for vertical-slice delivery. Table sorting, row expansion, and mobile polish are backlog.

---

## Phase 5: Integration & Edge Cases

**Goal:** Harden the plugin against real-world failure modes.

**Tasks:**
- [x] Importlib-safe loading — fixed relative imports that silently broke API route mounting
- [x] Route collision — discovered `/cron` built-in tab conflict, moved to `/cron-insights`
- [ ] Gateway restart scenario: verify scanner catches runs missed during restart
- [ ] Plugin disable/enable: watermark survives disable; scanner backfills gap
- [ ] `state.db` schema change: graceful degradation if columns are missing
- [ ] Large backfill: test scanner with 1000+ historical sessions (performance)
- [ ] Timezone handling: ensure `run_time` displays in user's local timezone
- [ ] Cost precision: handle `estimated_cost_usd = NULL` gracefully
- [ ] Error logging: all plugin errors log to `~/.hermes/logs/agent.log` with `[cron-insights]` prefix
- [ ] Config validation: validate `config.yaml` plugin section on load

**Status:** Partial. The two biggest real-world failure modes (relative imports, route collision) were discovered and fixed during Phase 3 development. Remaining tasks are traditional QA/backlog.

---

## Phase 6: Documentation & Release Prep

**Goal:** Plugin is installable and usable by someone other than us.

**Tasks:**
- [ ] README: Installation, configuration, what it does
- [ ] CONTRIBUTING: How to extend
- [ ] CHANGELOG: v0.1.0 release notes
- [ ] GitHub repo structure (if open-sourcing)
- [ ] Screenshot/GIF of dashboard in action
- [ ] Test on clean Hermes install
- [ ] Test on Hermes install with many cron jobs

**Status:** Not started.

---

## Total Estimated Effort

| Phase | Hours | Actual |
|-------|-------|--------|
| 0: Skeleton | 2-3 | ~2 |
| 1: Ingestion | 4-6 | ~4 |
| 1.5: Checkpoint | — | ~1 |
| 2: Scanner | 4-5 | ~3 |
| 3: API | 4-5 | ~4 |
| 4: Frontend | 6-8 | ~4 |
| 5: Hardening | 3-4 | ~1 (partial) |
| 6: Docs | 3-4 | 0 |

**Total estimated: ~26-35 hours**
**Actual so far: ~19 hours across 4-5 sessions**

---

## Current Status

| Phase | Status | Completed | Remaining |
|-------|--------|-----------|-----------|
| 0: Skeleton | ✅ Complete | 4/4 | 0 |
| 1: Ingestion | ✅ Complete | 8/8 | 0 |
| 1.5: Checkpoint | ✅ Complete | 1/1 | 0 |
| 2: Scanner | ✅ Core complete | 6/8 | 2 (sync wiring, periodic/auto-run) |
| 3: API | ✅ Complete | 7/7 | 0 |
| 4: Frontend | ✅ MVP complete | 5/9 | 4 (sort, expand, highlight, mobile) |
| 5: Hardening | 🟡 Partial | 2/8 | 6 |
| 6: Docs | ⚫ Not started | 0/6 | 6 |

---

## Architecture Notes (learned during build)

1. **Dashboard plugin API files are loaded via `importlib`** as standalone modules with no package context. Any `from . import X` or `from .. import Y` will fail silently, preventing routes from mounting. Always use `importlib.util` to load sibling modules dynamically, or inline dependencies.
2. **Tab path collision:** The manifest `"path": "/cron"` collides with Hermes's built-in cron tab. Use a unique path (e.g. `/cron-insights`) or the built-in page will override the plugin.
3. **Plugin directory replication:** `~/.hermes/plugins/cron-insights/` is a static directory copy, not a symlink to the build directory. Changes in `/home/nick/builds/cron-insights/` are NOT automatically reflected unless manually synced or symlinked.
4. **Dashboard server caches plugins per-process.** Any change to `manifest.json` or `plugin_api.py` requires a full `hermes dashboard` restart to take effect.

---

*Last updated: 2026-04-30*
*Current commit: `3e55493`*
*Next step: Wire POST /sync back to actual scanner.py; then decide whether to tackle Phase 5 hardening or Phase 6 docs.*
