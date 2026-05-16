---
name: cronalytics
description: "Use when the user wants to analyze, diagnose, or optimize their Hermes cron jobs. Covers terminal-based health checks, cost attribution, failure analysis, trend detection, and schedule drift using the cronalytics CLI. Also references the Cronalytics dashboard plugin for visual exploration."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [cron, observability, cli, diagnostics, cost-analysis, hermes-agent]
    related_skills: [systematic-debugging, upstream-change-impact, project-retrospectives]
---

# Cronalytics — Agent Diagnostic Toolkit

## Overview

Cronalytics is a cron observability plugin for Hermes Agent. It persists cron job metadata, costs, outcomes, and model usage into a local SQLite fact DB (`facts.db`), then surfaces it through both a web dashboard and a terminal CLI.

**This skill teaches the CLI interface** — the canonical machine-readable surface. The CLI is designed for agents: every subcommand supports `--json` for structured output and shares the same filter grammar (`--days`, `--outcome`, `--mode`).

The dashboard exists as a fallback for visual exploration, but the CLI is the primary diagnostic interface because it is scriptable, pipeable, and works inside any terminal session without a browser.

## When to Use

- User asks "how are my cron jobs doing?", "what's burning tokens?", or "why is my bill high?"
- User suspects a cron job is failing silently or running too frequently
- User wants a periodic health report on scheduled tasks
- User asks for anomalies, impact assessment, or remediations for their cron setup
- User wants to compare model costs across cron jobs over time

**Do not use for:**
- Live log streaming (Cronalytics does not store session outputs — only summaries)
- Real-time alerting (no push notification system; use the dashboard or external monitoring)
- Editing cron schedules (use `hermes cron` commands, not cronalytics)

## CLI Reference

### Installation

Cronalytics installs as a Hermes plugin. The CLI works two ways depending on how the package was installed:

**Primary install method — plugin path (dashboard install):**

This is the path most users take. Cronalytics is symlinked into `~/.hermes/plugins/cronalytics/` as a dashboard plugin. The CLI entry point is the plugin directory itself:

```bash
cd ~/.hermes/plugins/cronalytics
python cli.py --help
```

**Secondary install method — pip install (advanced):**

For standalone CLI access outside the Hermes gateway context, or for programmatic consumption by other agents/scripts:

```bash
pip install cronalytics          # from PyPI
# or
pip install -e .                 # editable install from source
cronalytics --help
```

Both paths share the same auto-detection logic for the fact DB. No `--db` flag is required if the database exists in the standard plugin location (`~/.hermes/plugins/cronalytics/facts.db`).

### Subcommands

| Command | What it returns | Key flags |
|---------|----------------|-----------|
| `all` | Health + summary + jobs + models + trends in one scroll | `--days`, `--outcome`, `--mode` |
| `summary` | Headline aggregates: total runs, cost, tokens, success/failure split | `--days`, `--outcome`, `--mode`, `--json` |
| `jobs` | Per-job table: runs, cost, pace, avg duration, mode | `--days`, `--outcome`, `--mode`, `--json` |
| `models` | Per-model cost and token attribution | `--days`, `--outcome`, `--mode`, `--json` |
| `trends` | Daily run-count / cost sparklines | `--days`, `--outcome`, `--mode`, `--json` |
| `runs` | Individual run rows for a specific job ID | `--job <id>` (required), `--days`, `--outcome`, `--mode`, `--json` |
| `health` | Fact DB row counts, last sync watermark, schema version | `--db`, `--json` |

### Universal Filters

All data subcommands accept:

- `--days N` — look-back window (default: 30, `0` = all time)
- `--outcome both|success|failure` — outcome filter (default: `both`)
- `--mode all|agent|no_agent` — agent vs. script-only jobs (default: `all`)
- `--json` — raw JSON envelope instead of formatted tables

### JSON Envelope Shape

When `--json` is used, every response is wrapped:

```json
{
  "period": "Last 7 days",
  "start_date": "2026-05-09",
  "end_date": "2026-05-15",
  "outcome": "both",
  "mode": "all",
  "data": [ ... ]
}
```

Pipe into `jq '.data[]'` for downstream processing.

## Diagnostic Workflow

### Step 1: Baseline (`all`)

Start with the full report to orient:

```bash
cronalytics all --days 30
```

Read the **health** block first: confirm `last_sync` is recent. A stale sync means the data is incomplete.

Then read the **summary** block for headline red flags:
- `success_rate` < 80% → investigate failures
- `failure_cost` > 10% of `total_cost` → wasted spend
- `total_tokens` growing week-over-week → model or frequency creep

### Step 2: Job-Level Drill (`jobs --json`)

Fetch the jobs surface and rank by cost or token volume to find burners:

```bash
cronalytics jobs --days 30 --json
```

Look for:
- **Pace > 1.2** — the job is running faster than its declared schedule (drift, over-triggering, or schedule change without reset)
- **Pace < 0.5** — the job is running much slower than scheduled (backlog, long execution time, or missed triggers)
- **High `cost_per_run`** — candidate for model switching or prompt optimization
- **No `last_run` within the window** — stale or disabled job still in the scheduler
- **`[N]` badge** — `no_agent` script jobs; verify they should be burning tokens at all

### Step 3: Failure Pattern (`jobs --outcome failure --json`)

```bash
cronalytics jobs --days 30 --outcome failure --json
```

Jobs with high failure counts but low success counts are the top remediation priority. Cross-check with per-run data for the suspect job.

### Step 4: Model Economics (`models --json`)

