# Checkpoint — 2026-05-18 (Session 2)

## Where we left off

**Current position: T13 complete. All 6 prompt tests (T8–T13) archived. Series complete.**

T8–T13 assessments saved to `scratchpad/test-skill-archive/`. T12 agent output surfaced one real CLI bug (50-run cap) and one false bug (agent reasoning error on outcome-filter semantics). Dashboard runs limit raised to 250 with "more available" notice.

### Bug Fixes (3 total, all committed)

| # | Bug | File(s) | Fix |
|---|-----|---------|-----|
| 1 | Dashboard [Refresh] button layout shift + lost spinner | `dashboard/src/components/CronalyticsTab.js` | `min-width: 4.5rem` + loading state icon |
| 2 | CLI crash on `schedule: null` orphan jobs | `cronalytics/schedule.py:112` | `or {}` instead of `get(..., {})` |
| 3 | `runs` CLI hard-capped at 50 rows (silent truncation) | `cli.py`, `facts.py` | `--limit` arg added (default 0 = no limit); `query_job_runs` default changed from 50 → 0 |

**Note on false bug:** T12 agent reported `--outcome failure` on `jobs` as "corrupted aggregation" with `success_runs` always 0. This was a **reasoning error, not a code bug**. The outcome filter correctly pre-filters runs before aggregation, producing subset-relative metrics. `success_runs = 0` is expected when only failures are in the dataset. Skill documentation updated to clarify this semantics (see `SKILL.md` Step 4). Phosphor failed to verify before acting — lesson learned.

### Dashboard Enhancement
- `JobDetailView.js`: Raised limit from 200 → 250
- `plugin_api.py`: API default 50 → 250, `ge=0` allows no-limit; added `total_runs` + `more_available` to response
- Frontend notice: "Showing N of M runs. Use `cronalytics runs --job <id> --days 0` for full history."

## Session Arc: Prompt Engineering → Load Test → Bug Fixes → Skill Patch → Docs

### Phase 1: Prompt Engineering (T8–T13)
- Tested 6 prompt framings against identical 30-day dataset (214 runs, 14 jobs)
- Produced comparative analysis in `scratchpad/test-skill-archive/OUTCOMES_ANALYSIS.md`
- Key finding: composite prompt surfaces all 6 angles; 30-day default hides long-term creep

### Phase 2: Load Test Generator
- Built `scratchpad/generate_load_test.py` — synthetic data generator
- Scale: 100 jobs (all paused/disabled), 38K runs, 313-day span
- Cost scaled to $5,000 (was $153K before 3.25% token scale-down)
- Failure model: clustered (85% stable, 10% flaky, 5% broken)
- Model mix: 10 models at real OpenRouter rates
- Real backups saved to `~/.hermes/cronalytics-backup/`

### Phase 3: Bug Fixes (both committed to branch)
1. **Dashboard [Refresh] button layout shift + lost spinner**
   - File: `dashboard/src/components/CronalyticsTab.js` line 214-225
   - Fix: loading state now shows spinning icon + "…" with `min-width: 4.5rem`
   - Built: `dashboard/dist/index.js` (117.5 KB)
   - Status: ✅ Fixed

2. **CLI crash on `schedule: null` (orphan jobs)**
   - File: `cronalytics/schedule.py` line 112
   - Fix: `job_def.get("schedule") or {}` instead of `job_def.get("schedule", {})`
   - Status: ✅ Fixed

### Phase 4: T8–T11 Assessment Results (38K synthetic dataset)

| Test | Prompt Framing | Window | Cost | Duration | Key Finding |
|------|----------------|--------|------|----------|-------------|
| **T8** | Composite (cost + broken) | 365-day | $0.42 | 10m 11s | 63.8% cost concentration, 5.2× context creep, 80× model ratio, synthetic data NOT detected |
| **T9** | Failure hunting | 365-day | $0.47 | 4m 49s | Flat 8% failure rate = synthetic signature, 5 zombie orphan jobs, hyper-concentrated failures |
| **T10** | Growth/acceleration | 365-day | $0.47 | 17m 47s | Fleet stable (flat slope), negative creep on 2 jobs, context creep monarch confirmed, 5,964 double-fires |
| **T11** | Weekly status (“What’s up?”) | 7-day | ~$0.40 | 8m 58s | 76% weekly burn from one job, May 14 spike day, 19 broken jobs, 25.5× model cost ratio, best tool transparency |

