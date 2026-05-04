# Cronalytics — Development Plan

## Overview

Phased implementation of the Cronalytics dashboard plugin. Each phase is a vertical slice that produces working, testable functionality. Phases build on each other but are designed so that each one could be demoed independently.

---

## Phase 0: Plugin Skeleton & Hook Registration

**Goal:** A plugin that loads into Hermes, registers for `on_session_end`, and logs when cron jobs complete. Nothing else.

**Files:**
```
~/.hermes/plugins/cronalytics/
├── plugin.yaml                      -- Manifest: name, version, hooks
├── __init__.py                      -- register(ctx) → ctx.on_session_end(handler)
├── ingester.py                      -- Handler: filter platform=="cron", log session_id
└── logger.py                        -- Simple logger (plugin_name prefix)
```

**Deliverables:**
- [x] Plugin discovered by `hermes_cli.plugins.discover_plugins()`
- [x] Plugin loads without errors on gateway startup
- [x] When a cron job runs, a log line appears: `[cronalytics] Captured: cron_abc123_20260429_143022`
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
- [x] Fact DB schema created on first load (`~/.hermes/plugins/cronalytics/facts.db`)
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
- [x] Checkpoint file saved after each session (`~/.hermes/sessions/cronalytics-checkpoint.json`)
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
- [x] Watermark persisted to JSON file (`~/.hermes/sessions/cronalytics-watermark.json`)
- [x] Deduplication via `facts.row_exists(session_id)` before insert
- [x] Backfill verified: 28 historical sessions inserted (1 already present, skipped)
- [ ] `/api/plugins/cronalytics/sync` endpoint triggers scanner on demand
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
| `GET  /api/plugins/cronalytics/health`                  | ✅ |
| `GET  /api/plugins/cronalytics/summary?days=7`        | ✅ |
| `GET  /api/plugins/cronalytics/jobs?days=7`            | ✅ |
| `GET  /api/plugins/cronalytics/jobs/{job_id}/runs`    | ✅ |
| `GET  /api/plugins/cronalytics/models?days=7`         | ✅ (unplanned bonus) |
| `GET  /api/plugins/cronalytics/trends?days=7`         | ✅ (unplanned bonus) |
| `POST /api/plugins/cronalytics/sync`                  | ✅ (see Phase 2 note) |

**Deliverables:**
- [x] All endpoints return JSON with correct aggregation
- [x] Date filtering works (`days` parameter)
- [x] Error handling for missing job_id (HTTP 404)
- [x] Verified with HTTP requests — numbers match fact DB
- [x] API routes mount correctly after dashboard server restart

**Key fixes required during implementation:**
- Dashboard server loads plugin API files via `importlib` as standalone modules. Relative imports (`from .. import facts`) fail silently, causing routes to not mount at all. Fixed by using dynamic `importlib.util` loading in `plugin_api.py`.
- `facts.py` originally used `from .logger import logger` — also failed under dynamic load. Fixed by inlining `logging.getLogger("cronalytics")`.

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
- **Tab route `/cronalytics`** — Full page showing aggregated summary cards, cost-by-model list, and per-job table.
- **Header-right badge** — "31 CRON RUNS" rendered in dashboard sidebar (polls `/health` every 30s).
- **Summary cards** — Total Runs, Est. Cost (with trend ↑/↓), Tokens in/out.
- **Jobs table** — Job ID, Runs, Total Cost, Avg Cost, Last Run, Model.

**Deliverables:**
- [x] Dashboard loads plugin JS bundle (verified in browser)
- [x] Tab renders on `/cronalytics` (route changed from `/cron` to avoid built-in collision)
- [x] Header-right slot renders correctly
- [x] Data refreshes on page visit
- [x] Empty state handled ("No cron jobs captured in the last 7 days")
- [ ] Sortable columns — not implemented
- [ ] Top 5 most expensive jobs highlighted — not implemented
- [ ] Click row to expand last 5 individual runs — not implemented
- [ ] Mobile layout verified — not verified

**Status:** MVP complete + Pace redesign. Cut from original 3-slot model (top, bottom, header-right) to a single tab + header-right badge for vertical-slice delivery. Table sorting, row expansion (for individual runs), and mobile polish are backlog.

**Pace redesign (May 2026):**
- Summary cards reordered: actuals left (Total Runs, Est Cost, Tokens), projections right (Pace)
- Jobs table expanded from 6 to 7 columns with Nominal/mo, Trend/mo, Pace
- Fixed-window projection math replaces data-span denominators
- Color-coded Pace ratios with background tints
- Expandable detail rows show Schedule, Last run+model, Nominal/Trend/Pace/Drift, Tokens, Next run
- Native `title` tooltips on column headers

