---
name: cronalytics
description: "Analyze, diagnose, and optimize Hermes cron jobs via the cronalytics CLI. Terminal-based health checks, cost attribution, failure analysis, trend detection, and schedule drift. Also references the Cronalytics dashboard plugin for visual exploration."
version: 1.1.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [cron, observability, cli, diagnostics, cost-analysis, hermes-agent]
    related_skills: [systematic-debugging, upstream-change-impact]
---

# Cronalytics — Agent Diagnostic Toolkit

## Overview

Cronalytics is a cron observability plugin for Hermes Agent. It persists cron
job metadata, costs, outcomes, and model usage into a local SQLite fact DB
(`facts.db`), then surfaces it through both a web dashboard and a terminal CLI.

**This skill teaches the CLI interface** — the canonical machine-readable surface.
Every data subcommand except `all` supports `--json` for structured output. All
share the same filter grammar (`--days`, `--outcome`, `--mode`). The dashboard is a fallback for visual exploration. The CLI is the primary diagnostic interface because it
is scriptable, pipeable, and works inside any terminal session without a browser.

**Pitfall — Skill text is historical, not oracular.** The cronalytics codebase
changes. Before repeating any claim about CLI defaults, accepted values, or flag
behaviors, verify against the live source (`cronalytics/cli.py` for argument
parsing, `cronalytics/facts.py` for query semantics, `dashboard/plugin_api.py` for
API regex patterns). This skill was written at a point in time; code drift is
real. Never tell the user a behavior is "correct" because the skill says so —
check the code.

## When to Use

- User asks "how are my cron jobs doing?", "what's burning tokens?", or "why
  is my bill high?", or similar
- User suspects a cron job is failing silently or running too frequently
- User wants a periodic health report on scheduled tasks (cron jobs)
- User asks for anomalies, impact assessment, or remediations for their cron
  setup
- User wants to compare model usage or cost across cron jobs over time

**Do not use for:**
- Live log streaming (Cronalytics stores summaries, not session outputs)
- Real-time alerting (no push notification system)
- Editing cron schedules (use `hermes cron` commands, not cronalytics)

## CLI Reference

### Invocation

If the user installed via pip or created a shell alias use:

```bash
cronalytics --help
```

The `cronalytics` command is available after the plugin is installed. If it is
not on `$PATH`, run via the plugin path:

```bash
python ~/.hermes/plugins/cronalytics/cronalytics/cli.py --help
```

### Subcommands

| Command | What it returns | Key flags |
|---------|----------------|-----------|
| `all` | Health + summary + jobs + models + trends in one scroll | `--days`, `--outcome`, `--mode` |
| `summary` | Headline aggregates: total runs, cost, tokens, success/failure split | `--days`, `--outcome`, `--mode`, `--json` |
| `jobs` | Per-job table: runs, cost, pace, avg duration, mode | `--days`, `--outcome`, `--mode`, `--json` |
| `models` | Per-model cost and token attribution | `--days`, `--outcome`, `--mode`, `--json` |
| `trends` | Daily run-count / cost sparkline | `--days`, `--outcome`, `--mode`, `--json` |
| `runs` | Individual run rows for a specific job ID | `--job <id>` (required), `--days`, `--outcome`, `--mode`, `--limit`, `--json` |
| `health` | Fact DB row counts, last sync watermark, schema version | `--db`, `--json` |
| `sync` | Backfill cron sessions from `state.db` → `facts.db` | `--db`, `--json` |

### Universal Filters

All data subcommands accept these shared flags:

- `--days N` — look-back window (default: `30`, `0` = all time)
  - When user is vague about time window, detect dataset span first via `health --json`
  - If span < 60 days, default to `--days 0` for full history
- `--outcome all|success|failure` — outcome filter (default: `all`)
- `--mode all|agent|no_agent` — agent vs. script-only jobs (default: `all`)
  - `--mode agent` or `--mode no_agent` drops jobs with mixed modes in the window
  - Use `--mode all` unless the user explicitly wants script-only or agent-only
- `--json` — raw JSON envelope instead of formatted tables

### JSON Envelope

When `--json` is used, every response is wrapped:

```json
{
  "period": "Last 7 days",
  "start_date": "2026-05-09",
  "end_date": "2026-05-15",
  "outcome": "all",
  "mode": "all",
  "data": [ ... ]
}
```

Pipe into `jq '.data[]'` for downstream processing.

