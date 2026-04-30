# Cron Insights — Development Plan

## Overview

Phased implementation of the Cron Insights dashboard plugin. Each phase is a vertical slice that produces working, testable functionality. Phases build on each other but are designed so that each one could be demoed independently.

---

## Phase 0: Plugin Skeleton & Hook Registration

**Goal:** A plugin that loads into Hermes, registers for `on_session_end`, and logs when cron jobs complete. Nothing else.

**Files to create:**
```
~/.hermes/plugins/cron-insights/
├── plugin.yaml                    -- Manifest: name, version, hooks
├── __init__.py                    -- register(ctx) → ctx.on_session_end(handler)
├── ingester.py                    -- Handler: filter platform=="cron", log session_id
└── logger.py                      -- Simple logger (plugin_name prefix)
```

**Deliverables:**
- [ ] Plugin discovered by `hermes_cli.plugins.discover_plugins()`
- [ ] Plugin loads without errors on gateway startup
- [ ] When a cron job runs, a log line appears: `[cron-insights] Captured: cron_abc123_20260429_143022`
- [ ] When a CLI chat session ends, nothing is logged (platform != "cron")

**Key decisions to validate:**
- Hook fires correctly for cron jobs
- `session_id` is parseable (`cron_{job_id}_{timestamp}`)
- Gateway picks up the plugin from `~/.hermes/plugins/`

**Estimated effort:** 2-3 hours
**Blockers:** None

---

## Phase 1: Fact DB & Real-Time Ingestion

**Goal:** Hook handler writes cron session data to a local SQLite fact DB with deferred async processing.

**Files to create/modify:**
```
├── facts.py                       -- Fact DB: schema, insert, query
├── ingester.py                    -- Queue + deferred worker (expanded)
└── config.py                      -- Plugin config (delay seconds, retry count)
```

**Deliverables:**
- [ ] Fact DB schema created on first load (`~/.hermes/plugins/cron-insights/facts.db`)
- [ ] Hook handler enqueues session_id into an in-memory queue (non-blocking)
- [ ] Background worker processes queue with 5-second initial delay
- [ ] Worker queries `state.db` for session row by `id`
- [ ] If row found: insert into fact DB with all cost/token fields
- [ ] If row not found: retry up to 3 times with exponential backoff, then drop
- [ ] Duplicate session_ids handled gracefully (`ON CONFLICT IGNORE`)
- [ ] Manual verification: run a cron job, verify row appears in fact DB within 15 seconds

**Key decisions to validate:**
- Session DB flush timing (5s delay is sufficient)
- All expected columns exist in `state.db` for cron sessions
- `ended_at` is populated when `on_session_end` fires
- No race conditions between hook and flush

**Estimated effort:** 4-6 hours
**Blockers:** Phase 0

---

## Phase 2: Reconciliation Scanner

**Goal:** Backfill historical data and repair gaps from plugin downtime.

**Files to create/modify:**
```
├── scanner.py                     -- Backfill + gap repair logic
├── facts.py                       -- Add: query last ingested watermark
└── api.py                         -- FastAPI router (initial: just /sync endpoint)
```

**Deliverables:**
- [ ] Scanner queries `state.db` for all `source='cron'` sessions with `ended_at > watermark`
- [ ] Inserts missing sessions into fact DB in batch (transaction)
- [ ] Updates watermark to max `ended_at` processed
- [ ] Watermark persisted to a simple JSON file (`~/.hermes/plugins/cron-insights/watermark.json`)
- [ ] `/api/plugins/cron-insights/sync` endpoint triggers scanner on demand
- [ ] Scanner runs automatically on first dashboard load after install
- [ ] Scanner runs periodically (configurable, default 6 hours) if gateway stays up
- [ ] Test: disable plugin for 2 cron runs, re-enable, verify scanner catches both

**Key decisions to validate:**
- Watermark approach is sufficient (no need for digest)
- Batch insert performance is acceptable for backfills
- Scanner doesn't interfere with real-time hook ingestion

**Estimated effort:** 4-5 hours
**Blockers:** Phase 1

---

## Phase 3: Dashboard API

**Goal:** REST API endpoints that serve aggregated analytics data to the frontend.

**Files to create/modify:**
```
├── api.py                         -- FastAPI router (expanded)
└── facts.py                       -- Add: aggregation queries
```

**Endpoints to implement:**

| Endpoint | Description |
|----------|-------------|
| `GET /api/plugins/cron-insights/health` | Plugin status, last sync time, watermark |
| `GET /api/plugins/cron-insights/summary?days=7` | Total runs, total cost, cost by model |
| `GET /api/plugins/cron-insights/jobs` | Per-job aggregates: runs, total cost, avg cost, last run |
| `GET /api/plugins/cron-insights/jobs/{job_id}/runs` | Individual run history for a job |
| `POST /api/plugins/cron-insights/sync` | Trigger reconciliation scanner |

**Deliverables:**
- [ ] All endpoints return JSON with correct aggregation
- [ ] Date filtering works (`days` parameter)
- [ ] Error handling for missing job_id
- [ ] Test with curl/browser: verify numbers match fact DB

**Estimated effort:** 4-5 hours
**Blockers:** Phase 2

---

## Phase 4: Frontend Slots (MVP Dashboard)

**Goal:** React components injected into the three dashboard slots.

**Files to create:**
```
dashboard/
├── manifest.json                  -- Hidden tab, slots array, api reference
├── dist/
│   └── index.js                   -- Bundled React components
└── src/                           -- Source (if we build from source)
    ├── index.tsx                  -- Entrypoint: registers all slots
    ├── CronTopSlot.tsx            -- Aggregated banner component
    ├── CronBottomSlot.tsx         -- Per-job table component
    └── HeaderRightSlot.tsx        -- Health badge component
```

