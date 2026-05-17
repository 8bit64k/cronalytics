---
name: cronalytics
description: "Use when the user wants to analyze, diagnose, or optimize their Hermes cron jobs. Covers terminal-based health checks, cost attribution, failure analysis, trend detection, and schedule drift using the cronalytics CLI. Also references the Cronalytics dashboard plugin for visual exploration."
version: 1.1.0
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

Cronalytics installs as a Hermes plugin. The CLI works three ways depending on preference:

**Primary — plugin path (default, already installed):**

When Cronalytics is installed as a dashboard plugin, the CLI entry point is already on disk:

```bash
python ~/.hermes/plugins/cronalytics/cli.py --help
```

Run from any directory. The CLI auto-detects its own fact DB (`~/.hermes/plugins/cronalytics/facts.db`).

**Secondary — shell alias:**

If you want a shorter command, add an alias in `~/.bashrc` or `~/.zshrc`:

```bash
alias cronalytics='python ~/.hermes/plugins/cronalytics/cli.py'
```

### Subcommands

| Command | What it returns | Key flags |
|---------|----------------|-----------|
| `all` | Health + summary + jobs + models + trends in one scroll | `--days`, `--outcome`, `--mode` |
| `summary` | Headline aggregates: total runs, cost, tokens, success/failure split | `--days`, `--outcome`, `--mode`, `--json` |
| `jobs` | Per-job table: runs, cost, pace, avg duration, mode | `--days`, `--outcome`, `--mode`, `--json` |
| `models` | Per-model cost and token attribution | `--days`, `--outcome`, `--mode`, `--json` |
| `trends` | Daily run-count / cost sparkline | `--days`, `--outcome`, `--mode`, `--json` |
| `runs` | Individual run rows for a specific job ID | `--job <id>` (required), `--days`, `--outcome`, `--mode`, `--json` |
| `health` | Fact DB row counts, last sync watermark, schema version | `--db`, `--json` |
| `sync` | Backfill cron sessions from `state.db` → `facts.db` | `--db`, `--json` |

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

### When Data Is Stale — Agent Self-Healing

If `health` shows `last_sync` older than 6 hours (or older than the `--days` window), do **not** end the assessment. The agent should:

1. **Note the staleness explicitly** in the assessment — include exact timestamp and age
2. **Run `cronalytics sync`** to backfill missing data:
   ```bash
   cronalytics sync --json
   ```
3. **Re-query the data** and continue the assessment with fresh numbers
4. **Flag the sync anomaly** — stale data means the ingestion pipeline is not keeping up. Possible causes:
   - Gateway was down during cron runs
   - Plugin failed to load (check gateway logs)
   - `state.db` busy/locked during session writes
   - No cron jobs have completed since the sync (legitimate but rare)

**Agent principle:** The user asked for analysis, not a health check. The agent should recover the data and continue, surfacing the pipeline issue as a secondary finding. Never tell the user "fix your sync and come back."

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
- **Pace < 0.5** — investigate if the job is older than the filter window; ignore if newer. The pace value itself is the correct metric — do not fabricate a second computation.
- **High `cost_per_run`** — candidate for model switching or prompt optimization
- **No `last_run` within the window** — stale or disabled job still in the scheduler
- **`[N]` badge** — `no_agent` script jobs; verify they should be burning tokens at all

**Cross-reference `jobs.json`** if pace looks suspicious:
- Human-readable `name` for cleaner reports
- `created_at` to confirm job age vs filter window
- `schedule.kind` and `schedule.expr` for schedule context (cron vs interval)
- Note: `jobs.json` is current-config state, not historical

### Step 3: Per-Run Investigation (`runs --job <id> --json`)

**This is the canonical drill-down step. Prefer the CLI surface over direct SQLite.**

Use `cronalytics runs --job <id>` for all standard per-run analysis (token trajectories, cost spikes, model switches). Fall back to direct SQLite only when the CLI cannot express the query you need (e.g., cross-table joins, custom time-window aggregations). If you use SQLite, cite the query and explain why the CLI surface was insufficient — this feedback helps improve the CLI.

After Step 2 flags a suspect job, fetch its individual runs to inspect per-run token trajectories, cost spikes, and model switches:

```bash
cronalytics runs --job <job_id> --days 30 --json
```

Look for:
- **Context creep** — input token growth over successive runs (e.g., 38K → 538K). This is the #1 signal of an unbounded prompt or growing history.
- **Cost spikes** — isolated runs that cost 2–5× the job average. Check if they correlate with model switches or large attached documents.
- **Duration hangs** — runs with abnormally high `duration_seconds` relative to the job baseline.
- **Model drift** — a job that started on a cheap model and migrated to an expensive one.

Run this for every job in the top-3 burners. The JSON envelope contains `estimated_cost_usd`, `input_tokens`, `output_tokens`, `model`, and `duration_seconds` per row. Sort by `input_tokens` descending to surface the worst creep.

### Step 4: Failure Pattern (`jobs --outcome failure --json`)

```bash
cronalytics jobs --days 30 --outcome failure --json
```

Jobs with high failure counts but low success counts are the top remediation priority. Cross-check with `runs --job <id> --outcome failure --json` for the suspect job.

### Step 5: Model Economics (`models --json`)

```bash
cronalytics models --days 30 --json
```

High-cost models dominating the top of the list are candidates for down-tiering. Compare `avg_cost_per_run` across models — a factor of 10x between models for similar job types is a clear switch opportunity.

### Step 6: Trend Validation (`trends --json`)

