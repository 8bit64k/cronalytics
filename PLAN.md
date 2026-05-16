# Plan — Cronalytics

> What remains for V1.0 and beyond. This doc replaces phase-based planning with a flat priority-sorted task list.

---

## ✅ Delivered (V1.0.0 — V1.0.1)

| # | Task | State |
|---|------|-------|
| H1 | Success/failure cost split | Backend + frontend complete |
| H2 | Per-job token columns | Detail-row expansion (header-level rejected for overflow) |
| H3 | Sortable jobs table | 8 columns, ↑/↓ with direction indicator |
| H4 | Top jobs highlight | Leader Board: 4 cards with `% of total` |
| H5 | Per-run expansion | Modal drill-down, 200-run limit, sortable |
| H6 | Duration metrics | Backend + frontend, Avg Time column |
| H8 | Global outcome toggle | Toolbar toggle, localStorage persistence |
| H9 | Agent/no_agent mode awareness | Schema, sync, API, toolbar badges |
| M1 | README | Rewritten for V1.0 |
| M2 | CHANGELOG | In README; standalone deferred |
| M3 | Test suite | 137 tests passing (83 + 54 CLI) |
| M4 | Lint / type check | ruff + mypy clean |
| M6 | iPad + theme compatibility | Silver icons, mono sub-lines, large-font resilience |
| M7 | Educational modals | Pace, Runs, Cost, Tokens with formulas |
| M8 | Success/failure split docs | README section |
| M9 | Collapsible hero banner | localStorage persistence |
| CLI | Full terminal parity | `summary`, `jobs`, `runs`, `models`, `trends`, `health`, `all` + `--json` |
| Skill | `devops/cronalytics` diagnostic skill | v1.0.0, validated through 6-test protocol |

---

## ✅ Delivered (Post-V1.0.1, This Session)

| # | Task | State |
|---|------|-------|
| Skill testing protocol | 6 controlled test runs, 1 empirical probe | Complete — all artifacts in `scratchpad/skill-test/` |
| Comparison report | Meta-narrative report + pairwise matrix | Complete — `comparison_report.md` + `pairwise_comparison.md` |
| CLI `--json` pace fix | JSON path now includes all projection fields | Fixed and verified |
| Skill limitation cleanup | Removed stale `--json` pace caveat | Done |
| Runtime skill cleanup | Removed human artifacts from `~/.hermes/skills/devops/cronalytics/` | Done |

---

## 🟢 Immediate (No Blockers)

| # | Task | Why | Notes |
|---|------|-----|-------|
|| **None** | Skill is validated. CLI is fixed. Report is written. Everything in scope is done. ||

---

## 🟡 Optional / If Time Permits

| # | Task | Why | Notes |
|---|------|-----|-------|
| O1 | Publish comparison report | Community value | Could become a blog post, repo doc, or Hacker News submission. The "Guidelines over Rules" finding is generalizable beyond Cronalytics. |
| O2 | Extract skill-testing protocol | Reusability | The controlled testing methodology (fresh sessions, pinned variables, cache invalidation) could be a standalone artifact in `docs/` or the skill-authoring skill. |
| O3 | Fix Watchdog script failures | Real operational finding from T6 | 4 jobs failing with "Script not found" since May 10. Not a Cronalytics bug — a Hermes deployment issue. Agent provided exact job IDs and remediation steps. |
| O4 | v1.0.2 release | Ship CLI pace-in-JSON fix | One-line-of-code fix, but user-facing. If anyone is scripting against `cronalytics jobs --json`, they currently get `null` for pace. |

---

## ⚫ Deferred (Post-V1.0)

| # | Task | Why Deferred |
|---|------|--------------|
| D1 | Budget thresholds with alerts | Needs notification system Cronalytics doesn't own |
| D2 | Model comparison recommendations | Needs stable pricing data + recommendation engine |
| D3 | Schedule optimization | Requires analyzing session outputs (deliberately not stored) |
| D4 | Tool-level cost attribution | Requires joining with `session_messages` (large, not cached) |
| D5 | Live log streaming | Separate infrastructure project |
| D6 | External DB backend | SQLite sufficient for single-user local usage |
| D7 | Job detail modal pagination | Modal caps at 200 runs; "Load more" needed for high-frequency jobs |
| D8 | Focus trap in modals | Medium effort, moderate DOM edge-case risk |
| H7 | Suspect/hung job detection | Low surface area, troubleshooting-oriented rather than core |
| M5 | Periodic auto-sync | Bootstrap scanner + hook + retry cover steady-state gaps |

---

## V1.1 / vNext Backlog

| # | Task | Status | Notes |
|---|------|--------|-------|
| V1 | Leader Board "% of total" | ✅ Merged to vNext | Already done |
| V3 | Docs audience separation | ✅ Merged | Dev docs in `dev/`, user docs in `docs/` |
| V4 | CLI cross-reference to `hermes insights` | Deferred | Waiting for Cronalytics to establish primary muscle memory |
| V5 | Dashboard "Export JSON" button | **Rejected** | "Dashboard for people, CLI for agents" — CLI is the canonical machine interface |
| V6 | Skill-testing protocol as artifact | Pending | Could be extracted from `scratchpad/skill-test/README.md` |

---

## V1.0 Launch Status

- **Feature freeze:** May 14, 2026 ✅
- **Launch date:** May 19, 2026 ✅
- **Stars:** 41 | **Clones:** 301 (148 unique) | **Views:** 376 (119 unique)

### Remaining before next activity
- [ ] Optional: Publish comparison report / blog post
- [ ] Optional: Fix Watchdog script failures (Hermes deployment, not Cronalytics code)
- [x] v1.0.2 release candidate — `--json` pace fix + Leader Board feature (code ready)

---

## Skill Testing Status

**Completed:** 2026-05-16

| Test | Skill Version | Result |
|------|---------------|--------|
| T1 | None (auto-discovery) | Baseline — 9m, unstructured, 1 false positive |
| T2 | Baseline (cached) | Contaminated — cache invalidation lesson |
| T3 | Baseline (fresh) | Structured but same false positive |
| T4 v1 | Baseline + show-work | Deep, but used SQLite |
| T4 v2 | Updated (+Step 3, SQLite prohibition) | New findings, same false positive, rigid rule backfired |
| T5 | Updated + jobs.json | Zero false positives, missed silent failures |
| T6 | **Updated + confidence + guardrails** | **8 anomalies, 0 false positives, 4 new findings** |

**Protocol validated:** Iterative skill development produces measurably better agent diagnostics. Full documentation in `scratchpad/skill-test/comparison_report.md`.

---

*Version: 1.1.0*  
*Skill version: 1.1.0 (pinned to product)*  
*Last updated: 2026-05-16 (v1.1.0 prep complete)*