---

## Phase 4.5: Success/Failure Cost Split & Dashboard Honesty

**Goal:** Surface per-status cost breakdown in the dashboard so users can distinguish "cron wrapper completed" spend from true failure spend, without claiming to measure job-level success.

**Background:** The `success` boolean in `facts.py` is derived from `end_reason` (`cron_complete`/`complete` → 1, else 0). However, this measures the *wrapper's* exit status, not the *payload's* actual outcome. A script that errors internally but returns a clean exit will show as `success=1`. Worse, the 7 cron sessions in `state.db` with `ended_at = NULL` are entirely invisible to the fact DB because the scanner filters them out. These "abandoned" sessions (gateway crash, killed process, stuck job) may represent the most important failure signal of all.

**Files:**
```
facts.py                          -- Add status-split aggregates to query_summary() and query_jobs()
plugin_api.py                     -- Expose new fields in /summary and /jobs responses
dashboard/dist/index.js           -- Two-tone cost display (stacked bar, pill badge, or tooltip)
```

**Deliverables:**
- [ ] `query_summary()` returns `successful_cost` + `failed_cost` (wrapper-completed vs. wrapper-failed)
- [ ] `query_jobs()` returns per-job `successful_cost` + `failed_cost`
- [ ] Frontend renders split without claiming "job success" — label as "Completed" / "Failed to finish"
- [ ] Decision: add `abandoned_cost` (sessions with `ended_at IS NULL`) or keep out of scope
  - *Option A:* Teach scanner to ingest `ended_at = NULL` rows into a separate `cron_runs_abandoned` table
  - *Option B:* Compute abandoned cost on the fly from `state.db` in a new endpoint
  - *Option C:* Defer; focus on completed-session split first
- [ ] Design review: should the split be a headline metric, a detail-on-hover, or a sparkline?

**Status:** Design-only. Blocked on decision re: abandoned sessions and UI treatment (headline vs. detail). See FEATURES.md §9 for data context.

**Out of scope for this iteration:**
- True payload-level success detection (would require parsing tool outputs, model-dependent)
- Auto-alerting on failure cost thresholds

---

## Phase 4.6: Per-Job Token Attribution in Jobs Table

**Goal:** Close the gap between the summary token headline and the jobs table by adding per-job token aggregates, so users can identify which specific job is consuming input/output tokens.

**Background:** The dashboard currently shows "Tokens: in XX / out YY" as a summary card, but the jobs table only lists runs, total cost, avg cost, and model per job. The natural diagnostic question — *which job is eating all those tokens?* — has no answer. Cost and tokens aren't perfectly correlated across models and pricing tiers, so token bloat and cost bloat are separate signals.

**Files:**
```
facts.py                          -- Add SUM(input_tokens), SUM(output_tokens), AVG(input_tokens) to query_jobs()
plugin_api.py                     -- Expose new fields in /jobs response (no API change needed if /jobs already forwards)
dashboard/dist/index.js           -- Add compact token column to jobs table (e.g. "234K ↓ 89K" or single "Total tokens")
```

**Deliverables:**
- [ ] `query_jobs()` aggregates `SUM(input_tokens)`, `SUM(output_tokens)`, and optionally `AVG(input_tokens)` per job
- [ ] Frontend jobs table gains a compact token column (stacked in/out, horizontally if width permits)
- [ ] Column is sortable (future Phase 4 backlog) or at least surfaces high-token jobs visually
- [ ] iPad width check: if table is too crowded, use tooltip/hover expansion or collapse to single "Total Tokens" number

**Status:** Design-only. Staged as follow-up to Phase 4.5.

---

## Phase 4.7: Cost Projections & Schedule-Aware Budgeting

**Goal:** Turn the dashboard from a rear-view mirror into a forward-looking budgeting tool by projecting future spend based on actual per-run cost multiplied by scheduled frequency.

**Background:** Right now the dashboard tells Nick what cron jobs *have* cost. The natural next question — *what will this cost me next month at current pace?* — has no answer. Because we already read `~/.hermes/cron/jobs.json` for human-readable names, the cron expression (`schedule.cron`) is already available. Combined with `avg_cost_per_run` from `query_jobs()`, we can calculate projected spend at any horizon.

