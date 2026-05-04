# Cronalytics — Work Checkpoint
# Updated: 2026-05-03 23:20
#
## Current Commit
`61ddc6e` (master) — "feat(cli): standalone cronalytics CLI with summary/jobs/runs/models/trends/health subcommands"
Prior: `1e59353` — "docs: update CHECKPOINT and FEATURES for 0.3.0 polish + CLI prototype plan"
Prior: `6c4fefe` — "ui: 'Cost' header + '(estimated)' tag inline next to headline"
Prior: `e249ed9` — "fix(tokens): surface cache tokens — total_tokens headline, breakdown in sub-lines"
Prior: `747ceab` — "feat(projections): fixed-window Pace redesign — per-job + aggregate pace, color indicators, detail rows"

## What Works Now (Nick verified — "absolutely fantastic")
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace` (fixed-window math)
3. Backend `/jobs`: per-job `pace = trend / nominal` in projections object
4. Frontend header: shared PageHeader (title, afterTitle badge `[30D]`, day selector + refresh)
5. Day selector: uniform solid borders, no bevel
6. Summary cards (left→right): Total Runs | Cost (estimated) | Tokens | Pace
7. Cost card: `$XX` headline with `(estimated)` subscript tag inline; "Trend" sub-line
8. Pace card: colored ratio (cyan &lt;0.85, white 0.85–1.15, amber 1.15–1.50, red &gt;1.50); sub-lines labeled Nominal / Trend
9. Tokens card: `total_tokens` large headline + In / Out / Cached sub-lines
10. Cost by Model card renders
11. Jobs table columns: Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace
12. Pace column cells: colored text + background tint at extreme values
13. Expandable detail rows: Tokens breakdown, single-line cron schedule + last run + next run — Nominal/Trend/Pace/Drift removed (duplicates table columns)
14. Native `title` tooltips on table headers for Nominal/mo, Trend/mo, Pace
15. Fixed-window math: both per-job and aggregate use selected `days` filter as denominator
16. Plugin script URL cache-busting in host web app (per-load nonce)
17. Sync Now button works end-to-end

## Nick's UI Polish Round (confirmed)
- `[Last 30 days]` badge → `[30D]` (or `[7D]`, `[90D]`, `[All]`)
- `Scheduled:` → `Nominal:`, `Projected:` → `Trend:` (consistent labels)
- Job detail row: removed Nominal/Trend/Pace/Drift duplicates; Tokens on top; single monospace schedule line
- Removed header-right sidebar badge (was not adding value)
- `Est. Cost` → `Cost` with `(estimated)` tag next to headline number
- All changes verified on iPad and Chrome MacBook; heights align, no droop

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

## Next Priority: CLI Prototype (Phase 7)
Standalone `cronalytics` CLI command that mirrors `hermes insights` format:
- `cronalytics --days N` (default 30)
- Subcommands: `summary`, `trends`, `models`, `runs`, `health`
- Rich tables, same data points as dashboard
- Uses `facts.py` directly; no Hermes core changes needed
- Nick calls this "most value + polish for V1.0 release"

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
