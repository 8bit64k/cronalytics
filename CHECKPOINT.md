# Project Checkpoints - Cronalytics


## Skill Installation & Structure Refinement (2026-05-20 - Part II)
**Context:** Standardized repository structure for various skill installation methods and added user guidance for manual skill loading.

### Technical Achievements:
- **Repo Restructuring**: Flattened `/skills` and moved content to `/skills/cronalytics/`. This ensures `hermes skills install owner/repo/path` correctly places the skill in the user's `devops` category without redundant nesting.
- **Manual Load Guidance**: Documented the `/cronalytics` slash-command in `README.md` to help users who need to force-load the skill in active chat sessions.
- **Dual-Install Methods**: Updated `README.md` and `INSTALL.md` to support both the robust `cp -r` method (preserving local references) and the automated CLI method (targeting the new sub-path).

### Metadata:
- **Path Compatibility**: Targeted `8bit64k/cronalytics/skills/cronalytics` as the canonical remote install path.
- **Branch Parity**: Local `feat/cli-terminal-access` and UAT `feat/cli-terminal-access-review` are fully synchronized.


     1|
     2|
     3|
     4|## Audit & Alignment (2026-05-20)
     5|**Context:** Comprehensive documentation audit to resolve stale claims, cross-surface mismatches, and logic drift discovered in Code vs Docs.
     6|
     7|### Technical Achievements:
     8|- **Schema Hardening**: Updated `data-model.md` and `DESIGN.md` with Phase 2.5 metadata (`reasoning_tokens`, `cost_status`, `billing_provider`, `ingested_at`) and verified default values (`DEFAULT 0`).
     9|- **Logic Sync**: Documented "hidden" code behaviors: SQLite WAL mode concurrency, `$HERMES_HOME` resolution priority, and `drift_ratio` existence.
    10|- **CLI Normalization**: Corrected illegal `--json` flag on `all` command and fixed stale default limits (0 instead of 50).
    11|- **Experimental Guardrails**: Categorized deep/unreliable metrics as "Experimental Deep Analytics" in `FEATURES.md`.
    12|
    13|### Metadata:
    14|- **Version**: Synchronized across all root docs as 1.1.0.
    15|- **Branch**: `feat/cli-terminal-access` (Local) -> `feat/cli-terminal-access-review` (UAT).
    16|- **Quality**: Verified 22 canonical documents against live `facts.db` and source code.
    17|
    18|
    19|     1|# Checkpoint — 2026-05-19 (Session 3)
    20|     2|
    21|     3|## Where we left off
    22|     4|
    23|     5|**Branch:** `feat/cli-terminal-access`
    24|     6|**Latest commit:** `0d961be` — "fix: rename outcome filter 'both' → 'all' + audit skill references"
    25|     7|**Tests:** 149 passing, ruff + mypy clean
    26|     8|
    27|     9|---
    28|    10|
    29|    11|## Session Summary
    30|    12|
    31|    13|Renamed CLI outcome filter value from `both` to `all` across all surfaces (CLI, Python queries, API, frontend, tests, docs, skill). Audited skill reference directory: 15 files triaged to 5 canonical reference docs, 10 session artifacts moved to `scratchpad/working-notes/`. Fixed three documentation inaccuracies Nick caught during review.
    32|    14|
    33|    15|---
    34|    16|
    35|    17|## Decisions Made
    36|    18|
    37|    19|1. **Canonical outcome filter value is `all`**, not `both`. `both` accepted by API regex temporarily for backward compat with cached dashboard state; frontend normalizes on read.
    38|    20|2. **Skill `references/` directory is canonical** — 5 files kept, fixed, committed to repo. No more session artifacts in skill tree.
    39|    21|3. **`scratchpad/` = working notes, `skills/` = committed canonical docs.** Boundary is absolute.
    40|    22|4. **AGENTS.md now contains Phosphor session-start protocol** — must read AGENTS.md and CHECKPOINT.md every session before any file operation.
    41|    23|
    42|    24|---
    43|    25|
    44|    26|## Files Changed (committed to `feat/cli-terminal-access`)
    45|    27|
    46|    28|### Core code
    47|    29|- `cronalytics/cli.py` — argparse `choices`/`default`: `both` → `all` (2 places)
    48|    30|- `cronalytics/facts.py` — function defaults: `outcome="both"` → `outcome="all"` (5 query functions); docstrings updated
    49|    31|- `dashboard/plugin_api.py` — FastAPI `Query` defaults + regex backward compat `^(all|both|success|failure)$` across 5 endpoints
    50|    32|- `dashboard/src/components/OutcomeToggle.js` — toggle value `both` → `all`
    51|    33|- `dashboard/src/components/CronalyticsTab.js` — localStorage default `both` → `all` + migration for cached stale values
    52|    34|- `dashboard/dist/index.js` — rebuilt bundle (118.7 KB)
    53|    35|
    54|    36|### Tests
    55|    37|- `tests/test_cli.py` — `_json_envelope` expectations updated (`"both"` → `"all"`)
    56|    38|
    57|    39|### Documentation
    58|    40|- `README.md` — v1.1.0 changelog line corrected
    59|    41|- `CHANGELOG.md` — v1.1.0 summary corrected
    60|    42|- `docs/USAGE.md` — CLI usage text and toggle description updated
    61|    43|- `dev/FEATURES.md` — shared flags text + `cli.py` module description corrected
    62|    44|- `dev/DESIGN.md` — CLI design principle #3 corrected
    63|    45|- `dev/AGENTS.md` — **NEW:** Phosphor Session Start Protocol, Skill Document Integrity rules, Integration Testing > Unit Testing rule, No False Coverage Claims rule
    64|    46|
    65|    47|### Skill
    66|    48|- `skills/devops/cronalytics/SKILL.md` — intro + table row + pitfall block: `both` → `all`; removed `--json` from `all` command; fixed `--limit` default description; added `silent-failure-detection.md` to Reference Materials; softened reference file trust language
    67|    49|- `skills/devops/cronalytics/references/data-model.md` — **NEW in repo**; fixed `job_mode = null` → `"no_agent"`
    68|    50|- `skills/devops/cronalytics/references/direct-sqlite-workarounds.md` — **NEW in repo**; removed stale 50-run cap bug references
    69|    51|- `skills/devops/cronalytics/references/jq-diagnostic-patterns.md` — **NEW in repo**
    70|    52|- `skills/devops/cronalytics/references/silent-failure-detection.md` — **NEW in repo**
    71|    53|- `skills/devops/cronalytics/references/time-window-blind-spot.md` — **NEW in repo**; removed Nick-specific dataset references
    72|    54|
    73|    55|### Moved to `scratchpad/working-notes/` (not committed, not canonical)
    74|    56|- `vhs-demo-patterns.md`, `prompt-framing-analysis.md`, `cli-performance-benchmarks.md`, `cross-surface-filter-parameter-checklist.md`, `signal-validation-queries.md`, `assessment-economics.md`, `sqlite-diagnostic-patterns.md`, `null-schedule-crash.md`, `cost-remediation-pitfalls.md`, `cli-default-flag-pitfalls.md`
    75|    57|
    76|    58|---
    77|    59|
    78|    60|## Verification Performed
    79|    61|
    80|    62|```bash
    81|    63|uv run pytest -x -q          # 149 passed
    82|    64|node build.js                # dist/index.js rebuilt
    83|    65|```
    84|    66|
    85|    67|Integration: Dashboard API accepts `"both"` and `"all"` (backward compat). Frontend normalizes cached `"both"` → `"all"`.
    86|    68|
    87|    69|---
    88|    70|
    89|    71|## Known Constraints / Gotchas
    90|    72|
    91|    73|1. **API regex accepts `both` temporarily** — migration safety. Remove `both` from regex only after confirming no active cached states send it.
    92|    74|2. **`~/.hermes/skills/devops/cronalytics/` is a copy**, not a symlink to repo. After any skill change: `cp` modified files to installed location, or reinstall skill.
    93|    75|3. **Synthetic data still active** — `~/.hermes/cron/jobs.json` has 114 jobs (100 synthetic paused, 14 real paused). `~/.hermes/plugins/cronalytics/facts.db` has 38K runs. Real backups exist at `~/.hermes/cronalytics-backup/`.
    94|    76|4. **All `no_agent` jobs show `job_mode = "no_agent"`** in JSON output, not `null`. The reference `data-model.md` now reflects this.
    95|    77|
    96|    78|---
    97|    79|
    98|    80|## Open Questions / Next Actions
    99|    81|
   100|    82|1. **Synthetic data cleanup** — Restore real backups when testing done:
   101|    83|   ```bash
   102|    84|   cp ~/.hermes/cronalytics-backup/jobs.json.real.bak ~/.hermes/cron/jobs.json
   103|    85|   cp ~/.hermes/cronalytics-backup/facts.db.real.bak ~/.hermes/plugins/cronalytics/facts.db
   104|    86|   ```
   105|    87|2. **Remove `both` from API regex** — After confirming no stale cached states.
   106|    88|3. ~~Dashboard job-runs modal limit~~ — **COMPLETED.** Raised from 50 -> 250. Added `total_runs` and `more_available` to `/jobs/{job_id}/runs` response. Frontend renders truncation notice with exact CLI fallback command when `more_available` is true.
   107|    89|---
   108|    90|
   109|    91|## Resume Instructions
   110|    92|
   111|    93|When Nick returns (or if compression hits):
   112|    94|1. Read `dev/AGENTS.md` — session start protocol is mandatory
   113|    95|2. Read this `CHECKPOINT.md` — current state is captured above
   114|    96|3. Verify branch: `git branch` should show `feat/cli-terminal-access`
   115|    97|4. Verify commit: `git log --oneline -1` should show `0d961be`
   116|    98|5. Decide on synthetic data restoration (see Open Questions)
   117|    99|6. Continue any remaining work on the branch
   118|   100|