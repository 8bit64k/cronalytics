# Cronalytics — Work Checkpoint
# Updated: 2026-05-08 20:15
#
## Current Commit
`905a7d3` (master) — "docs(PLAN): mark H1 success/failure split as delivered with wrapper-level caveat"

## Recently Delivered (2026-05-08 Evening)
- H6 Duration metrics: backend `total_duration_seconds` + `avg_duration_seconds`; frontend `fmtDuration` helper, "Avg Time" column in Jobs Breakdown, avg duration in Top Runs/Top Cost modals.
- H1 Success/Failure split: backend aggregates (`success_runs`, `failure_runs`, `success_cost`, `failure_cost`) on `/summary` and `/jobs`; frontend Cost card sub-line `✓ N · ✗ M ($X wasted)`, per-job detail row `✓ N · ✗ M`.

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace` (fixed-window math)
3. Backend `/jobs`: per-job `pace = trend / nominal` in projections object
4. Frontend: inline toolbar (day selector + refresh) inside tab content; no `usePageHeader` dependency
5. Day selector: SDK `Button` component (matches Analytics tab native style)
6. **Row 1 — Summary Board:** 4 cards (Job Runs, Cost, Tokens, Pace)
   - Icons inherit text color with orange glow (drop-shadow) for pop across light/dark themes
   - Sub-lines in monospace at readable size; trend arrows bumped to 1.05rem with dynamic color (red increase, green decrease)
   - Tokens: neutral fill bars (no hardcoded beige/green/pink) for In/Out/Cached proportions
   - Pace: proportional Nominal + Trend bars (mirrors token bar pattern)
7. **Row 2 — Leader Board:** 4 spotlight cards (Top Runs, Top Cost, Top Tokens, Top Pace)
   - Icons use orange/red accent `#ff5722`; card titles use default text color
   - Job names in monospace font with ellipsis truncation; 3rem height spacer for parity
8. Cost card: `$XX` headline amber; vs-prior delta + Actual sub-line
9. Pace card: font-only color (`1.0×` green, `2.0×` neutral, `2.0×` red); Nominal/Trend bars
10. Tokens card: blue headline `total_tokens` + In/Out/Cached micro proportion bars (neutral fill)
11. Per-Model Breakdown: full-width horizontal proportional bar chart (amber `#f5a623` fill), top 5 cap, fade remainder
12. Jobs table columns: Job | Runs | Total Cost | Avg Cost | Nominal/mo | Trend/mo | Pace — all sortable ↑/↓
13. Row hover highlights on both tables
14. Expandable detail rows: Tokens breakdown, single-line cron schedule + last run + next run
15. Pace font-only color logic — no background pills
16. Fixed-window math: both per-job and aggregate use selected `days` filter as denominator
17. Sync Now button works end-to-end
18. Stale-while-revalidate: no flash on day switch, only blank on first mount
19. Theme compatibility: hardcoded accent colors removed from Summary/Leader text; silver icons; mono sub-lines; neutral token bars
20. **M7 — Educational Modals (all 8 cards):** click any card → modal opens with detailed metric info, formula explanation, and live worked examples. Sparkle hover effect + Info icon (ⓘ) in top-right of every card. Escape or backdrop click to close.

## Nick's UI Polish Round (confirmed)
- `[Last 30 days]` badge → `[30D]` (or `[7D]`, `[90D]`, `[All]`)
- `Scheduled:` → `Nominal:`, `Projected:` → `Trend:` (consistent labels)
- Job detail row: removed Nominal/Trend/Pace/Drift duplicates; Tokens on top; single monospace schedule line
- Removed header-right sidebar badge
- `Est. Cost` → `Cost`
- Leader card titles: `Most Runs` → `Top Runs`, `Highest Cost` → `Top Cost`, `Most Tokens` → `Top Tokens`, `Highest Pace` → `Top Pace`
- All changes verified on iPad and Chrome MacBook; heights align, no droop

## 2026-05-07: Theme-Compatibility Pass (v2)
- Summary Board icons: silver (`color: "silver"`)
- Summary/Leader sub-lines: JetBrains Mono (`theme-font-mono`) at 0.75rem, opacity 0.85 (no more `opacity: 0.5` or mondwest fallthrough)
- Token bars + Pace bars: `var(--foreground-base, var(--foreground))` fill at 60% opacity (neutral across themes)
- Leader titles: default text color; icons keep `#ff5722` accent
- Pace card: replaced text-only Nominal/Trend with proportional bar rows (3.5rem labels, 4.5rem values)
- Trend arrows in Runs/Cost: bumped from 0.9rem to 1.05rem for readability

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
- Detail row layout may need visual polish at tablet width

