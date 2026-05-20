# Checkpoint — 2026-05-19 (Session 3)

## Where we left off

**Branch:** `feat/cli-terminal-access`
**Latest commit:** `0d961be` — "fix: rename outcome filter 'both' → 'all' + audit skill references"
**Tests:** 149 passing, ruff + mypy clean

---

## Session Summary

Renamed CLI outcome filter value from `both` to `all` across all surfaces (CLI, Python queries, API, frontend, tests, docs, skill). Audited skill reference directory: 15 files triaged to 5 canonical reference docs, 10 session artifacts moved to `scratchpad/working-notes/`. Fixed three documentation inaccuracies Nick caught during review.

---

## Decisions Made

1. **Canonical outcome filter value is `all`**, not `both`. `both` accepted by API regex temporarily for backward compat with cached dashboard state; frontend normalizes on read.
2. **Skill `references/` directory is canonical** — 5 files kept, fixed, committed to repo. No more session artifacts in skill tree.
3. **`scratchpad/` = working notes, `skills/` = committed canonical docs.** Boundary is absolute.
4. **AGENTS.md now contains Phosphor session-start protocol** — must read AGENTS.md and CHECKPOINT.md every session before any file operation.

---

## Files Changed (committed to `feat/cli-terminal-access`)

### Core code
- `cronalytics/cli.py` — argparse `choices`/`default`: `both` → `all` (2 places)
- `cronalytics/facts.py` — function defaults: `outcome="both"` → `outcome="all"` (5 query functions); docstrings updated
- `dashboard/plugin_api.py` — FastAPI `Query` defaults + regex backward compat `^(all|both|success|failure)$` across 5 endpoints
- `dashboard/src/components/OutcomeToggle.js` — toggle value `both` → `all`
- `dashboard/src/components/CronalyticsTab.js` — localStorage default `both` → `all` + migration for cached stale values
- `dashboard/dist/index.js` — rebuilt bundle (118.7 KB)

### Tests
- `tests/test_cli.py` — `_json_envelope` expectations updated (`"both"` → `"all"`)

### Documentation
- `README.md` — v1.1.0 changelog line corrected
- `CHANGELOG.md` — v1.1.0 summary corrected
- `docs/USAGE.md` — CLI usage text and toggle description updated
- `dev/FEATURES.md` — shared flags text + `cli.py` module description corrected
- `dev/DESIGN.md` — CLI design principle #3 corrected
- `dev/AGENTS.md` — **NEW:** Phosphor Session Start Protocol, Skill Document Integrity rules, Integration Testing > Unit Testing rule, No False Coverage Claims rule

### Skill
- `skills/devops/cronalytics/SKILL.md` — intro + table row + pitfall block: `both` → `all`; removed `--json` from `all` command; fixed `--limit` default description; added `silent-failure-detection.md` to Reference Materials; softened reference file trust language
- `skills/devops/cronalytics/references/data-model.md` — **NEW in repo**; fixed `job_mode = null` → `"no_agent"`
- `skills/devops/cronalytics/references/direct-sqlite-workarounds.md` — **NEW in repo**; removed stale 50-run cap bug references
- `skills/devops/cronalytics/references/jq-diagnostic-patterns.md` — **NEW in repo**
- `skills/devops/cronalytics/references/silent-failure-detection.md` — **NEW in repo**
- `skills/devops/cronalytics/references/time-window-blind-spot.md` — **NEW in repo**; removed Nick-specific dataset references

### Moved to `scratchpad/working-notes/` (not committed, not canonical)
- `vhs-demo-patterns.md`, `prompt-framing-analysis.md`, `cli-performance-benchmarks.md`, `cross-surface-filter-parameter-checklist.md`, `signal-validation-queries.md`, `assessment-economics.md`, `sqlite-diagnostic-patterns.md`, `null-schedule-crash.md`, `cost-remediation-pitfalls.md`, `cli-default-flag-pitfalls.md`

---

## Verification Performed

```bash
uv run pytest -x -q          # 149 passed
node build.js                # dist/index.js rebuilt
```

Integration: Dashboard API accepts `"both"` and `"all"` (backward compat). Frontend normalizes cached `"both"` → `"all"`.

---

## Known Constraints / Gotchas

1. **API regex accepts `both` temporarily** — migration safety. Remove `both` from regex only after confirming no active cached states send it.
2. **`~/.hermes/skills/devops/cronalytics/` is a copy**, not a symlink to repo. After any skill change: `cp` modified files to installed location, or reinstall skill.
3. **Synthetic data still active** — `~/.hermes/cron/jobs.json` has 114 jobs (100 synthetic paused, 14 real paused). `~/.hermes/plugins/cronalytics/facts.db` has 38K runs. Real backups exist at `~/.hermes/cronalytics-backup/`.
4. **All `no_agent` jobs show `job_mode = "no_agent"`** in JSON output, not `null`. The reference `data-model.md` now reflects this.

---

## Open Questions / Next Actions

1. **Synthetic data cleanup** — Restore real backups when testing done:
   ```bash
   cp ~/.hermes/cronalytics-backup/jobs.json.real.bak ~/.hermes/cron/jobs.json
   cp ~/.hermes/cronalytics-backup/facts.db.real.bak ~/.hermes/plugins/cronalytics/facts.db
   ```
2. **Remove `both` from API regex** — After confirming no stale cached states.
3. ~~Dashboard job-runs modal limit~~ — **COMPLETED.** Raised from 50 -> 250. Added `total_runs` and `more_available` to `/jobs/{job_id}/runs` response. Frontend renders truncation notice with exact CLI fallback command when `more_available` is true.
---

## Resume Instructions

When Nick returns (or if compression hits):
1. Read `dev/AGENTS.md` — session start protocol is mandatory
2. Read this `CHECKPOINT.md` — current state is captured above
3. Verify branch: `git branch` should show `feat/cli-terminal-access`
4. Verify commit: `git log --oneline -1` should show `0d961be`
5. Decide on synthetic data restoration (see Open Questions)
6. Continue any remaining work on the branch
