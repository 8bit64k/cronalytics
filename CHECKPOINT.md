# Cronalytics — Work Checkpoint
# Updated: 2026-05-02 21:15
#
## Current Commit
`850ccf4` (master) — "fix(ui): restore missing expandedId useState — fixes white screen"
Prior: `c248452` — Phase 4.7 Cost Projections, Schedule-Aware Budgeting
Prior: `4204cba` — rename: cron-insights → cronalytics (full sweep)

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend: `/summary` and `/jobs` APIs return projection data + token columns
3. Frontend: header uses shared `PageHeader` pattern (title, afterTitle badge, end slot)
4. Day selector (7D/30D/90D/All) — uniform solid borders, no bevel
5. Refresh button — right side of header, works
6. Summary cards: Total Runs, Est. Cost, Tokens
7. Cost by Model card renders
8. Jobs table: columns = Job | Runs | Total Cost | Avg Cost | Monthly | Next Run
9. Row expansion: click any job row → detail row opens below (schedule, last run+model, nominal/trend/drift, tokens)
10. Row expansion synced by `expandedId` state (fixed in `850ccf4`)

## How We Got Here
- Phase 4.7 implemented backend projections via `croniter` in new `schedule.py`, merged into `facts.py` + `plugin_api.py`
- Frontend table refactored to show projection columns + expandable detail rows
- `Button` component needed by plugin, but SDK wasn't rebuilt → plugin threw `TypeError` on missing `Button`
- Rebuilt host web app (`npm run build` in `~/.hermes/hermes-agent/web`) → `Button` now exported in bundled SDK
- Then discovered `expandedId` `useState` was accidentally dropped during frontend refactor → `ReferenceError` → white screen
- Fixed, force-committed (`dashboard/dist` is gitignored), reloaded dashboard, verified in browser

## Known Issues / Needs Feedback
- Nick reviewing on iPad; will write up thoughts tomorrow
- Summary card trend arrow (`→`) was temporarily replaced with `…` if loading; may need polish
- Last run + Model in expandable detail row — open to layout/viz preferences
- Drift values are fractional for short windows (expected but may need friendlier label)
- 632A8F13661E job has no schedule → "—" next run; may need manual schedule config or smarter fallback

## Pending Commits
None. Working tree is clean on master.

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: background (Hermes CLI serves built `web_dist/` via `hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Next session: likely aesthetic, info-density, or new feature work based on Nick's review