## Completed Today (2026-05-07 Evening)
- `f3e90ef` Backend: `_enrich_jobs_with_names()` attaches `schedule` from `jobs.json`
- `e1b0dc2` Frontend: Top modals use `j.schedule.display` and `j.last_model` (fixes `[object Object]` and empty model)
- `b09774d` Frontend: dropped `Next run` from Top modals (ephemeral runtime field)
- `3d01d02` Frontend: added dynamic trend color to Runs summary card (red ↑, green ↓)
- `d74e740` PLAN.md: marked M7 Educational modals as delivered
- `15f83e3` Frontend: replaced silver icon color with theme-safe text color + orange glow
- `276ce28` Chore: renamed AGENT.md → AGENTS.md, added build session protocol

## 2026-05-10: No_Agent (Script Job) Placeholder + Synthetic Test DB

### Backend (commit `b447114`)
- `facts.py`: `job_mode` column on `cron_runs` (`agent` | `no_agent`); `ingest_script_row()` for synthetic script runs; mode filtering on all queries; per-job script watermark helper
- `config.py`: `OUTPUT_DIR` constant
- `scanner.py`: dual-track sync — agent rows from `state.db` + no_agent output directory scan using `cron_runs` itself as watermark
- `plugin_api.py`: `mode` query param on all endpoints; `script_jobs_in_window` in summary response

### Frontend (commit `02fa057`)
- `ModeToggle` toolbar component: `ALL | Agent | Script` with localStorage persistence
- Script badge inline on Jobs Breakdown rows + expanded detail line
- Mode column on Job Detail Modal (Script badge vs Agent text)
- Summary footnote when ALL mode includes script jobs: *"N script job(s) at $0.00 included. Filter to isolate agent costs."*

### Schema Migration (commit `0df6391`)
- Split `SCHEMA_SQL` (table creation) from `INDEX_SQL` (index creation)
- Auto-migrate existing DBs: `ALTER TABLE cron_runs ADD COLUMN job_mode TEXT DEFAULT 'agent'`

### PLAN.md (commit `350bd85`)
- H7 deferred to v1.1+ (troubleshooting edge case)
- H9 marked delivered

### Synthetic Test DB (`seed_test_db.py`)
- Generates `fact.test.db` with realistic data across 10 jobs (30 days default)
- Mix: gpt-4o-mini, gpt-4o, claude-sonnet-4 | varying frequencies, costs, durations, failure rates
- Includes 1 no_agent job (Backup, $0.00 cost) with 30 runs
- Total: ~2200 runs, ~$13 cost over 30 days
- Usage: `python3 seed_test_db.py [--days N]`

## Launch Plan
- **Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
- **Days Remaining: 11 (from May 9)**
- **Feature Freeze: Thursday, May 14**
- Full plan: See `LAUNCH_PLAN.md` at repo root

## V1.0 Technical In-Scope
| # | Task | Status |
|---|------|--------|
| H1 | Success/failure cost split | ✅ Delivered |
| H2 | Per-job token columns (detail rows) | ✅ Delivered |
| H3 | Sortable jobs table | ✅ Delivered |
| H4 | Top jobs highlight (Leader Board) | ✅ Delivered |
| H5 | Per-run expansion | 🟡 V1.0 — Day 1–2 |
| H6 | Duration metrics | ✅ Delivered |
| H7 | Suspect/hung job detection | 🟡 V1.0 — Day 2–3 |
| H8 | Global outcome toggle | ✅ Delivered |
| M5 | Auto-sync | 🟡 V1.0 if small; else V1.1 |
| M8 | Wrapper vs payload success | 🟡 V1.0 — document in README |

## Technical Out-of-Scope (V1.1+)
| # | Task | Reason |
|---|------|--------|
| D1 | Budget thresholds + alerts | Needs notification infra |
| D2 | Model comparison recommendations | Needs pricing engine |
| D3 | Schedule optimization | Needs session output analysis |
| D4 | Tool-level cost attribution | Needs `session_messages` join |
| D5 | Live log streaming | Separate infrastructure |
| D6 | External DB backend | SQLite sufficient for now |

## Next Priority
- See PLAN.md for V1.0 backlog.

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
