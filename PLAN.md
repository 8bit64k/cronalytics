# Plan — Cronalytics

> What remains for V1.0. Everything here is either **not started** or **partially done and needs completion**.

This document replaces the previous phase-based plan with a flat priority-sorted task list. Items are pulled from DESIGN.md and FEATURES.md only if they are genuinely not implemented.

---

## 🟢 High (Significant User Value)

All high-priority technical items are **delivered** for V1.0.

| # | Task | Current State |
|---|------|---------------|
| H1 | **Success/failure cost split** | ✅ Backend: `success_runs`, `failure_runs`, `success_cost`, `failure_cost` on `/summary` and `/jobs`. Frontend: Cost card shows ✓/✗ counts + wasted cost; expandable job detail rows show per-job ✓/✗ breakdown. |
| H2 | **Per-job token columns in jobs table** | ✅ Token breakdown shown in expandable detail row below each job. Header-level token columns rejected to avoid horizontal overflow. |
| H3 | **Sortable jobs table** | ✅ All 8 columns sortable ↑/↓ with direction indicator. |
| H4 | **Top jobs highlight** | ✅ Leader Board: 4 cards (Top Runs, Top Cost, Top Tokens, Top Pace) with icon accents and mono job names. |
| H5 | **Per-run expansion in dashboard UI** | ✅ Modal-based job detail view with inline row expansion, sortable run table, sticky headers, 95% width, 200-run limit. |
| H6 | **Duration metrics** | ✅ Backend: `total_duration_seconds` + `avg_duration_seconds` in `/summary`; `total_duration` + `avg_duration` in `/jobs`. Frontend: `Avg Time` column in Jobs Breakdown (sortable); avg duration in Top Runs + Top Cost modals. |
| H7 | **Suspect/hung job detection** | ⚫ Deferred to v1.1+. Low surface area, troubleshooting-oriented rather than cost/visibility core. |
| H8 | **Global outcome toggle** | ✅ Toolbar toggle (All/Success/Failure). Inherits into job detail modal. Cost card conditional headline/color. LocalStorage persistence. |
| H9 | **Agent / no_agent mode awareness** | ✅ Schema, sync, API params, toolbar badge+filter+footnote. Script scanning from output directory. `[No agent]` badges. |

---

## 🟡 Medium (Quality of Life)

| # | Task | Current State |
|---|------|---------------|
| M1 | **README** | ✅ Rewritten for V1.0. |
| M2 | **CHANGELOG** | ✅ In README; standalone CHANGELOG.md deferred to v1.1. |
| M3 | **Test suite** | ✅ Delivered — 83 tests covering facts, parser, scanner, schedule, ingester, plugin API. All passing. |
| M4 | **Lint / type check** | ✅ Delivered — ruff + mypy clean on source files; `pyproject.toml` configured. |
| M5 | **Periodic auto-sync** | ⚫ Deferred to v1.1. Bootstrap scanner + hook + retry cover steady-state and restart gaps. |
| M6 | **iPad + theme compatibility pass** | ✅ Silver summary icons, mono sub-lines, neutral token bars, Leader Board titles default color, height parity, large-font theme resilience. |
| M7 | **Educational modals** | ✅ Delivered — Pace, Runs, Cost, Tokens modals with formulas and color guides. |
| M8 | **Success/failure split for wrapper vs payload** | ✅ Documented in README under "Understanding your data". |
| M9 | **Collapsible hero banner** | ✅ Delivered — expand/collapse toggle with localStorage persistence. Reclaims ~3.5 lines of vertical space. |

---

## ⚫ Deferred (Post-V1.0)

| # | Task | Why Deferred |
|---|------|--------------|
| D1 | **Budget thresholds with alerts** | Needs a notification system (Telegram, email) that Cronalytics does not own. |
| D2 | **Model comparison recommendations** | "Switch from Opus to Sonnet and save $X" requires stable pricing data and a recommendation engine. Out of scope. |
| D3 | **Schedule optimization** | "Runs every 5 min but produces output 10% of the time" requires analyzing session outputs, which we deliberately do not store. |
| D4 | **Tool-level cost attribution** | Would require joining with `session_messages`, which is large and not cached in the fact DB. |
| D5 | **Live log streaming** | Output files live at `~/.hermes/cron/output/`. Streaming them into the dashboard is a separate infrastructure project. |
| D6 | **External DB backend** | PostgreSQL, TimescaleDB, etc. SQLite is sufficient for single-user local usage. |
| D7 | **Job detail modal pagination** | Modal limits to 200 runs (default API `limit=200`). High-frequency jobs show correct run count in breakdown, but drill-down is capped. Needs "Load more" or pagination toggle. |
| D8 | **Focus trap in modals** | Medium effort with moderate DOM edge-case risk in Hermes plugin context. Escape/backdrop already work. |

