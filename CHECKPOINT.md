# Project Checkpoints - Cronalytics


## Audit & Alignment (2026-05-20)
**Context:** Comprehensive documentation audit to resolve stale claims, cross-surface mismatches, and logic drift discovered in Code vs Docs.

### Technical Achievements:
- **Schema Hardening**: Updated `data-model.md` and `DESIGN.md` with Phase 2.5 metadata (`reasoning_tokens`, `cost_status`, `billing_provider`, `ingested_at`) and verified default values (`DEFAULT 0`).
- **Logic Sync**: Documented "hidden" code behaviors: SQLite WAL mode concurrency, `$HERMES_HOME` resolution priority, and `drift_ratio` existence.
- **CLI Normalization**: Corrected illegal `--json` flag on `all` command and fixed stale default limits (0 instead of 50).
- **Experimental Guardrails**: Categorized deep/unreliable metrics as "Experimental Deep Analytics" in `FEATURES.md`.

### Metadata:
- **Version**: Synchronized across all root docs as 1.1.0.
- **Branch**: `feat/cli-terminal-access` (Local) -> `feat/cli-terminal-access-review` (UAT).
- **Quality**: Verified 22 canonical documents against live `facts.db` and source code.


     1|# Checkpoint — 2026-05-19 (Session 3)
     2|
     3|## Where we left off
     4|
     5|**Branch:** `feat/cli-terminal-access`
     6|**Latest commit:** `0d961be` — "fix: rename outcome filter 'both' → 'all' + audit skill references"
     7|**Tests:** 149 passing, ruff + mypy clean
     8|
     9|---
    10|
    11|## Session Summary
    12|
    13|Renamed CLI outcome filter value from `both` to `all` across all surfaces (CLI, Python queries, API, frontend, tests, docs, skill). Audited skill reference directory: 15 files triaged to 5 canonical reference docs, 10 session artifacts moved to `scratchpad/working-notes/`. Fixed three documentation inaccuracies Nick caught during review.
    14|
    15|---
    16|
    17|## Decisions Made
    18|
    19|1. **Canonical outcome filter value is `all`**, not `both`. `both` accepted by API regex temporarily for backward compat with cached dashboard state; frontend normalizes on read.
    20|2. **Skill `references/` directory is canonical** — 5 files kept, fixed, committed to repo. No more session artifacts in skill tree.
    21|3. **`scratchpad/` = working notes, `skills/` = committed canonical docs.** Boundary is absolute.
    22|4. **AGENTS.md now contains Phosphor session-start protocol** — must read AGENTS.md and CHECKPOINT.md every session before any file operation.
    23|
    24|---
    25|
    26|## Files Changed (committed to `feat/cli-terminal-access`)
    27|
    28|### Core code
    29|- `cronalytics/cli.py` — argparse `choices`/`default`: `both` → `all` (2 places)
    30|- `cronalytics/facts.py` — function defaults: `outcome="both"` → `outcome="all"` (5 query functions); docstrings updated
    31|- `dashboard/plugin_api.py` — FastAPI `Query` defaults + regex backward compat `^(all|both|success|failure)$` across 5 endpoints
    32|- `dashboard/src/components/OutcomeToggle.js` — toggle value `both` → `all`
    33|- `dashboard/src/components/CronalyticsTab.js` — localStorage default `both` → `all` + migration for cached stale values
    34|- `dashboard/dist/index.js` — rebuilt bundle (118.7 KB)
    35|
    36|### Tests
    37|- `tests/test_cli.py` — `_json_envelope` expectations updated (`"both"` → `"all"`)
    38|
    39|### Documentation
    40|- `README.md` — v1.1.0 changelog line corrected
    41|- `CHANGELOG.md` — v1.1.0 summary corrected
    42|- `docs/USAGE.md` — CLI usage text and toggle description updated
    43|- `dev/FEATURES.md` — shared flags text + `cli.py` module description corrected
    44|- `dev/DESIGN.md` — CLI design principle #3 corrected
    45|- `dev/AGENTS.md` — **NEW:** Phosphor Session Start Protocol, Skill Document Integrity rules, Integration Testing > Unit Testing rule, No False Coverage Claims rule
    46|
    47|### Skill
    48|- `skills/devops/cronalytics/SKILL.md` — intro + table row + pitfall block: `both` → `all`; removed `--json` from `all` command; fixed `--limit` default description; added `silent-failure-detection.md` to Reference Materials; softened reference file trust language
    49|- `skills/devops/cronalytics/references/data-model.md` — **NEW in repo**; fixed `job_mode = null` → `"no_agent"`
    50|- `skills/devops/cronalytics/references/direct-sqlite-workarounds.md` — **NEW in repo**; removed stale 50-run cap bug references
    51|- `skills/devops/cronalytics/references/jq-diagnostic-patterns.md` — **NEW in repo**
    52|- `skills/devops/cronalytics/references/silent-failure-detection.md` — **NEW in repo**
    53|- `skills/devops/cronalytics/references/time-window-blind-spot.md` — **NEW in repo**; removed Nick-specific dataset references
    54|
    55|### Moved to `scratchpad/working-notes/` (not committed, not canonical)
    56|- `vhs-demo-patterns.md`, `prompt-framing-analysis.md`, `cli-performance-benchmarks.md`, `cross-surface-filter-parameter-checklist.md`, `signal-validation-queries.md`, `assessment-economics.md`, `sqlite-diagnostic-patterns.md`, `null-schedule-crash.md`, `cost-remediation-pitfalls.md`, `cli-default-flag-pitfalls.md`
    57|
    58|---
    59|
    60|## Verification Performed
    61|
    62|```bash
    63|uv run pytest -x -q          # 149 passed
    64|node build.js                # dist/index.js rebuilt
    65|```
    66|
    67|Integration: Dashboard API accepts `"both"` and `"all"` (backward compat). Frontend normalizes cached `"both"` → `"all"`.
    68|
    69|---
    70|
    71|## Known Constraints / Gotchas
    72|
    73|1. **API regex accepts `both` temporarily** — migration safety. Remove `both` from regex only after confirming no active cached states send it.
    74|2. **`~/.hermes/skills/devops/cronalytics/` is a copy**, not a symlink to repo. After any skill change: `cp` modified files to installed location, or reinstall skill.
    75|3. **Synthetic data still active** — `~/.hermes/cron/jobs.json` has 114 jobs (100 synthetic paused, 14 real paused). `~/.hermes/plugins/cronalytics/facts.db` has 38K runs. Real backups exist at `~/.hermes/cronalytics-backup/`.
    76|4. **All `no_agent` jobs show `job_mode = "no_agent"`** in JSON output, not `null`. The reference `data-model.md` now reflects this.
    77|
    78|---
    79|
    80|## Open Questions / Next Actions
    81|
    82|1. **Synthetic data cleanup** — Restore real backups when testing done:
    83|   ```bash
    84|   cp ~/.hermes/cronalytics-backup/jobs.json.real.bak ~/.hermes/cron/jobs.json
    85|   cp ~/.hermes/cronalytics-backup/facts.db.real.bak ~/.hermes/plugins/cronalytics/facts.db
    86|   ```
    87|2. **Remove `both` from API regex** — After confirming no stale cached states.
    88|3. ~~Dashboard job-runs modal limit~~ — **COMPLETED.** Raised from 50 -> 250. Added `total_runs` and `more_available` to `/jobs/{job_id}/runs` response. Frontend renders truncation notice with exact CLI fallback command when `more_available` is true.
    89|---
    90|
    91|## Resume Instructions
    92|
    93|When Nick returns (or if compression hits):
    94|1. Read `dev/AGENTS.md` — session start protocol is mandatory
    95|2. Read this `CHECKPOINT.md` — current state is captured above
    96|3. Verify branch: `git branch` should show `feat/cli-terminal-access`
    97|4. Verify commit: `git log --oneline -1` should show `0d961be`
    98|5. Decide on synthetic data restoration (see Open Questions)
    99|6. Continue any remaining work on the branch
   100|