**Pitfall:** The `all` subcommand does **not** support `--json`. It emits a
human-readable scroll with headers, ASCII tables, and section breaks. If you
need structured output from the full diagnostic suite, call the individual
subcommands (`health --json`, `summary --json`, `jobs --json`, etc.) and
aggregate client-side. Never claim `--json` works with `all`.

**Pitfall:** Rendered table headers (`Name`, `Fail`, `Cost`, `[N]`) differ from
JSON keys. Always inspect `data[0].keys()` from a live `--json` call before
writing aggregation scripts. The canonical keys in `cronalytics jobs --json`
are: `job_id`, `job_name`, `job_mode`, `runs`, `success_runs`, `failure_runs`,
`tot_estimated_cost`, `avg_estimated_cost`, `total_tokens`, `total_input_tokens`,
`total_output_tokens`, `total_cache_*_tokens`, `total_duration`, `avg_duration`,
`last_run`, `first_run`, `last_model`, `schedule_display`, `pace`, `drift_ratio`.

## Diagnostic Workflow

### Step 0: Time Window Verification

**Mandatory first action.** Run `cronalytics health --json` to read dataset
span (`min_run_time` to `max_run_time`) before calling any data subcommand.

If span > 60 days and user was vague (e.g., "recent", "lately", "what's
happening"), default to `--days 0` (all time) for assessments. The CLI
defaults to 30 days, which will miss long-term creep and fleet-wide acceleration
on large datasets.

### Step 1: Baseline (`all`)

Below are examples: use --days with the number that matches the user's request.


Start with the full report to orient:

```bash
cronalytics all --days <days>
```

Read the **health** block first: confirm `last_sync` is recent. A stale sync
means the data is incomplete.

**When data is stale, do not end the assessment.** Note the staleness
explicitly, then run `cronalytics sync --json` to backfill and re-query with
fresh numbers. Flag the sync anomaly as a secondary finding. Never tell the
user to "fix your sync and come back."

Then read the **summary** block for headline red flags:
- `success_rate` < 80% → investigate failures
- `failure_estimated_cost` > 10% of `tot_estimated_cost` → wasted spend
- `total_tokens` growing week-over-week → model or frequency creep

### Step 2: Job-Level Drill (`jobs --json`)

Fetch the jobs surface and rank by estimated cost or token volume:

```bash
cronalytics jobs --days <days> --json
```

Look for:
- **Pace > 1.2** — running faster than declared schedule (drift, over-triggering)
- **Pace < 0.5** — investigate if job is older than filter window; ignore if newer
- **High `cost_per_run`** — candidate for model switching or prompt optimization
- **No `last_run` within window** — stale or disabled job still in scheduler
- **`[N]` badge** — `no_agent` script-only jobs

**Cross-reference `jobs.json`** if pace looks suspicious:
- Human-readable `name` for cleaner reports
- `created_at` to confirm age vs. filter window
- `schedule.kind` and `schedule.expr` for schedule context
- Note: `jobs.json` is current-config state, not historical

### Step 3: Per-Run Investigation (`runs --job <id> --json`)

**This is the canonical drill-down step. Prefer the CLI surface over direct
SQLite.**

After Step 2 flags a suspect job, fetch its individual runs:

```bash
cronalytics runs --job <job_id> --days <days> --json
```

`--limit` defaults to `0` (no limit), which returns all runs in the window.

Look for:
- **Context creep** — input token growth over successive runs (e.g., 38K → 538K)
- **Cost spikes** — isolated runs 2–5× the job average
- **Duration hangs** — abnormally high `duration_seconds`
- **Model drift** — started cheap, migrated expensive
- **Double-fires** — multiple runs clustered within minutes when schedule is daily or longer

Run this for every job in the top-3 burners. Sort by `input_tokens` descending
to surface the worst creep.

Fall back to direct SQLite only when the CLI cannot express the query you need
(e.g., cross-table joins, custom aggregations). If you use SQLite, cite the
query and explain why the CLI surface was insufficient.

### Step 4: Failure Pattern (`jobs --outcome failure --json` with unfiltered outcome)

```bash
cronalytics jobs --days <days> --json
```

Use **unfiltered** `jobs --json` to compute true failure rates:
```python
fail_rate = job['failure_runs'] / job['runs']
```

**Do not use `--outcome failure` on `jobs` to compute failure rates.** That
filter pre-filters the dataset to failures-only before aggregation, so
`success_runs` will always be 0 (there are no successful runs in the failure
subset). This is intended behavior, not a data bug.

For failure drill-down on a specific job:
```bash
cronalytics runs --job <job_id> --days <days> --outcome failure --json
```

### Step 5: Model Economics (`models --json`)

```bash
cronalytics models --days <days> --json
```

high-estimated-cost models dominating the top are candidates for down-tiering. Compare
`avg_cost_per_run` across models — a factor of 10× between models for similar
job types is a clear switch candidate. Don't make 'hard' recommendations
to the user to switch or down-tier. Just offer the estimated cost savings opportunity 
and suggest they evaluate their current job setup.

**Important:** Before recommending (soft recommendation to user to evaluate) a model switch, audit `input_tokens` per run.
A job burning $144/wk on sonnet-4.6 with 900K input tokens per run likely
suffers from context bloat, not model premium. Downgrading to a cheaper model
reduces per-token cost but the job stays expensive if the prompt keeps growing.
Verify `runs --json` `input_tokens` are justified by the task before switching.

### Step 6: Trend Validation (`trends --json`)

```bash
cronalytics trends --days <days> --json
```

Daily cost/run-count time series. Spikes that correlate with specific calendar
dates are likely one-off events. Steady upward slopes indicate systemic growth
that needs a schedule or model intervention.

## Assessment Template

When the user asks for an assessment, structure the response as:

1. **Snapshot** — headline numbers (runs, cost, success rate, sync freshness)
2. **Anomalies** — jobs or dates that deviate from baseline. For each anomaly,
   report:
   - **Signal:** What you found
   - **Confidence:** HIGH / MEDIUM / LOW
   - **Primary explanation:** Your best reading
   - **Alternative explanation:** Why this might be normal
   - **Supporting evidence:** Tool outputs or cross-references

   Confidence grading guide:
   - **HIGH:** Reproducible across multiple data sources, large magnitude,
     consistent over time.
   - **MEDIUM:** Supported by one strong signal, but could have benign
     explanation.
   - **LOW:** Single metric anomaly, small window, or known expected behavior.

3. **Impact** — quantified waste (failure_cost, over-schedule burn, model premium)
   and trend direction
4. **Remediations** — prioritized, actionable:
   - *Immediate:* fix failing jobs, cap runaway context, disable stale jobs
   - *Short-term:* switch expensive models (after token audit), tighten schedules
   - *Structural:* review `no_agent` jobs for necessity, set token budgets,
     prune deadwood

## Dashboard (Secondary)

The Cronalytics dashboard is a Hermes plugin route. It provides:
- Sortable jobs table with expandable run detail
- Summary Board: totals, projections, previous-period comparison
- Toolbar: day filter, outcome filter, mode filter
- Sync button + health watermark

Access via the Hermes dashboard (sidebar tab "Cronalytics"). Use it when the
user wants visual exploration or to share a screenshot. Do not describe it as a
replacement for the CLI — it is the visual complement.

## Known Ways to Fool Yourself

The most dangerous failures are not tool errors — they are **interpretation
errors** where a healthy metric is read as broken.

| False Alarm | Why it happens | Correct reading |
|-------------|---------------|-----------------|
| **Pace < 1.0 on a new job** | Job created after `--days` window start | Expected. Check `jobs.json` `created_at`. If age < window, pace is not a drift signal. |
| **Pace > 1.0 on a [N] script job** | Script jobs run inline | `[N]` jobs may show pace > 1, but they have no agent loop. Verify against other script jobs only. |
| **Single spike in trends** | One-off event (deploy, holiday) | Isolated spikes are not systemic. Look for sustained trends over 3+ data points. |
| **High cost on a low-run job** | One expensive run skews average | Check `runs --json` for the job. Is the cost consistent or an outlier? |
| **Context creep on a deliberately growing job** | Job accumulates history | Linear growth may be expected. Exponential growth is the danger signal. |
| **Recommending model switch without token audit** | Reflex to "downgrade expensive model" | Check `runs --json` `input_tokens` first. Unbounded context makes any model expensive. |

**Do not treat every anomaly as a false alarm.** Some signals are genuinely
broken. The purpose of this table is to prevent premature dismissal of real
problems by checking a benign explanation. It does not teach you to dismiss
real problems.

### no_agent Job Notes

`no_agent` jobs (`[N]` badge) execute as shell scripts, not agent sessions.
They have **no LLM loop** and therefore typically record:
- `total_tokens` = 0
- `avg_duration` = null (if the script was not tracked by the agent timing system)
- `last_model` = "unknown"
- `success` = 1 (if the shell command returned exit 0)

This is **expected behavior for script-only jobs**. Zero tokens on a `no_agent`
job is not a silent failure. It is the correct signal that no LLM was invoked.

To distinguish a healthy `no_agent` job from a misconfigured one, check
`jobs.json`:
- `no_agent` = true (confirms it is a script job)
- `script` = actual file path to a script that exists
- `last_status` / `last_error` — if the script was not found or failed, this
  reveals the real error (cronalytics records `success=1` because the Hermes
  scheduler session completed, even when the script itself failed)

A `no_agent` job with `success=1` but 0 tokens is normal if the script ran
successfully but does no LLM work. A `no_agent` job with `success=1` but a
non-empty `last_error` in `jobs.json` is a real misconfiguration.

### Silent Failures

The fact DB records `success=1` when a Hermes session completes without
crashing. This does not guarantee useful work was done.

| Pattern | Cronalytics signal | Root cause | Fix |
|---------|-------------------|------------|-----|
| **Script misconfiguration** | `no_agent`, `success=1`, 0 tokens, non-empty `last_error` in `jobs.json` | Script file missing or invalid, shell command treated as path | Check `jobs.json` `last_error` for exact message; fix `script` path |
| **Agent returns [SILENT]** | `agent` mode, `success=1`, very low tokens, `end_reason` == "cron_complete" | Prompt instructed silent mode | Usually expected; verify with user |
| **Empty script output** | `no_agent`, `success=1`, 0 tokens, `last_error` empty | Script ran but produced nothing | Review script logic |

## Key Concepts to Surface

- **Pace** — ratio of actual cost to scheduled cost, scaled to 30 days. Pace
  > 1.2 = over-triggering or shortened schedule. Pace < 0.5 on an older job
  means backlog, hangs, or schedule mismatch. Pace indicators on no_agent [N]
  jobs have less estimated cost impact and should be posititioned as such.
- **Context creep** — input token growth for the same job. Apr: 38K → May:
  538K is a 14× creep. Root cause: unbounded prompt, history, or attachments.
- **no_agent** — script-only jobs (`[N]` badge). No LLM loop = zero tokens
  by design. Do not compare 1:1 with agent jobs.
- **Estimated cost** — from Hermes `state.db`, not actual provider billing. Never
  present as exact invoices.
- **Sync freshness** — If `last_sync` is older than the look-back window, all
  analysis is stale. Fix it: `cronalytics sync --json`, then continue.
- **Mode filtering** — `--mode agent` or `--mode no_agent` drops jobs with
  mixed-mode runs. Use `--mode all` unless user explicitly wants isolation.
- **JSON output is canonical.** Table headers change; JSON keys are stable.
  Post-process with `jq`, Python `json`, or direct SQLite.
- **Self-healing data paths** — If data is stale, sync and continue. Never
  halt for manual remediation. See `references/time-window-blind-spot.md` for
  why this matters.

## Verification Checklist

- [ ] `cronalytics health` shows a recent `last_sync` timestamp
- [ ] Look-back window (`--days`) covers the period the user cares about
- [ ] `--mode all` is the default unless user wants agent/no_agent isolation
- [ ] Cost figures are presented as *estimates*, not exact billing
- [ ] Failure analysis correlates with model or date, not just count
- [ ] Pace outliers are flagged as *hints* requiring `jobs.json` cross-check
- [ ] Model-switch recommendations are preceded by token-volume audit
- [ ] no_agent jobs with 0 tokens are not flagged as silent failures
- [ ] Remediations are prioritized: immediate fixes before structural changes
- [ ] Dashboard is mentioned only as a visual complement

## Reference Materials

The `skills/devops/cronalytics/references/` directory contains session artifacts
and supporting documents. These files are **not guaranteed to be current** with
the live codebase. Treat them as hints, not canonical sources.

- `data-model.md` — JSON field map and SQLite schema. **Verify field names and
  types against a live `--json` call before relying on them.** The codebase
  may have drifted since this file was written.
- `direct-sqlite-workarounds.md` — SQL recipes for queries the CLI cannot
  express. Useful when the CLI surface is insufficient.
- `jq-diagnostic-patterns.md` — ready-to-paste filtering pipelines.
- `time-window-blind-spot.md` — why short windows hide long-term creep.
- `silent-failure-detection.md` — decision tree and one-liners for jobs that
  report success but produce no value (hollow runs, misconfigured scripts).

**Pitfall:** If a reference file contradicts `cli.py`, `facts.py`, or a live
`--json` response, the code wins. Reference files are historical snapshots;
live source is truth.