**Projection models:**
1. **Schedule-based** (fixed cron): `avg_cost_per_run × occurrences(schedule_cron, horizon)`
   - Example: daily at 8am → 365 runs/yr. If avg cost is $0.04/run → $14.60/yr projected.
2. **Trend-based** (irregular/no schedule): `(last_30d_cost / 30 × projection_days)`
   - Honest about uncertainty; labeled as "at current pace" rather than "scheduled."
3. **Frequency drift** (the most valuable signal): `observed_runs_last_window / scheduled_runs_last_window`
   - A job scheduled daily but observed 42 times in 30 days = +40% drift. The projection should show both the *nominal* schedule cost ($14.60/yr) and the *trend-adjusted* cost ($51.00/yr). Drift flags misconfigured schedules, retries, or external triggers.

**Files:**
```
config.py or utils.py                -- Add cron schedule parser (croniter or equivalent)
facts.py                             -- Add projection aggregates to query_jobs() and query_summary()
plugin_api.py                          -- Expose projected_cost_30d, projected_cost_90d, projected_cost_1yr
dashboard/dist/index.js                -- Summary "Projected monthly spend" headline + per-job click-to-expand detail
cron/jobs.json (read-only)            -- Source of schedule expressions and definitions
```

**Deliverables:**
- [x] `query_summary()` computes aggregate values by summing per-job fixed-window projections
- [x] `query_jobs()` returns `scheduled_runs_30d` per job (via `croniter` in `schedule.py`)
- [x] `query_jobs()` returns `projected_cost_{30d,90d,1yr}` per job (nominal schedule-based)
- [x] `query_jobs()` returns `trend_projected_cost_{30d,90d,1yr}` per job (fixed-window based)
- [x] `query_jobs()` returns `pace` per job (`trend / nominal`) with null-safe fallback
- [x] `query_jobs()` returns `drift_ratio` per job (observed runs vs scheduled runs in window)
- [x] Summary card: "Pace" with colored ratio + "Scheduled $X/mo" + "Projected $Y/mo" sub-lines
- [x] Jobs table: columns Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace
- [x] Pace column: color-coded (cyan <0.85, white 0.85-1.15, amber 1.15-1.50, red >1.50)
- [x] Expandable detail rows: Schedule, Last run + model, Nominal/Trend/Pace/Drift, Tokens, Next run
- [x] Native `title` tooltips on column headers for Nominal/mo, Trend/mo, Pace
- [x] Edge case: interval schedules (e.g., "every 6 hours") normalized alongside cron
- [x] Edge case: jobs with no schedule show "No schedule" and "—" for projections

**Design decisions:**
- Fixed-window math: denominator = selected filter days (not data span). Ensures per-job trends sum to aggregate trend.
- Color scale: under-spend (<0.85) = cyan/informative, on-track (0.85-1.15) = neutral, warm (1.15-1.50) = amber, over (>1.50) = red
- Pace terminology replaces "burn rate" — pace is a ratio, burn rate implies absolute $/time
- Next Run moved from table column into expandable detail row (saves width, keeps pace visible)

**Status:** ✅ Complete. Live in commit `747ceab` (backend) + `e9aadaf09` (host web cache-busting). Verified API returns correct data; awaiting Nick's iPad verification.

---

## Phase 5: Integration & Edge Cases

**Goal:** Harden the plugin against real-world failure modes.

**Tasks:**
- [x] Importlib-safe loading — fixed relative imports that silently broke API route mounting
- [x] Route collision — discovered `/cron` built-in tab conflict, moved to `/cronalytics`
- [ ] Gateway restart scenario: verify scanner catches runs missed during restart
- [ ] Plugin disable/enable: watermark survives disable; scanner backfills gap
- [ ] `state.db` schema change: graceful degradation if columns are missing
- [ ] Large backfill: test scanner with 1000+ historical sessions (performance)
- [ ] Timezone handling: ensure `run_time` displays in user's local timezone
- [ ] Cost precision: handle `estimated_cost_usd = NULL` gracefully
- [ ] Error logging: all plugin errors log to `~/.hermes/logs/agent.log` with `[cronalytics]` prefix
- [ ] Config validation: validate `config.yaml` plugin section on load

**Status:** Partial. The two biggest real-world failure modes (relative imports, route collision) were discovered and fixed during Phase 3 development. Remaining tasks are traditional QA/backlog.