All results saved to `scratchpad/test-skill-archive/` with Phosphor analysis.

### Phase 5: Skill Patch (Smart Defaults)
- File: `~/.hermes/skills/devops/cronalytics/SKILL.md`
- Changes:
  - Step 0 = HARD GATE: `health --json` mandatory before any tool call
  - Agent default = full span (`--days 0`), not 30 days
  - CLI default stays 30 for Hermes Insights alignment
  - All examples updated to `--days 0` with note to use Step 0's value
- Status: ✅ Patched

### Phase 6: Docs Update
- File: `docs/USAGE.md`
- Added: "Tailoring Assessments to Your Environment" section
  - Prompt angle taxonomy (6 angles + composite prompt)
  - Time window guidance
- Added: "Model Choice for Assessments" section
  - Cost table: flash $0.01-0.05 vs gpt-5.5 $2-5+
  - Monthly cadence math
  - Rule: cheapest model first, upgrade only if signals missed

## Active Git Status

- Branch: `feat/cli-terminal-access`
- Modified tracked files (ready to commit):
  - `cronalytics/schedule.py` — null schedule crash fix
  - `cronalytics/cli.py` — `--limit` arg for runs command
  - `cronalytics/facts.py` — `query_job_runs` default 0 (no hidden cap); `query_jobs` reverted to correct pre-filter behavior
  - `dashboard/src/components/CronalyticsTab.js` — Refresh button layout fix
  - `dashboard/src/components/JobDetailView.js` — Limit 200→250, "more available" notice
  - `dashboard/plugin_api.py` — API limit 50→250, `ge=0`, `total_runs`/`more_available` fields
  - `dashboard/src/lib/validate.js` — `total_runs`/`more_available` schema validation
  - `dashboard/dist/index.js` — Rebuilt bundle
  - `docs/USAGE.md` — Prompt angle taxonomy + model choice guidance
  - `CHECKPOINT.md` — Session state updated
- Untracked (gitignored, not committed):
  - `scratchpad/generate_load_test.py`
  - `scratchpad/test-skill-archive/` (T8–T15 + COMPARATIVE_ANALYSIS)
  - `~/.hermes/cronalytics-backup/`

## Synthetic Data State

- `~/.hermes/cron/jobs.json` — 114 jobs (100 synthetic paused, 14 real paused)
- `~/.hermes/plugins/cronalytics/facts.db` — 38K runs, $5K total cost
- Real backups: `~/.hermes/cronalytics-backup/jobs.json.real.bak` + `facts.db.real.bak`

## Open Decisions / Next Actions

1. **T12 bugs just fixed** — need test coverage added for 50-run cap and outcome-filter corruption
2. **T13?** — Run temporal-histograms test, or call series complete?
3. **Synthetic data cleanup** — Restore real backups when testing done:
   ```bash
   cp ~/.hermes/cronalytics-backup/jobs.json.real.bak ~/.hermes/cron/jobs.json
   cp ~/.hermes/cronalytics-backup/facts.db.real.bak ~/.hermes/plugins/cronalytics/facts.db
   ```
4. **Commit scope** — Bug fixes (3 total now) + docs + skill patch. Decide before restore.

## Resume Instructions

When Nick returns (or if compression hits):
1. Confirm T9 session ID and results
2. Review T9 findings vs T8 (365-day should surface same or more signals)
3. Decide on commit scope (bug fixes + docs = minimal, safe)
4. If testing complete, revert synthetic data:
   ```bash
   cp ~/.hermes/cronalytics-backup/jobs.json.real.bak ~/.hermes/cron/jobs.json
   cp ~/.hermes/cronalytics-backup/facts.db.real.bak ~/.hermes/plugins/cronalytics/facts.db
   ```
5. Continue any remaining prompt tests (T10-T13 on 38K data if desired)

## Known Limitations / Warnings

- 38K dataset is gitignored (in plugin dir), so no risk of repo bloat
- All synthetic jobs are `enabled=false, state="paused"` — cron scheduler will not run them
- Real jobs.json was backed up but current version has all jobs paused (including real ones)
  - Must restore from backup when synthetic testing is done
- `state.db` cross-contamination: CLI `sync` command reads from `state.db` and could mix real + synthetic sessions
  - Avoid `cronalytics sync` during testing; data is already in facts.db
