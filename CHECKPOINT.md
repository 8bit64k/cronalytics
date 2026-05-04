# Cronalytics — Work Checkpoint
# Updated: 2026-05-03 18:45
#
## Current Commit
`734e573` (master) — "ui: [XD] badge, Nominal/Trend labels, slim detail row, drop header-right badge"
Prior: `e249ed9` — "fix(tokens): surface cache tokens — total_tokens headline, breakdown in sub-lines"
Prior: `747ceab` — "feat(projections): fixed-window Pace redesign — per-job + aggregate pace, color indicators, detail rows"

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace` (fixed-window math)
3. Backend `/jobs`: per-job `pace = trend / nominal` in projections object
4. Frontend header: shared PageHeader (title, afterTitle badge `[30D]`, day selector + refresh)
5. Day selector: uniform solid borders, no bevel
6. Summary cards (left→right): Total Runs | Est. Cost | Tokens | Pace
7. Pace card: colored ratio (cyan &lt;0.85, white 0.85–1.15, amber 1.15–1.50, red &gt;1.50); sub-lines labeled Nominal / Trend
8. Cost by Model card renders
9. Jobs table columns: Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace
10. Pace column cells: colored text + background tint at extreme values
11. Expandable detail rows (colSpan 7): Tokens breakdown, single-line cron schedule + last run + next run — Nominal/Trend/Pace/Drift removed (duplicates table columns)
12. Native `title` tooltips on table headers for Nominal/mo, Trend/mo, Pace
13. Fixed-window math: both per-job and aggregate use selected `days` filter as denominator
14. Plugin script URL cache-busting in host web app (per-load nonce)

## Key Math (7D filter)
- Total est cost: $4.66
- Nominal (scheduled): $18.96/mo
- Trend (current pace): $19.96/mo
- Aggregate Pace: 1.05×

## How We Got Here
- Phase 4.7 implemented backend projections via `croniter` in new `schedule.py`
- Fixed-window redesign: removed data-span `projected_monthly_pace` from `query_summary()`, added per-job `pace` in `get_job_projections()`, computed aggregate `nominal_monthly_total` + `trend_monthly_total` + `pace` in `/summary` endpoint
- Frontend: `paceColor()` and `paceBg()` helpers, table restructured, detail rows expanded
- Commits: `e9aadaf09` (host web cache-busting), `747ceab` (cronalytics)

## Known Issues / Needs Feedback
- Nick reviewing on iPad — hard refresh to pick up latest `dashboard/dist/index.js`
- Tooltips only visible on desktop hover; tap-and-hold on iPad may not show `title` attributes consistently (Chrome on MacBook also not showing — investigate)
- Detail row layout may need visual polish at tablet width

## Next Steps (Nick decides priority)
1. Math verification / new-user walkthrough
2. Verbiage refinements
3. Tooltip polish (modal on tap?)
4. Any iPad-specific layout refinements

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