**Done this session:**
- [x] Gateway restart recovery: `__init__.py` auto-starts scanner on plugin load
- [x] Plugin disable/enable: same scanner bootstrap covers gaps
- [x] Cost NULL handling: removed `COALESCE(..., 0)`, dashboard shows `"\u2014"` for null
- [x] Timezone handling: `fmtTime` includes `timeZoneName: "short"`

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
**Actual so far: ~22 hours across 5-6 sessions**

---

## Current Status

| Phase | Status | Completed | Remaining |
|-------|--------|-----------|-----------|
| 0: Skeleton | ✅ Complete | 4/4 | 0 |
| 1: Ingestion | ✅ Complete | 8/8 | 0 |
| 1.5: Checkpoint | ✅ Complete | 1/1 | 0 |
| 2: Scanner | ✅ Core complete | 6/8 | 2 (sync wiring, periodic/auto-run) |
| 3: API | ✅ Complete | 7/7 | 0 |
| 4: Frontend | ✅ MVP complete + Pace redesign | 10/14 | 4 (sort, individual run expand, highlight, mobile) |
| 4.5: Success/Failure Split | 🟡 Design-only | 0/4 | 4 |
| 4.6: Token Columns | 🟡 Design-only | 0/4 | 4 |
| 4.7: Projections + Pace | ✅ Complete | 12/12 | 0 |
| 2.5: Data Correction | ✅ Complete | 9/9 | 0 |
| 2.6: Sync Endpoint | ✅ Complete | 9/9 | 0 |
| 5: Hardening | 🟡 Partial | 6/10 | 4 (schema resilience, error logging, config validation, perf) |
| 6: Docs | ⚫ Not started | 0/6 | 6 |

**Next priority:** Nick's iPad verification + verbiage tweaks.

---

## Phase 2.5: Data Model Correction — Job ID Parsing & Human-Readable Names

**Goal:** Fix the `job_id` parser so it correctly maps to the stable job definition ID (e.g. `841aee933270`), and enrich dashboard surfaces with human-readable job names so users see "phosphor-daily-backup" instead of a hex string.

**Background:** The original `_make_job_id()` incorrectly included the datestamp in the job ID because session IDs are `cron_<job_id>_<YYYYMMDD>_<HHMMSS>` (4 segments), not `cron_<job_id>_<timestamp>` (3 segments). This fragmented per-job aggregation: every daily run of the same job appeared as a different job. Additionally, job IDs are opaque to users — they never see them unless they read `jobs.json` or output files directly. Without the job name, the dashboard is not useful at a glance.

**Files touched:**
```
facts.py                          -- Fix _make_job_id() parser
plugin_api.py                     -- Enrich /jobs with name from jobs.json
dashboard/dist/index.js           -- Render job name in table, fallback to truncated id
```

**Deliverables:**
- [x] `_make_job_id()` drops the final **two** underscore segments (`YYYYMMDD_HHMMSS`) instead of one
- [x] Parser unit tested with sample session IDs (underscore-less id, underscore id, edge cases)
- [x] `_load_job_names()` helper reads `~/.hermes/cron/jobs.json` and resolves `job_id` → `name`
- [x] `/jobs` API response includes `name` field per job (null-safe fallback)
- [x] Jobs table renders `name` as primary label, with `job_id` as secondary mono detail
- [x] Fact DB rebuilt from source of truth (`state.db` backfill) to correct historical rows
- [x] Watermark reset and scanner run to repopulate with clean job IDs
- [x] Header badge and summary unaffected (Operates on run count, not job name)
- [ ] (Optional, Phase 2.5 follow-up) Prompt caching strategy: decide whether to capture job prompts for historical drift tracking

**Design note — session_id vs job_id semantics after fix:**
- `session_id` = row-level unique key identifying a single run instance (`cron_841aee933270_20260429_222224`)
- `job_id` = stable grouping key matching the job definition in `jobs.json` (`841aee933270`)
- `name` = user-facing label resolved at query time from `jobs.json` (`"phosphor-daily-backup"`)

This distinction enables both per-instance cost analysis and rolled-up per-job cost analysis natively in the same schema.

**Status:** ✅ Complete. Planned as standalone iteration before resuming Phase 5/6.

---

## Phase 2.6: Scanner Importlib Refactor, Sync Endpoint & Frontend Button

**Goal:** Make the reconciliation scanner importlib-safe so `plugin_api.py` can load it dynamically, wire a `POST /sync` endpoint that actually runs the scanner, fix health metadata (`rows_synced`), and add a "Sync Now" button to the dashboard for on-demand backfills.

