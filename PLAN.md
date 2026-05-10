# Plan — Cronalytics

> What remains for V1.0. Everything here is either **not started** or **partially done and needs completion**.

This document replaces the previous phase-based plan with a flat priority-sorted task list. Items are pulled from DESIGN.md and FEATURES.md only if they are genuinely not implemented.

---

## 🟡 High (Significant User Value)

| # | Task | Why | Current State |
|---|------|-----|---------------|
|| H2 | **Per-job token columns in jobs table** | ~~Summary shows total tokens, but jobs table has no token attribution.~~ **Delivered.** Token breakdown is shown in the expandable detail row below each job. Header-level token columns were rejected to avoid horizontal overflow. | ✅ Detail rows show total, in, out, cached. |
|| H3 | **Sortable jobs table** | Table is currently static. Clicking column headers to sort by cost, runs, or pace is standard table UX. | ✅ All 7 columns sortable ↑/↓ with direction indicator. |
|| H4 | **Top jobs highlight** | Visual emphasis on the highest-spend / most-run jobs draws attention where it matters. | ✅ Leader Board: 4 cards (Top Runs, Top Cost, Top Tokens, Top Pace) with icon accents and mono job names. |
|| H1 | **Success/failure cost split** | `success` field exists in DB but is not surfaced in `/summary` or `/jobs`. A two-tone display (completed vs failed-to-finish) helps users spot broken cron jobs and wasted spend. Note: this reflects *wrapper-level* completion (the cron process finished), not payload-level success (the task did what it meant to). | ✅ Backend: `success_runs`, `failure_runs`, `success_cost`, `failure_cost` on `/summary` and `/jobs`. Frontend: Cost card shows ✓/✗ counts + wasted cost; expandable job detail rows show per-job ✓/✗ breakdown. |
||| H5 | **Per-run expansion in dashboard UI** | API serves `/jobs/{id}/runs`, but the frontend has no UI for it. Clicking a job row should show the last N individual runs. | ✅ Modal-based job detail view with inline row expansion, sortable run table, sticky headers, 95% width. Merged `feat/per-job-drilldown` 2026-05-10. |
||| H6 | **Duration metrics (avg duration, total duration)** | `duration_seconds` is computed and stored in the fact DB, but never surfaced in `/summary` or `/jobs`. Adding it to the Jobs Breakdown table and Top modals gives users visibility into slow/fast jobs and run performance. | ✅ Backend: `total_duration_seconds` + `avg_duration_seconds` in `/summary`; `total_duration` + `avg_duration` in `/jobs`. Frontend: `Time` column in Jobs Breakdown (sortable); avg duration in Top Runs + Top Cost modals. |
||| H7 | **Suspect / orphaned / hung cron job detection** | Cron jobs with `ended_at IS NULL` in state.db are either running normally, hung, or dead. Using the `avg_duration` heuristic — flag a job as suspect if `now > started_at + (3 × avg_duration)` — gives users a clear signal when something is stuck or orphaned without requiring manual state.db inspection. Surface as an "Active Jobs" card or suspect count badge. | Not started. |
|| H8 | **Global outcome toggle (Success / Failure / Both)** | A single toggle that refilters the entire dashboard: both (default), success, failure. In Success mode, every card and table shows only successful runs — your efficient spend. In Failure mode, shows only failures — your audit view. Jobs Breakdown sorts by failure cost; Cost card flips to "Wasted"; Leader cards spotlight top failure sources. Zero new UI patterns — just the same dashboard through a different lens. See discussion in session 2026-05-08. | ✅ Toolbar toggle (Success / Failure / All). Inherits into job detail modal. Cost card conditional headline/color. LocalStorage persistence. |

---

## 🟢 Medium (Quality of Life)

| # | Task | Why | Current State |
|---|------|-----|---------------|
|| M6 | **iPad + theme compatibility pass** | Mondwest font, hardcoded accent colors, and clashing progress bars break readability on iPad and across ~30 Omarchy themes. | ✅ Silver summary icons, mono sub-lines, neutral token bars, Leader Board titles default color, height parity. |
|| M1 | **README** | Someone other than us needs to install and use this. | Not started. |
|| M2 | **CHANGELOG** | Version history for users and future maintainers. | Not started. |
|| M3 | **Test suite** | Even a minimal `pytest` run covering `_make_job_id()` and projection math would catch regressions. | Not started. |
|| M4 | **Lint / type check** | `ruff` + `mypy` configuration. | Not started. |
|| M5 | **Periodic auto-sync** | A 6-hour background timer so the scanner runs without manual intervention. | Listed in old DESIGN.md but never implemented. |
|| M7 | **Educational modals** | Replaced native `title` tooltips with two modal layers: ⓘ info modals (metric definitions, formulas, interpretation) and Top card drill-down modals (#1 job details). Solves iPad tap-and-hold unreliability with intentional click interactions. Mono font, normal case body, 0.78rem detail blocks. | ✅ Delivered. |
|| M8 | **Success/failure split for wrapper vs payload** | Document (or decide) whether true payload-level success detection is in scope. Currently we only know if the *wrapper* completed. | Design decision pending. |

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

---

## Manual Verification Checklist

| # | Test | Notes |
|---|------|-------|
| V1 | **Delete a job → check dashboard** | Delete a cron job from the built-in `/cron` tab. Verify the old runs still appear in Cronalytics with raw `job_id` fallback (name and schedule show "No schedule" / "—"). |