```bash
cronalytics trends --days 30 --json
```

Last 7 days of daily cost. Spikes that correlate with specific calendar dates are likely one-off events. Steady upward slopes indicate systemic growth that needs a schedule or model intervention.

## Assessment Template

When the user asks for an assessment, structure the response as:

1. **Snapshot** — headline numbers (runs, cost, success rate, sync freshness)
2. **Anomalies** — jobs or dates that deviate from baseline. For each anomaly, report:
   - **Signal:** What you found (e.g., "Gateway Check input tokens: 6K → 161K")
   - **Confidence:** HIGH / MEDIUM / LOW
   - **Primary explanation:** Your best reading of the signal
   - **Alternative explanation:** Why this might be normal or expected (especially if confidence is LOW)
   - **Supporting evidence:** Tool outputs or cross-references that back your call

   Confidence grading guide:
   - **HIGH:** Reproducible across multiple data sources, large magnitude, consistent over time. E.g., "Context creep 6K → 161K confirmed in `runs --json` trajectories across 14 days."
   - **MEDIUM:** Supported by one strong signal, but could have benign explanation. E.g., "Pace 2.55× on weekly job — `jobs.json` confirms 4 runs in 11 days, but a schedule change may explain this."
   - **LOW:** Single metric anomaly, small window, or known expected behavior. E.g., "Pace 0.48 on 14-day-old job in 30-day window — expected for new jobs, not drift."

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
| **Summary** | `cronalytics summary --days N --json` | Headline aggregates: total runs, cost, tokens, success/failure split, **Leader Board** (top runs, cost, tokens, pace by job). Good for snapshot and trend direction. |
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

### Known Ways to Fool Yourself

The most dangerous failures are not tool errors — they are **interpretation errors** where a healthy metric is read as broken.

| False Alarm | Why it happens | Correct reading |
|-------------|---------------|-----------------|
| **Pace < 1.0 on a new job** | Job created after `--days` window start | Expected. The job hasn't lived long enough to accumulate its full scheduled run count. Check `jobs.json` `created_at`. If age < window, pace is not a drift signal; focus on cost/tokens instead. |
| **Pace > 1.0 on a [N] script job** | Script jobs run inline, not full agent loops | `[N]` jobs may show pace > 1 if they fire more frequently than declared, but they burn tokens differently than agent jobs. Verify against agent jobs only — compare script jobs to script jobs. |
| **Single spike in trends** | One-off event on a known date (deploy, holiday, maintenance) | Check if the spike correlates with a calendar event. Isolated spikes are not systemic growth. Look for sustained trends over 3+ data points. |
| **High cost on a low-run job** | One expensive run skews average | Check `runs --json` for the job. Is the cost consistent or an outlier? A single $5 run among 20 × $0.05 runs tells a different story than 21 × $0.25 runs. |
| **Context creep on a deliberately growing job** | Job is designed to accumulate history | Some jobs (e.g., daily summaries, digest builders) legitimately grow over time. Compare the growth rate: linear growth may be expected, exponential growth is the danger signal. |

**Meta-rule:** Before flagging any anomaly, ask "What would make this normal?" If you can construct a benign explanation with the data you have, downgrade confidence and look for confirming or disconfirming evidence in other signals.

### Key Concepts to Surface

- **Pace** — ratio of actual cost to scheduled cost, scaled to 30 days using the selected filter window. The computation is consistent: one metric, one definition, one source of truth. **Caveat:** Jobs created within the `--days` window will show pace < 1.0 by design; verify age with `jobs.json` before flagging as drift. Pace > 1.2 means over-triggering or shortened schedule. Pace < 0.5 on a job older than the window means backlog, hangs, or schedule mismatch.
- **Context creep** — input token growth over time for the same job. Detect via `cronalytics runs --job <id> --days N --json`, then sort by `input_tokens` descending. Apr: 38K → May: 538K is a 14× creep. Root cause: unbounded prompt, history, or attached source document. **Prefer the CLI surface for this; only use direct SQLite when the query cannot be expressed through the `runs` subcommand (e.g., cross-job correlation, custom joins). If you use SQLite, explain why.**
- **no_agent** — script-only jobs (`[N]` badge). They burn tokens differently than agent jobs (no full agent loop). Do not compare 1:1.
- **Estimated cost** — from Hermes `state.db`, not actual provider billing. Never present as exact invoices.
- **Sync freshness** — `health` shows last sync timestamp. If older than the look-back window, all analysis is incomplete.

**Mode filtering drops mixed-mode jobs.** A job that has both agent and no_agent runs in the window will be partially filtered if `--mode agent` or `--mode no_agent` is used. Use `--mode all` for full attribution unless the user explicitly wants to isolate script jobs.

**JSON output is the canonical machine interface** when it is complete. When building reports, prefer `--json` over parsing formatted tables. Table layouts change; JSON envelopes are stable. Post-process with `jq`, Python `json`, or direct SQLite as needed.

## Verification Checklist

- [ ] `cronalytics health` shows a recent `last_sync` timestamp
- [ ] Look-back window (`--days`) covers the period the user cares about
- [ ] `--mode all` is the default unless user wants agent/no_agent isolation
- [ ] Cost figures are presented as *estimates*, not exact billing
- [ ] Failure analysis correlates with model or date, not just count
- [ ] Pace outliers are flagged as *hints* requiring `jobs.json` cross-check
- [ ] Remediations are prioritized: immediate fixes before structural changes
- [ ] Dashboard is mentioned only as a visual complement, not the primary interface