**Background:** `scanner.py` currently uses relative package imports (`from . import facts`, `from .logger import logger`) that work in the gateway context but fail when loaded via importlib by the dashboard server. This prevents the API from calling `scanner.run_sync()` directly. Additionally, `rows_synced` is never written to the watermark file, so the health endpoint always reports `0` even after successful backfills. Users have no way to trigger a sync from the UI.

**Files touched:**
```
scanner.py                          -- Replace relative imports with importlib-safe loading; include rows_synced in watermark
plugin_api.py                       -- Add POST /sync route; delegate _get_status() to scanner.get_status()
dashboard/dist/index.js             -- Add "Sync Now" button with loading state and last-sync timestamp
```

**Deliverables:**
- [x] `scanner.py` uses importlib-safe module loading (mirrors `plugin_api.py` `_load_module` pattern)
- [x] `POST /api/plugins/cronalytics/sync` returns `{ inserted, skipped, elapsed_ms, new_watermark }`
- [x] `_get_status()` in `plugin_api.py` delegates to `scanner.get_status()` (removes duplicate watermark-reading logic)
- [x] Scanner writes `rows_synced` (inserted + skipped) to watermark file
- [x] Frontend "Sync Now" button added to jobs table
- [x] Button shows last sync timestamp + elapsed time
- [x] Empty state: if `facts.db` is empty or never built, UI shows guidance to click "Sync Now"
- [x] On-demand sync verified end-to-end (click button → curl /sync → verify DB count increased)
- [x] Health `/status` returns accurate `rows_synced` after manual sync

**Out of scope for this iteration:**
- Auto-trigger on dashboard load (covered by manual button for now)
- Periodic/auto-run scheduler (still Phase 2 backlog)
- Test infrastructure (separate pass)

**Status:** ✅ Complete. All deliverables verified. Button visibility fixed in follow-up session (Omatchy CSS variable fix).

---

## Architecture Notes (learned during build)

1. **Dashboard plugin API files are loaded via `importlib`** as standalone modules with no package context. Any `from . import X` or `from .. import Y` will fail silently, preventing routes from mounting. Always use `importlib.util` to load sibling modules dynamically, or inline dependencies.
2. **Tab path collision:** The manifest `"path": "/cron"` collides with Hermes's built-in cron tab. Use a unique path (e.g. `/cronalytics`) or the built-in page will override the plugin.
3. **Plugin directory replication:** `~/.hermes/plugins/cronalytics/` is a static directory copy, not a symlink to the build directory. Changes in `/home/nick/builds/cronalytics/` are NOT automatically reflected unless manually synced or symlinked.
4. **Dashboard server caches plugins per-process.** Any change to `manifest.json` or `plugin_api.py` requires a full `hermes dashboard` restart to take effect.

---

## Phase 7: Standalone CLI Prototype (Nick's Top Priority)

**Goal:** A `cronalytics` CLI command that mirrors `hermes insights` terminal output format, dumping cron run data without requiring Hermes core changes.

**Commands:**
- `summary` — Aggregate headline: runs, cost, tokens (total + In/Out/Cached), trend arrow
- `jobs` — Per-job table: Job ID, Runs, Cost, Tokens, Pace (with projection math)
- `runs --job ID` — Individual run history: Time, Duration, Cost, Tokens, Model
- `models` — Per-model cost breakdown
- `trends` — Daily sparkline bar chart (runs + cost per day)
- `health` — Fact DB health: total runs, unique jobs, last ingested, last run

**Shared flag:** `--days N` (default 30, 0 = all time)

**Files:**
```
cli.py                          -- Standalone entry point, argparse subcommands, ASCII formatting
```

**Deliverables:**
- [x] `cli.py` created with all 6 subcommands
- [x] `--days` flag wired to every query
- [x] ASCII box headers matching `hermes insights` style
- [x] Compact monospace tables with aligned columns
- [x] Token formatting with K/M suffixes; cost with `$` + 2 decimals
- [x] `jobs` command integrates `get_job_projections()` for Nominal/Trend/Pace math
- [x] All commands tested against live `facts.db`

**Next (awaiting Nick after AM meetings):**
- Iterate on output layout and density
- Decide on Rich tables vs ASCII boxes
- Add `--json` flag for machine-readable output
- Consider `hermes cronalytics` core wiring (deferred)

**Status:** ✅ Prototype working. Awaiting user iteration.

---

*Last updated: 2026-05-04*
*Current commit: `61ddc6e`*
*Phase 6 dashboard complete, Phase 7 CLI prototype working. Next: iterate CLI with Nick.*