```bash
cronalytics models --days 30 --json
```

High-cost models dominating the top of the list are candidates for down-tiering. Compare `avg_cost_per_run` across models — a factor of 10x between models for similar job types is a clear switch opportunity.

### Step 5: Trend Validation (`trends --json`)

```bash
cronalytics trends --days 30 --json
```

Last 7 days of daily cost. Spikes that correlate with specific calendar dates are likely one-off events. Steady upward slopes indicate systemic growth that needs a schedule or model intervention.

## Assessment Template

When the user asks for an assessment, structure the response as:

1. **Snapshot** — headline numbers (runs, cost, success rate, sync freshness)
2. **Anomalies** — jobs or dates that deviate from baseline (pace outliers, failure clusters, cost spikes, context creep)
3. **Impact** — quantified waste (failure_cost, over-schedule burn, model premium) and trend direction
4. **Remediations** — prioritized, actionable:
   - *Immediate:* fix failing jobs, cap runaway context, disable stale jobs
   - *Short-term:* switch expensive models, tighten schedules, audit scan parameters
   - *Structural:* review `no_agent` jobs for necessity, set token budgets, prune deadwood

## Dashboard (Secondary)

The Cronalytics dashboard is a Hermes plugin route. It provides:
- Sortable jobs table with expandable run detail
- Leader Board: top runs, cost, tokens, pace by job
- Summary Board: totals, projections, previous-period comparison
- Toolbar: day filter, outcome filter, mode filter
- Sync button + health watermark

Access via the Hermes dashboard (the sidebar tab labeled "Cronalytics"). Use it when the user wants visual exploration, sparkline confirmation, or to share a screenshot. Do not describe it as a replacement for the CLI — it is the visual complement.

### Data Sources

The Cronalytics CLI exposes several data surfaces. Each answers a different diagnostic question:

| Source | Command | What it tells you |
|---|---|---|
| **Health** | `cronalytics health --json` | Sync freshness, row counts, schema version. **Always check first** — stale sync means stale analysis. |
| **Summary** | `cronalytics summary --days N --json` | Headline aggregates: total runs, cost, tokens, success/failure split. Good for snapshot and trend direction. |
| **Jobs** | `cronalytics jobs --days N --json` | Per-job economics: runs, cost, tokens, pace, avg duration, mode. **Primary anomaly hunting surface.** Sort by cost or token volume to find burners. |
| **Runs** | `cronalytics runs --job <id> --days N --json` | Individual run rows for a specific job. Use after identifying a suspect job to surface outlier runs (cost spikes, duration hangs, model switches). |
| **Models** | `cronalytics models --days N --json` | Per-model cost and token attribution. Good for model economics: which model is eating the budget, whether a cheaper tier could substitute. |
| **Trends** | `cronalytics trends --days N --json` | Daily cost/run-count time series. Good for growth trajectories and date-correlated spikes. |

**Agent guidance:** Fetch the JSON envelope, then analyze with whatever tool is most reliable in your environment (`jq`, Python `json` module, or direct SQLite if the CLI surface is insufficient). The JSON schema is stable; the CLI tables are for human eyes.

### Assessment Template

When the user asks for an assessment, structure the response as:

1. **Snapshot** — headline numbers (runs, cost, success rate, sync freshness)
2. **Anomalies** — jobs or dates that deviate from baseline (pace outliers, failure clusters, cost spikes, context creep)
3. **Impact** — quantified waste (failure_cost, over-schedule burn, model premium) and trend direction
4. **Remediations** — prioritized, actionable:
   - *Immediate:* fix failing jobs, cap runaway context, disable stale jobs
   - *Short-term:* switch expensive models, tighten schedules, audit scan parameters
   - *Structural:* review `no_agent` jobs for necessity, set token budgets, prune deadwood

### Key Concepts to Surface

- **Pace** — ratio of actual runs to declared schedule runs. Pace > 1.2 means over-triggering or shortened schedule. Pace < 0.5 means backlog, hangs, or stale `jobs.json` metadata.
- **Context creep** — input token growth over time for the same job. Apr: 38K → May: 538K is a 14× creep. Root cause: unbounded prompt, history, or attached source document.
- **no_agent** — script-only jobs (`[N]` badge). They burn tokens differently than agent jobs (no full agent loop). Do not compare 1:1.
- **Estimated cost** — from Hermes `state.db`, not actual provider billing. Never present as exact invoices.
- **Sync freshness** — `health` shows last sync timestamp. If older than the look-back window, all analysis is incomplete.

**Mode filtering drops mixed-mode jobs.** A job that has both agent and no_agent runs in the window will be partially filtered if `--mode agent` or `--mode no_agent` is used. Use `--mode all` for full attribution unless the user explicitly wants to isolate script jobs.

**JSON output is the canonical machine interface.** When building reports for the user, prefer `--json` over parsing formatted tables. Table layouts change; JSON envelopes are stable. Post-process with `jq`, Python `json`, or direct SQLite as needed.

## Verification Checklist

- [ ] `cronalytics health` shows a recent `last_sync` timestamp
- [ ] Look-back window (`--days`) covers the period the user cares about
- [ ] `--mode all` is the default unless user wants agent/no_agent isolation
- [ ] Cost figures are presented as *estimates*, not exact billing
- [ ] Failure analysis correlates with model or date, not just count
- [ ] Pace outliers are flagged as *hints* requiring `jobs.json` cross-check
- [ ] Remediations are prioritized: immediate fixes before structural changes
- [ ] Dashboard is mentioned only as a visual complement, not the primary interface
