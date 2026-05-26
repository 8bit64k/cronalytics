# Changelog

All notable changes to Cronalytics.

---

## v1.1.0 (2026-05-26)

### Added

- **Terminal CLI** — `cronalytics` command (via `pip install -e`) with 7 subcommands: `summary`, `jobs`, `runs`, `models`, `trends`, `health`, `all`. Full `--json` output on every data command except `all`. `--days`, `--outcome`, `--mode` filters across all commands. Leader Board spotlight in `summary`. Job name resolution from `jobs.json`.
- **Agent Diagnostic Skill** — Built-in `cronalytics` skill with structured 7-step diagnostic workflow (time window verification → baseline health → job-level drill → per-run investigation → failure pattern → model economics → trend validation). Confidence-graded anomaly detection (HIGH / MEDIUM / LOW) with supporting evidence requirements. "Known Ways to Fool Yourself" guardrails (age-gating, script job awareness, variance checks). Cross-references `jobs.json` for scheduling context and silent failure detection.
- **Test suite expanded to 149 tests** (83 original + 66 CLI tests) — all passing, `ruff` + `mypy` clean (note: `mypy` excludes `ingester.py`, `scanner.py`, `__init__.py`, and `dashboard/`; `disallow_untyped_defs = false`).
- **Multilingual/Localization Support (i18n)**: coverage for [en, es, zh, zh-hant]

### Changed

- **Package restructure** — Flat root modules moved into `cronalytics/` namespace package. Enables safe `pip install` without `site-packages` name collisions.
- **CLI positioning** — CLI is now documented as an optional pip add-on to the dashboard plugin, not a standalone product. Requires the plugin's `facts.db` to function.
- **Skill install** — No longer auto-linked by plugin; must be installed manually via `hermes skills install`.
- **Trend Spikes:** Gated arrows behind 1.75x history window to prevent false alarms.
- **UI Uniformity:** Consistent naming ("Avg Duration") and modernized icon-only refresh.

---

## v1.0.1 (2026-05-13)

### Added

- **Leader Board '% of total'** — spotlight cards show the leader's share of the window total (e.g. "42% of total cost")

### Changed

- **Cost card: suppressed Actual** — partial `actual_cost_usd` coverage creates misleading comparisons. The line now reads `Actual: —` until provider billing data coverage is reliable.

### Fixed

- **Backend fix** — synthetic script-only rows now insert `NULL` for `actual_cost_usd` (was 0.0), eliminating phantom `$0.00` aggregates.

---

## v1.0.0 (2026-05-12)

### Added

- Dashboard: Summary Board, Leader Board, Per-Model Breakdown, Jobs Breakdown table
- Sortable 8-column jobs table with expandable detail rows
- Job Detail Modal with full run history, sticky headers, inherited sorting
- Outcome toggle (All/Success/Failure) with conditional Cost card colors
- Mode toggle (All/Agent/No agent) with script job visibility
- Pace, Nominal, and Trend projections with educational modals
- Reconciliation scanner with watermark-based backfill
- Bootstrap scanner on plugin load (catches post-restart gaps)
- 83 pytest tests covering facts, parser, scanner, schedule, ingester, plugin API
- Lint/type check: `ruff` + `mypy` clean
- Keyboard-accessible cards and table headers (a11y)
- Large-font theme resilience
- API validation layer (JSDoc typedefs + runtime guards)

---

## v0.1.0

### Added

- Initial release: real-time ingestion, fact DB, reconciliation scanner, dashboard API, React frontend with summary cards, jobs table, cost-by-model, sync button.

---

*Plugin path: `~/.hermes/plugins/cronalytics/`*  
*Fact DB: `~/.hermes/plugins/cronalytics/facts.db`*  
*API base: `/api/plugins/cronalytics/`*