---

## V1.1 / vNext Backlog

Items to be delivered on the `vNext` branch and merged when ready.

| # | Task | Status | Notes |
|---|------|--------|-------|
| V1 | **Leader Board "% of total"** | ✅ Merged to vNext | Top Runs, Top Cost, Top Tokens cards show leader's share of the aggregate (e.g. "83% of all runs"). Replaces the empty `3rem` spacer. |
| V2 | **Summary Board token trend** | Pending | Deferred until a non-redundant metric is identified. Raw token count correlates with run count. Candidate: tokens-per-run trend. Needs Tokens card space analysis first. |
| V3 | **Docs audience separation** | ✅ Merged | Move dev-only docs to `dev/`; keep user docs in `docs/`. Separate concerns. |
| V4 | **CLI cross-reference to `hermes insights`** | Deferred | Add tip at end of `cronalytics all` output pointing users to `hermes insights --source cron` for session-level detail (tools, models, skills). Deferred until Cronalytics has established primary muscle memory among users. Framing must position insights as diagnostic zoom, not replacement. |
| V5 | **Dashboard "Export JSON" button** | **Rejected** | *Dashboard for people, CLI for agents.* If users want programmatic data, they have `cronalytics <subcommand> --json` with exact matching filters. Dashboard should remain visual-first; adding JSON export blurs tool identity and invites feature-creep ("why doesn't it export runs too?"). CLI is the canonical machine-readable interface. |

---

## Upstream Signals — Feature Validation

Tracked from `NousResearch/hermes-agent` issues and PRs. These confirm the problem space Cronalytics occupies and identify gaps to fill.

| # | Author | What They Asked | Cronalytics Today | Gap / Opportunity |
|---|--------|-----------------|-------------------|-------------------|
| #23419 | nvst18 | Cron jobs burn provider credits without cost visibility or budget cap | Cost surfaced per run and per job; no budget enforcement | Budget alerting / spend ceiling |
| #20622 | arshad2k | Multi-profile cron jobs hidden from centralized monitoring | Default-profile only; non-default jobs invisible | Cross-profile scanner or hook propagation |
| #20412 | sanchomuzax | Separate Input/Output token charts + per-model breakdown | Model-level cost bars; no I/O token split | Input vs. Output token visualization |
| #24258 | Freffles | Model and provider attribution missing from cron UI | Model shown in job table; provider not surfaced | Provider column / filter |
| #6642 | xinbenlv | Unified telemetry for latency, cost, completion/failure rates | Cron-specific facts; latency tracked per session only | Expand beyond cron? Aggregate across all agent dispatches? |

---

## V1.0 Launch Status

**Feature freeze: May 14, 2026** ✅ Complete.  
**Launch date: May 19, 2026** — Packaging phase active.

### Remaining before launch
- [x] All technical features delivered and merged to master
- [x] Test suite: 83 tests passing
- [x] Lint/type: ruff + mypy clean
- [x] README rewritten
- [x] DESIGN.md rewritten
- [x] FEATURES.md rewritten
- [x] INSTALL.md updated
- [x] UNINSTALL.md created
- [x] USAGE.md created
- [x] X thread draft — written
- [x] Discord announcement draft — written
- [x] YouTube video description draft — written
- [ ] Demo video / GIF (May 16)
- [x] GitHub release — tag v1.0.0 (May 12, accelerated)
- [x] Demo video / GIF — `docs/screenshots/cronalytics-tour.gif`
- [x] X thread draft — written (7 tweets, in dev/LAUNCH_POSTS.md)
- [x] Discord announcement draft — written (in dev/LAUNCH_POSTS.md)
- [ ] X thread — posted
- [ ] Discord announcement — posted
- [ ] Final cross-device / cross-theme pass

---

*Version: 1.0.0*  
*Last updated: 2026-05-11 (night session)*