**Slot details:**

**`cron:top` — Aggregated Banner**
- Total cron runs (last 7 days)
- Total estimated cost (last 7 days)
- Cost by model (horizontal bar chart or simple list)
- Simple trend indicator (↑ ↓ → vs previous 7 days)

**`cron:bottom` — Per-Job Drilldown**
- Table: Job name | Runs | Total Cost | Avg Cost | Last Run | Model
- Sortable by any column
- Top 5 most expensive jobs highlighted
- Click row to expand: show last 5 individual runs

**`header-right` — Health Badge**
- Compact: icon + "Next: 2h" or "3 failures today"
- Color: green (healthy), yellow (warnings), red (failures/cost spike)
- Hover: tooltip with summary

**Deliverables:**
- [ ] Dashboard loads plugin JS bundle
- [ ] All three slots render correctly on `/cron` page
- [ ] Data refreshes when page is visited (no live polling needed for MVP)
- [ ] Empty state handled gracefully ("No cron runs captured yet — run /sync")
- [ ] Mobile layout doesn't break (slots stack or scroll)

**Estimated effort:** 6-8 hours
**Blockers:** Phase 3

---

## Phase 5: Integration & Edge Cases

**Goal:** Harden the plugin against real-world failure modes.

**Tasks:**
- [ ] **Gateway restart scenario:** Verify scanner catches any runs missed during restart
- [ ] **Plugin disable/enable:** Watermark survives disable; scanner backfills gap
- [ ] **state.db schema change:** Graceful degradation if columns are missing
- [ ] **Large backfill:** Test scanner with 1000+ historical sessions (performance)
- [ ] **Timezone handling:** Ensure `run_time` displays in user's local timezone
- [ ] **Cost precision:** Handle `estimated_cost_usd = NULL` gracefully
- [ ] **Error logging:** All plugin errors log to `~/.hermes/logs/agent.log` with `[cron-insights]` prefix
- [ ] **Config validation:** Validate `config.yaml` plugin section on load

**Estimated effort:** 3-4 hours
**Blockers:** Phase 4

---

## Phase 6: Documentation & Release Prep

**Goal:** Plugin is installable and usable by someone other than us.

**Tasks:**
- [ ] README: Installation, configuration, what it does
- [ ] CONTRIBUTING: How to extend (adding new slots, new aggregations)
- [ ] CHANGELOG: v0.1.0 release notes
- [ ] GitHub repo structure (if open-sourcing)
- [ ] Screenshot/GIF of dashboard in action
- [ ] Test on clean Hermes install (no existing cron jobs)
- [ ] Test on Hermes install with many cron jobs

**Estimated effort:** 3-4 hours
**Blockers:** Phase 5

---

## Total Estimated Effort

| Phase | Hours | Cumulative |
|-------|-------|------------|
| 0: Skeleton | 2-3 | 2-3 |
| 1: Ingestion | 4-6 | 6-9 |
| 2: Scanner | 4-5 | 10-14 |
| 3: API | 4-5 | 14-19 |
| 4: Frontend | 6-8 | 20-27 |
| 5: Hardening | 3-4 | 23-31 |
| 6: Docs | 3-4 | 26-35 |

**Total: ~26-35 hours of focused work**

At 2-3 sessions per week, roughly **3-4 weeks** of calendar time.

---

## Working Style Notes

### Session Structure

Each work session should follow this pattern:

1. **Start with state** — Review what was accomplished last session, check current branch/commit
2. **Pick one deliverable** — One checkbox from the current phase. Not two.
3. **Implement** — Code, test, iterate
4. **Verify** — Run the manual test, check logs, confirm behavior
5. **Document** — Update this PLAN.md with ✓ on completed items
6. **End with next step** — Explicitly state what the next deliverable is

### Branching Strategy

```
main
└── develop
    ├── phase/0-skeleton
    ├── phase/1-ingestion
    ├── phase/2-scanner
    ...
```

Each phase gets a branch. Merge to `develop` when all checkboxes in that phase are done.

### Testing During Development

Before the frontend exists, test the backend with:
```bash
# Trigger a cron job manually
hermes cron run <job_id>

# Check the fact DB
cd ~/.hermes/plugins/cron-insights
sqlite3 facts.db "SELECT * FROM cron_runs ORDER BY run_time DESC LIMIT 5;"

# Hit the API
curl http://127.0.0.1:9119/api/plugins/cron-insights/summary?days=7
```

### Commit Messages

Follow conventional commits:
```
feat(ingester): add deferred async queue for session processing
fix(scanner): handle null ended_at in state.db rows
docs(readme): add installation instructions
```

---

## Current Status

| Phase | Status | Completed | Remaining |
|-------|--------|-----------|-----------|
| 0: Skeleton | ✅ Complete | 3/3 | 0 |
| 1: Ingestion | 🟡 In progress | 0/7 | 7 |
| 2: Scanner | 🔴 Not started | 0/8 | 8 |
| 3: API | 🔴 Not started | 0/4 | 4 |
| 4: Frontend | 🔴 Not started | 0/5 | 5 |
| 5: Hardening | 🔴 Not started | 0/8 | 8 |
| 6: Docs | 🔴 Not started | 0/6 | 6 |

---

*Last updated: 2026-04-29*
*Next step: Phase 1 — Fact DB & Real-Time Ingestion*
