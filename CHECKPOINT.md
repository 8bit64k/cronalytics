# cron-insights Checkpoint — 2026-04-30 (Session 5)

## Where We Are
Working in `/home/nick/builds/cron-insights` (main branch). Deployed plugin at `~/.hermes/plugins/cron-insights`.

## What Got Done This Session

### Phase 2.6 — Button Visibility (RESOLVED)
- **Root cause:** Omatchy theme sets `--foreground` to `color-mix(..., 0% alpha)`, making it fully transparent
- **Fix:** `dashboard/dist/index.js` now uses solid `--foreground-base` / `--background-base` for button border, background, and text
- **Verified:** Button clearly visible under both default Hermes themes and Omatchy themes

### Phase 5 — Hardening (6 of 10 tasks done)

**1. Gateway restart recovery — DONE**
- `__init__.py` now spawns a daemon thread inside `register()` that runs the scanner once on plugin load
- This closes gaps missed while gateway was down
- Logs: `Bootstrap scanner: inserted=N, skipped=M`

**2. Plugin disable/enable resilience — DONE**
- Scanner on plugin load covers disable/enable cycles
- Watermark survives disable (JSON file is external to plugin state)

**4. Cost NULL handling — DONE**
- `facts.py`: removed `COALESCE(SUM(...), 0)` from all cost aggregates
- API returns `null` when no cost data exists, instead of `0`
- `dashboard/dist/index.js`: `fmtCost(null)` → `"—"`, `fmtCost(0)` → `"$0.00"`
- Filter changed from `> 0` to `IS NOT NULL` so zero-cost runs aren't hidden

**5. Timezone display — DONE**
- `fmtTime()` now uses `Intl.DateTimeFormat(undefined, opts)` with `timeZoneName: "short"` so timestamps show local zone abbreviation
- Sync timestamp text also uses `fmtTime` instead of raw UTC string slicing

**6a. Frontend sync-button stability — DONE**
- After clicking Sync Now, UI re-fetches `/health` to get authoritative watermark instead of using per-run candidate count
- Row count text no longer disappears when `rowsSynced === 0` (uses `!= null` instead of truthy check)

**Not yet done (Phase 5 backlog):**
- Task 3: `state.db` schema resilience (missing columns)
- Task 6: Error logging hygiene (structured, clean)
- Task 7: Config validation
- Task 8: Large backfill performance

### External Issue: `cfg_get` ImportError (FULLY RESOLVED)
- Stale `__pycache__` files post-`hermes update` caused `ImportError: cfg_get not found`
- Fix: `touch` on all `.py` files forced recompilation
- Dashboard and gateways restarted

## Data State
- `facts.db`: 33 rows, 6 stable job IDs (deleted and rebuilt via Sync Now)
- `watermark.json`: `"last_sync": "2026-05-01T00:35:34Z"`, `rows_synced: 33`
- All `estimated_cost_usd` values known; `actual_cost_usd` entirely NULL
- Zero-to-hero rebuild verified: empty DB → Sync Now → 33 rows in <1s

## Known Issues / TODO
1. **Tests**: still blocked by relative imports when run directly. Not addressed this session.
2. **Phase 5 remaining**:
   - Task 3: Schema resilience (graceful degradation if `state.db` columns missing)
   - Task 6: Error log hygiene (all errors → `~/.hermes/logs/agent.log` with `[cron-insights]` prefix)
   - Task 7: Config validation on plugin load
   - Task 8: Performance — 1000+ session backfill
3. **Phase 6**: README, CONTRIBUTING, CHANGELOG, screenshot, clean-install validation — not started.

## Files Modified This Session
- `__init__.py` — auto-start scanner on plugin load
- `facts.py` — remove COALESCE from cost aggregates, NULL semantics
- `dashboard/dist/index.js` — button visibility fix, fmtCost null, fmtTime timezone, sync-button stability fix

## What To Do on Rejoin
1. Restart dashboard server to load updated `plugin_api.py` backend changes (`hermes dashboard`)
2. Hard-refresh browser (`Ctrl+Shift+R`) to clear cached `index.js`
3. Verify cost display shows `"—"` for actual cost (unknown), dollar values for estimated
4. Verify button color under Omatchy theme
5. Pick from:
   - Finish Phase 5 (tasks 3, 6, 7, 8)
   - Phase 6: Documentation
   - Fix tests
   - User priority

## Key Technical Notes
- Dashboard port: 9119
- Plugin API routes mounted at `/api/plugins/cron-insights/`
- Frontend served at `/dashboard-plugins/cron-insights/dist/`
- Watermark file is the source of truth for `rows_synced` and `last_sync`
- `--foreground-base` and `--background-base` are safe solid CSS variables; plain `--foreground`/`--background` may be alpha-transparent under Omatchy
