# Cronalytics — Work Checkpoint
# Updated: 2026-05-11
#
## Current Commit
`b7980e0` (master) — "docs(CHECKPOINT): update to 31f3206 (large-font layout)"

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
- **M3** — Minimal test suite (`pytest`): 83 tests covering facts, parser, scanner, schedule, ingester, plugin API. All passing.
- **M4** — Lint / type check (`ruff` + `mypy`): clean on source files; `pyproject.toml` configs in place.
- **M8** — Document wrapper vs payload success in README: one-paragraph section under "Understanding your data".
- **Large-font theme resilience**: `minmax(0, 1fr)` grid columns, `minWidth: 0` on cards, `nowrap` + ellipsis on overflow-prone text, flex-basis instead of fixed widths in ModelBreakdown
- **Error-handling refactor**: replaced 13 bare `except Exception` with specific types (`OSError`, `json.JSONDecodeError`, `sqlite3.Error`, `ValueError`, `TypeError`, `ImportError`); `exc_info=True` on unexpected logger calls; upgraded warn→error for unexpected failures.
- **Plugin `__init__.py`**: added bootstrap scanner call on plugin load (catches stale gaps after gateway restarts).
- **Monolith source split** → modular `src/` tree (certified & merged to master):
  - Extracted 13 source files from 1,811-line `dist/index.js` monolith
  - `src/components/HeroBanner.js`, `SummaryBoard.js`, `LeaderBoard.js`, `ModelBreakdown.js`, `JobBreakdown.js`
  - `src/components/CronalyticsTab.js` — orchestrator (~370 lines)
  - `src/components/DaySelector.js`, `ModeToggle.js`, `OutcomeToggle.js`, `JobDetailView.js`, `Modal.js`, `ErrorBoundary.js`, `SparkLine.js`
  - `src/hooks/useApi.js`, `src/lib/sdk.js`, `src/lib/formatters.js`, `src/lib/icons.js`, `src/lib/validate.js`
  - Build: `dashboard/build.js` (esbuild IIFE bundler) → `dist/index.js` (~113 KB)
- **API validation layer**: JSDoc `@typedef` annotations + thin `assertType()` runtime guard for 6 API shapes; dev-only via `NODE_ENV` check
- **a11y**: Keyboard-accessible table headers and summary/leader cards (`tabIndex`, `role`, `aria-label`, `onKeyDown`)
- **Toolbar progressive wrapping**: flattened flexbox structure — Refresh breaks first at 110%, custom+Go at 120%, DaySelector cluster at 130%
- **Documentation rewrite**: README.md, DESIGN.md, FEATURES.md, INSTALL.md, UNINSTALL.md, USAGE.md, PLAN.md, LAUNCH_PLAN.md all updated for V1.0

## What Works Now
1. Dashboard loads; Cronalytics tab renders without white screen
2. Backend `/summary`: `nominal_monthly_total`, `trend_monthly_total`, `pace`, `script_jobs_in_window`, `success_runs`, `failure_runs`, `success_cost`, `failure_cost`
3. Backend `/jobs`: per-job `pace` in projections object, mode-aware filtering
4. Frontend: sticky toolbar with hero banner + toggle clusters + DaySelector + sync button; progressive zoom-responsive wrapping
5. Day selector: preset `[7D] [30D] [90D]`, custom input with `Go` button/Enter key (max 365)
6. **Row 1 — Summary Board:** 4 cards (Job Runs, Cost, Tokens, Pace)
   - Icons inherit text color with orange glow; sub-lines mono; trend arrows dynamic color
   - Tokens: neutral fill bars for In/Out/Cached proportions
   - Pace: proportional Nominal + Trend bars; font-only color (`1.0×` green, `2.0×` neutral, `>2.0×` red)
7. **Row 2 — Leader Board:** 4 spotlight cards (Top Runs, Top Cost, Top Tokens, Top Pace)
   - Icons use `#ff5722` accent; titles default text color; mono job names; height parity
