# Cronalytics — Work Checkpoint
# Updated: 2026-05-06 17:15
#
## Current Commit
`05574e1` (layout-grid-2x4) — "ui(tweaks): Highest Pace card, leader card height balance, Pace subtitle readability, Per-Model spacing"

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace` (fixed-window math)
3. Backend `/jobs`: per-job `pace = trend / nominal` in projections object
4. Frontend: inline toolbar (day selector + refresh) inside tab content; no `usePageHeader` dependency
5. Day selector: SDK `<Button>` component (matches Analytics tab native style)
6. **Row 1 — Summary Board:** 4 cards (Job Runs, Cost, Tokens, Pace)
7. **Row 2 — Leader Board:** 4 spotlight cards (Most Runs, Highest Cost, Most Tokens, Highest Pace)
   - All leader icons use orange/red accent `#ff5722` for visual grouping
   - Headline colors match summary palette: runs=white, cost=amber `#f5a623`, tokens=blue `#5b8def`, pace=paceColor()
   - Job names truncated with ellipsis; native browser `title` tooltip on hover
8. Cost card: `$XX` headline amber; vs-prior delta + Actual sub-line
9. Pace card: font-only color `<1.0×` green, `<2.0×` neutral, `≥2.0×` red; Nominal/Trend sub-lines
10. Tokens card: blue headline `total_tokens` + In/Out/Cached micro proportion bars
11. Per-Model Breakdown: full-width horizontal proportional bar chart (amber `#f5a623` fill), top 5 cap, fade remainder
12. Jobs table columns: Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace — all sortable ↑/↓
13. Row hover highlights on both tables
14. Expandable detail rows: Tokens breakdown, single-line cron schedule + last run + next run
15. Pace font-only color logic — no background pills
16. Fixed-window math: both per-job and aggregate use selected `days` filter as denominator
17. Sync Now button works end-to-end
18. Stale-while-revalidate: no flash on day switch, only blank on first mount

## Nick's UI Polish Round (confirmed)
- `[Last 30 days]` badge → `[30D]` (or `[7D]`, `[90D]`, `[All]`)
- `Scheduled:` → `Nominal:`, `Projected:` → `Trend:` (consistent labels)
- Job detail row: removed Nominal/Trend/Pace/Drift duplicates; Tokens on top; single monospace schedule line
- Removed header-right sidebar badge (was not adding value)
- `Est. Cost` → `Cost` with `(estimated)` tag next to headline number
- All changes verified on iPad and Chrome MacBook; heights align, no droop

## New: At-a-Glance Summary Cards (2026-05-06)
- **Top Jobs** (single card, two stacked sections):
  - *Most Run*: highest `runs` from `jobList`; job name + run count.
  - *Highest Cost*: highest `total_cost` from `jobList`; job name + cost in amber `#f5a623`.
  - Sections divided by thin `rgba(255,255,255,0.06)` rule.
  - No "Last X days" label — clean name+number only.
  - Uses `ShieldAlertIcon` in header (shield with alert mark).
- Job names truncate with `text-overflow: ellipsis` to prevent layout breakage on long names.
- No backend changes — pure client-side derivation from existing `/jobs` data.

## Key Math (7D filter)
- Total est cost: $4.89
- Nominal (scheduled): $18.96/mo
- Trend (current pace): $19.96/mo
- Aggregate Pace: 1.05×

## How We Got Here
- Phase 4.7 implemented backend projections via `croniter` in new `schedule.py`
- Fixed-window redesign: removed data-span `projected_monthly_pace` from `query_summary()`, added per-job `pace` in `get_job_projections()`, computed aggregate `nominal_monthly_total` + `trend_monthly_total` + `pace` in `/summary` endpoint
- Frontend: `paceColor()` and `paceBg()` helpers, table restructured, detail rows expanded
- Commits: `e9aadaf09` (host web cache-busting), `747ceab` → `6c4fefe` (cronalytics)

## Phase 7 Progress: CLI Prototype (Working)
- **File**: `cli.py` (standalone, imports `facts.py` + `schedule.py` directly)
- **Commands implemented**:
  - `summary` — headline: runs, est cost, actual cost, tokens (total + In/Out/Cached), trend arrow
  - `jobs` — table: Job ID, Runs, Cost, Tokens, Pace (with projection math via `get_job_projections`)
  - `runs --job ID` — 50 most recent runs: Time, Duration, Cost, Tokens, Model
  - `models` — per-model: Model, Runs, Cost, Tokens
  - `trends` — daily bar chart (sparkline) with runs + cost
  - `health` — total runs, unique jobs, last ingested, last run time
- **--days** flag available on every command (default 30, 0 = all time)
- **Style**: ASCII box headers matching `hermes insights` format; compact tables aligned with monospace columns
- **Tested**: all commands run against live `facts.db`; output verified

## Known Issues / Needs Feedback
- Tooltips not showing on Chrome MacBook or iPad Safari (desktop hover works, tap/click does not). `title` attribute may need replacement approach (modal?)
- Detail row layout may need visual polish at tablet width

## Next Priority
- See PLAN.md for V1.0 backlog.

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
