# Cronalytics — Work Checkpoint
# Updated: 2026-05-11
#
## Current Commit
`f9f1d94` (master) — "docs(plan): mark M5 deferred to v1.1, M8 as document-in-README"

## Recently Delivered (2026-05-10–11)
- H9 Agent/no_agent mode awareness: schema `job_mode`, dual-track sync, `ModeToggle` toolbar, `[No agent]` badges, summary footnote, script job count in summary
- Toolbar polish: fixed-width per-model breakdown labels; `DaySelector` array-return wrapping; `OutcomeToggle`/`ModeToggle` labels; `[7D] [30D] [90D]` presets; `Go` button with Enter-key support; gap tuning
- Hero redesign: dictionary entry (`/ˈkrɒn.əˌlɪt.ɪks/ (noun)`), two definition lines, tagline `Observe. Measure. Optimize.`, `3px solid var(--color-accent)` left border, system-ui sans, no background tint
- Manual-sync UX: spinner animation, completion toast (fixed viewport bottom-center 5s auto-dismiss), freshness badge next to button, no artificial delay
- React hooks fix: restored `React.createElement(DaySelector, {...})` to prevent invariant #310 from plain function calls
- Sort inheritance: Job Detail Modal inherits parent `sortConfig` from Jobs Breakdown (click Cost-sorted job → cost-sorted runs)
- Detail modal limit: bumped default from 50 to 200 (backend ceiling 500)
- Duplicate loading elimination: `firstLoad` returns `null` instead of "Loading Cronalytics…" to let Hermes native spinner handle it
- Terminology unification: all user-facing `Script` → `No agent`
- PLAN.md updated: D7 deferred; M5 deferred to v1.1; M8 marked "document in README"
- LAUNCH_PLAN.md updated: realistic 8-day timeline, H9 delivered, M5/M7 status corrected

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace`, `script_jobs_in_window`, `success_runs`, `failure_runs`, `success_cost`, `failure_cost`
3. Backend `/jobs`: per-job `pace` in projections object, mode-aware filtering
4. Frontend: sticky toolbar with hero banner + toggle clusters + DaySelector + sync button
5. Day selector: preset `[7D] [30D] [90D]`, custom input with `Go` button/Enter key
6. **Row 1 — Summary Board:** 4 cards (Job Runs, Cost, Tokens, Pace)
   - Icons inherit text color with orange glow; sub-lines mono; trend arrows dynamic color
   - Tokens: neutral fill bars for In/Out/Cached proportions
   - Pace: proportional Nominal + Trend bars; font-only color (`1.0×` green, `2.0×` neutral, `>2.0×` red)
7. **Row 2 — Leader Board:** 4 spotlight cards (Top Runs, Top Cost, Top Tokens, Top Pace)
   - Icons use `#ff5722` accent; titles default text color; mono job names; height parity
8. Cost card: amber headline + ✓/✗ sub-line with wasted cost; conditional red headline in Failure mode
9. Tokens card: blue headline + proportion bars
10. Per-Model Breakdown: proportional bar chart, fixed-width right labels (cost + runs), top 5 cap
11. Jobs table: 7 sortable columns ↑/↓ with direction indicator; row hover; expandable detail rows (tokens + schedule + ✓/✗ + mode badge)
12. Job Detail Modal: 95% width, sticky headers, sortable run table (inherited sort), 200-run limit, mode column
13. Outcome toggle: `All | Success | Failure` with localStorage; Cost card color flips; Leader cards recompute
14. Mode toggle: `All | Agent | No agent` with localStorage; script badges; summary footnote
15. Sync Now: spinner while active, toast on completion, freshness badge, tab-scoped
16. Theme compatibility: silver icons, neutral bars, mono sub-lines, system-ui sans for definitions
17. No duplicate loading spinners — Hermes native spinner handles first load
18. Stale-while-revalidate: no flash on day switch or mode/outcome toggle

## Synthetic Test DB (seed_test_db.py)
- Dynamically loads real job IDs from `~/.hermes/cron/jobs.json`
- Proper 5-field cron interval parser (no broad substring matching)
- Corrected profiles: backup = agent; 4 watchdogs = no_agent recurring
- 120 days: ~1,356 runs (978 agent + 378 script), ~$33.82, ~10% failure rate
- Live facts.db now ~1,358 runs (watchdog jobs fired since generation)

## V1.0 Technical In-Scope (Remaining)
| # | Task | Status |
|---|------|--------|
| M3 | Minimal test suite (`pytest`) | 🟡 Not started |
| M4 | Lint / type check (`ruff` + `mypy`) | 🟡 Not started |
| M8 | Document wrapper vs payload success in README | 🟡 Not started |
| — | Cross-device regression (MacBook → iPad → themes) | 🟡 Not started |

## V1.0 Technical Out-of-Scope (V1.1+)
| # | Task | Reason |
|---|------|--------|
| H7 | Suspect/hung job detection | Troubleshooting edge case, low priority |
| M5 | Auto-sync | Bootstrap scanner + hook + retry cover gaps |
| D1–D7 | Budget alerts, model recommendations, schedule optimization, tool attribution, log streaming, external DB, modal pagination | See LAUNCH_PLAN.md |

## Launch Plan
- **Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
- **Days Remaining: 8**
- **Feature Freeze: Thursday, May 14**
- Full plan: See `LAUNCH_PLAN.md` at repo root

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