8. Cost card: amber headline + ✓/✗ sub-line with wasted cost; conditional red headline in Failure mode
9. Tokens card: blue headline + proportion bars
10. Per-Model Breakdown: proportional bar chart, flex-basis right labels (cost + runs), top 5 cap
11. Jobs table: 8 sortable columns ↑/↓ with direction indicator; row hover; expandable detail rows (tokens + schedule + ✓/✗ + mode badge)
12. Job Detail Modal: 95% width, sticky headers, sortable run table (inherited sort), 200-run limit, mode column
13. Outcome toggle: `All | Success | Failure` with localStorage; Cost card color flips; Leader cards recompute
14. Mode toggle: `All | Agent | No agent` with localStorage; script badges; summary footnote
15. Sync Now: spinner while active, toast on completion, freshness badge, tab-scoped
16. Theme compatibility: silver icons, neutral bars, mono sub-lines, system-ui sans for definitions
17. No duplicate loading spinners — Hermes native spinner handles first load
18. Stale-while-revalidate: no flash on day switch or mode/outcome toggle
19. **Test suite**: 83 pytest tests, all passing (`pytest -q`)
20. **Lint/type**: ruff clean, mypy clean on source files
21. **Bootstrap scanner**: plugin `__init__.py` syncs watermarks on load (catches post-restart gaps)
22. **Source architecture**: modular `src/` tree with esbuild bundler
23. **API validation**: JSDoc typedefs + thin runtime guard — dev-only `assertType()` for 6 API shapes
24. **a11y**: Keyboard-accessible table headers and summary/leader cards (tabIndex, role, aria-label, Enter/Space)
25. **Large-font theme support**: grid cells shrink below content width without spillover; ModelBreakdown uses flex-basis; JobBreakdown detail rows don't push buttons off-screen
26. **Documentation**: complete rewrite of README, DESIGN, FEATURES, INSTALL, UNINSTALL, USAGE, PLAN, LAUNCH_PLAN

## V1.0 Technical In-Scope (Remaining)
| # | Task | Status |
|---|------|--------|
| — | Cross-device regression (MacBook → iPad → themes) | ✅ Completed by Nick 2026-05-11; large-font theme fix merged |

## V1.0 Technical Out-of-Scope (V1.1+)
| # | Task | Reason |
|---|------|--------|
| H7 | Suspect/hung job detection | Troubleshooting edge case, low priority |
| M5 | Auto-sync | Bootstrap scanner + hook + retry cover gaps |
| D1–D8 | Budget alerts, model recommendations, schedule optimization, tool attribution, log streaming, external DB, modal pagination, focus trap | See LAUNCH_PLAN.md |

## Launch Plan
- **Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
- **Days Remaining: 8**
- **Feature Freeze: Thursday, May 14** ✅ COMPLETE
- Full plan: See `LAUNCH_PLAN.md` at repo root

## Packaging Phase (May 15–19)
- [x] README.md — rewritten
- [x] DESIGN.md — rewritten
- [x] FEATURES.md — rewritten
- [x] USAGE.md — created
- [x] INSTALL.md — updated
- [x] UNINSTALL.md — created
- [x] PLAN.md — synced
- [x] LAUNCH_PLAN.md — synced
- [ ] Demo video / GIF (May 16)
- [ ] GitHub release — tag v1.0.0 (May 19)
- [ ] X thread draft (May 17)
- [ ] Discord announcement draft (May 18)
- [ ] Final cross-device / cross-theme pass

## Rejoin Instructions
- Tab open at `https://hermes.tail315577.ts.net/`
- Plugin loaded from `~/.hermes/plugins/cronalytics` symlink
- Dashboard process: PID managed by Hermes CLI (`hermes dashboard --port 9119 --host 0.0.0.0 --insecure --no-open`)
- Hot reload: browser hard refresh picks up new `dashboard/dist/index.js` (cache-busting nonce in host web)
