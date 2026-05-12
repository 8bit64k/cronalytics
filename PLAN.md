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
- [ ] Demo video / GIF (May 16)
- [ ] GitHub release tag v1.0.0 (May 19)
- [ ] X thread draft (May 17)
- [ ] Discord announcement draft (May 18)
- [ ] Final cross-device regression pass

---

*Version: 1.0.0*  
*Last updated: 2026-05-11*
