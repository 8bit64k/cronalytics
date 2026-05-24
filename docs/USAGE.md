# Usage Guide — Cronalytics

> How to read the dashboard, interpret the metrics, and use the controls.

---
⚠️ **Before you being make sure you have read and understand these [Important Notes](#important-notes)**.

> ## The Cronalytics Tab

Open the **Cronalytics** tab from the Hermes dashboard sidebar. The tab is organized top-to-bottom as:

1. **Hero Banner** — product name, pronunciation, tagline
2. **Sticky Toolbar** — filters and actions
3. **Summary Board** — 4 aggregate metric cards
4. **Leader Board** — 4 spotlight cards for top jobs
5. **Per-Model Breakdown** — cost-by-model bar chart
6. **Jobs Breakdown** — sortable table of all jobs

---

> ## Toolbar Controls

The sticky toolbar stays at the top of the viewport as you scroll.

### Outcome Toggle: `All | Success | Failure`

Filters every metric and table row to show only successful runs, only failed runs, or all.

- **All** (default) — shows everything.
- **Success** — Cost card shows only successful-run cost; Jobs table shows only jobs with successful runs; Leader Board spotlights top successful jobs.
- **Failure** — Cost card headline changes to **"Wasted"** and turns red; Jobs table shows only failed runs; Leader Board spotlights top failure sources.

Your selection is saved to `localStorage` and persists across dashboard sessions.

### Mode Toggle: `All | Agent | No agent`

Filters between LLM agent jobs and script-only (`no_agent`) jobs.

- **All** (default) — shows both agent and script jobs.
- **Agent** — shows only jobs that invoke an LLM (have cost, tokens, model).
- **No agent** — shows only script-only jobs (zero cost, zero tokens). These are invisible in most Hermes views; this toggle makes them visible.

**Note on Badges:** Script jobs are marked with shorthand badges. These are synonymous:
- **`[No agent]`** — The full badge shown in the Dashboard Jobs table.
- **`[N]`** — The compact suffix used in CLI tables and the Dashboard Job Detail Modal.

**Technical Difference:** An **Agent** job executes within a Hermes agent session, generating a `state.db` entry and incurring token costs. A **No agent** job (script-only) executes a raw shell command or script; it generates no session record in `state.db` and its presence is detected by Cronalytics via its output artifacts in `~/.hermes/cron/output/`.

Your selection is saved to `localStorage`.

### Day Selector

Presets: **7D | 30D | 90D**

- Click a preset to instantly filter all metrics to that window.
- Enter a custom number (0–365) in the input field and press **Enter** or click **Go**.
- `0` means "All time" — no date filter is applied.
- Values above 365 are clamped to 365.

All cards, tables, and charts update immediately when the day filter changes.

### Refresh

Re-fetches the `summary` and `jobs` endpoints. Use this if you suspect stale data after a cron job completes.

### Sync Now

Triggers a reconciliation scan against `state.db` and the cron output directory. This backfills any sessions newer than the last watermark.

- While syncing, the button shows a spinning icon and "Syncing" text.
- When complete, a toast appears at the bottom of the screen: `✓ Synced N runs · X.Xs`
- A freshness badge next to the button shows how long ago the last sync completed (e.g., "2m ago").

---

> ## Summary Board

Four cards showing aggregate metrics. Click any card to open an educational modal.

### Job Runs

- **Big number:** total executions in the selected window.
- **Delta:** ↑ or ↓ percentage comparing to the prior window of the same length.
- **Context:** "vs prior 30d" (or "period" if All time).

> **Note:** Trend arrows (↗ ↘ →) require the database to contain at least 1.75× the filter window (e.g., 52.5 days for a 30-day filter). Shorter history always shows "→" (flat) to avoid misleading spikes from partial prior windows.

**What to look for:** A sudden spike in runs may indicate a job running more frequently than intended, or a retry loop.

### Cost

- **Big number:** total estimated cost in amber (`$X.XX`).
- **Delta:** ↑/↓ percentage vs prior window.

> **Note:** Trend arrows (↗ ↘ →) require the database to contain at least 1.75× the filter window (e.g., 52.5 days for a 30-day filter). Shorter history always shows "→" (flat).

- **Sub-line:** `✓ N · ✗ N` — success vs failure run counts. If failures have cost, shows wasted cost in parentheses.

> **Note:** The "Actual" line is suppressed. Partial `actual_cost_usd` coverage from providers creates misleading comparisons. It will return when coverage is reliable.

In **Failure** mode, the headline turns red and reads "Wasted."

### Tokens

- **Big number:** total tokens in blue.
- **Micro bars:** three thin bars showing the proportion of Input / Output / Cached tokens.

**What to look for:** A job with high cached tokens is reusing prompt prefixes efficiently. High output tokens relative to input may indicate verbose responses.

### Pace

- **Big number:** pace multiplier (e.g., `1.23×`).
- **Color:** green (`< 1.0×`), neutral (`1.0–2.0×`), red (`≥ 2.0×`).
- **Micro bars:** Nominal (green) vs Trend (red) proportional bars.

**What to look for:** Pace ≥ 2.0× means your actual spend is double your scheduled budget. Consider reducing frequency or switching to a cheaper model.

Click the Pace card to open a modal explaining the math in detail.

---

> ## Leader Board

Four spotlight cards showing the single highest-value job in each dimension. Click any card to see job details.

### Top Runs
The job that executed most frequently in the window, with its share of total runs (e.g. "41% of total runs"). High run count + high cost = your most expensive automation.

### Top Cost
The job with the highest cumulative spend, with its share of total cost (e.g. "67% of total cost"). Check its Pace — if pace is high, this job is the best candidate for optimization.

### Top Tokens
The job consuming the most tokens, with its share of total tokens (e.g. "58% of total tokens"). High token jobs may benefit from prompt compression or model downsizing.

### Top Pace
The job most at risk of exceeding its budget. This is your early-warning signal — even if absolute cost is low, a high pace means the job is running hotter than scheduled.

---

> ## Understanding the Cost Column

The cost shown for each run is the **estimated cost** that Hermes calculated and recorded in `state.db` during the session.

It is useful for:
- Spotting runs that used unexpectedly many tokens
- Comparing relative cost across jobs
- Budget awareness

It is **not** your exact invoice. Provider billing systems apply rounding, credits, and rate changes that neither Hermes nor Cronalytics see. For precise charges, check your provider dashboard.

---

> ## Per-Model Breakdown

A proportional bar chart of the top 5 models by estimated cost.

- **Left:** model name (truncated with ellipsis if too long).
- **Center:** proportional bar in amber, scaled to the highest-cost model.
- **Right:** cost + run count.

**What to look for:** If one model dominates spend, ask whether a cheaper model could handle the same task. If a model has high cost but low runs, it may be an expensive model used for large-context tasks.

---

> ## Jobs Breakdown Table

The main data surface. Eight columns, all sortable.

### Sorting

Click any column header to sort ascending. Click again to sort descending. An arrow (↑/↓) indicates the active sort.

| Column | What It Shows |
|--------|--------------|
| **Job** | Human-readable name (or job ID). `[No agent]` badge for script jobs. |
| **Runs** | Execution count in the window. |
| **Avg Duration** | Average duration per run. |
| **Total Cost** | Sum of estimated cost. |
| **Avg Cost** | Average cost per run. |
| **Nominal/mo** | Expected monthly cost if run exactly on schedule. |
| **Trend/mo** | Projected monthly cost if current pace continues. |
| **Pace** | `Trend / Nominal`. Color-coded badge. |

### Row Expansion

Click any row to expand a detail panel showing:
- **Tokens:** total, in, out, cached
- **Success/failure:** `✓ N · ✗ N` with cost attribution
- **Schedule:** human-readable expression, last run time, model, next run relative time
- **See Runs button:** opens the Job Detail Modal

### Pace Badge Colors

| Pace | Color | Meaning |
|------|-------|---------|
| `< 1.0×` | Green `#4ade80` | Under budget |
| `1.0–2.0×` | Neutral | On track |
| `≥ 2.0×` | Red `#ef4444` | Over budget |

---

> ## Job Detail Modal

Click **See Runs** in an expanded row to open the full run history.

- **Width:** 95% of viewport
- **Headers:** sticky (remain visible while scrolling)
- **Sort:** click any column header to sort
- **Limit:** 200 runs by default (backend ceiling: 500)
- **Columns:** Run Time, Cost, Duration, Success, Model, Mode

The modal inherits the sort preference from the parent Jobs Breakdown table. If you sorted by Cost in the main table, the modal opens sorted by Cost.

Close the modal by:
- Clicking the × button
- Clicking the backdrop
- Pressing Escape

---

> ## Educational Modals

Click any Summary Board or Leader Board card to open an explanatory modal.

### Pace Modal
Explains Nominal vs Trend, shows proportional bars, defines the color guide, and includes the full formula.

### Runs Modal
Explains total runs, trend % calculation, and window context.

### Cost Modal
Explains estimated vs actual cost, trend %, and window context.

### Tokens Modal
Explains input/output/cached tokens, shows proportion bars, and includes percentage breakdown.

---

> ## Keyboard Navigation

All interactive elements are keyboard-accessible:

- **Tab** moves focus through: Outcome toggle → Mode toggle → Day presets → Custom input → Go → Refresh → Sync Now → Summary cards → Leader cards → Table headers.
- **Enter** or **Space** activates the focused element.
- **Escape** closes any open modal.

---

> ## Resetting the UI

The dashboard saves your filter preferences to `localStorage`. If the UI behaves unexpectedly or you wish to clear your settings, you can clear these keys in your browser's Developer Tools (Console):

- `cron_outcome_filter` — Stores `all`, `success`, or `failure`.
- `cron_mode_filter` — Stores `all`, `agent`, or `no_agent`.
- `cron_day_filter` — Stores the selected day window (e.g., `30`).

---

> ## Common Workflows

### "Why did my cost spike this week?"
1. Set Day Selector to **7D**.
2. Check the **Cost** card delta — is it ↑ significantly?
3. Sort Jobs table by **Total Cost** — which job jumped?
4. Expand that job's row — check success/failure split.
5. Click **See Runs** — look for abnormally expensive individual runs.

### "Which jobs are running over budget?"
1. Sort Jobs table by **Pace** descending.
2. Look for red badges (≥ 2.0×).
3. Check **Nominal/mo** vs **Trend/mo** — the gap shows dollar impact.
4. Consider reducing schedule frequency or switching models.

### "Are my script jobs running?"
1. Set Mode toggle to **No agent**.
2. Check if any jobs appear. If not, your scripts may not be executing.
3. Set Mode back to **All** to compare against agent jobs.

### "Did my cron jobs fail last night?"
1. Set Outcome toggle to **Failure**.
2. Check the **Cost** card — it now shows "Wasted" cost.
3. Sort Jobs table by **Total Cost** — failures with highest cost appear first.
4. Expand rows to see failure counts and last run times.

---

> ## CLI Usage

Cronalytics includes a terminal data tool with the same data as the dashboard, plus `--json` output for scripts and agents, but it must be registered separately via `pip` to get the `cronalytics` command on your `$PATH`. See [INSTALL.md](INSTALL.md) for details.

Then use it from any directory:

```bash
cronalytics summary --days 14
```

Or, without `pip`, run the module directly from the plugin directory:

```bash
cd ~/.hermes/plugins/cronalytics && python -m cronalytics.cli summary --days 14
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `summary` | Headline aggregates + Leader Board + cost-by-model table | `cronalytics summary --days 14` |
| `jobs` | Per-job table with ID, runs, cost, tokens, pace, avg duration | `cronalytics jobs --days 7 --json` |
| `runs --job <id>` | Individual run history for a specific job | `cronalytics runs --job _demo_f1561526d8 --days 30` |
| `models` | Per-model aggregate table | `cronalytics models --days 14` |
| `trends` | Daily bar chart (ASCII) of cost + runs | `cronalytics trends --days 90` |
| `health` | Fact DB metadata: total runs, unique jobs, last sync | `cronalytics health --json` |
| `all` | Chains health → summary → jobs → models → trends | `cronalytics all --days 7` |

### Shared Flags

Every data command accepts:

- `--days N` — Look-back window (default: 30, `0` = all time)
- `--outcome all|success|failure` — Filter by run outcome
- `--mode all|agent|no_agent` — Filter by job mode
- `--json` — Emit JSON instead of rendered tables (pipe to `jq`, Python, etc.)

### Common CLI Workflows

**"Find jobs with pace above 1.2×"**
```bash
cronalytics jobs --days 7 --json | jq '.data[] | select(.pace > 1.2) | {id: .job_id, name: .job_name, pace}'
```

**"Get total cost for the last week"**
```bash
cronalytics summary --days 7 --json | jq '.data.tot_estimated_cost'
```

**"Export job list as CSV"**
```bash
cronalytics jobs --days 30 --json | jq -r '.data[] | [.job_id, .runs, .tot_estimated_cost, .total_tokens] | @csv'
```

**"Full report in one command"**
```bash
cronalytics all
```
**"Full report (bare command or 'all' subcommand)"**
```bash
cronalytics --days 14
```

**"Per-job economics with pace and projections"**
```bash
cronalytics jobs --days 7 --json | jq '.data[] | select(.pace > 1.2)'
```

**"Drill into a specific job"**
```bash
cronalytics runs --job f1561526d8 --days 30 --json
```

### Formatting Conventions

- **Cost:** `$X.XX` (e.g., `$14.37`)
- **Tokens:** Compact K/M suffixes (e.g., `12.2M`, `538K`)
- **Duration:** Seconds with `s` suffix (e.g., `7032s`)
- **Tables:** Monospace-aligned ASCII boxes matching `hermes insights` style
- **Date ranges:** Shown under every time-bounded banner (e.g., `May 03 — May 16, 2026`)

---

> ## Agent Skill

Cronalytics ships with a built-in diagnostic skill that teaches Hermes agents how to analyze your cron jobs.

### How to use it

Ask your agent in any channel (terminal, Telegram, etc.):

> "Check my cron jobs for the last two weeks — flag anything that looks off."

The agent automatically loads the `cronalytics` skill and follows a structured diagnostic workflow:

1. **Time window verification** — checks dataset span via `health --json` and defaults to full history for large datasets
2. **Baseline (`all`)** — verifies sync freshness, scans headline metrics and summary for red flags
3. **Job-level drill (`jobs --json`)** — ranks jobs by cost/tokens, checks pace and drift
4. **Per-run investigation (`runs --job`)** — individual run history for top burners, looking for context creep or cost spikes
5. **Failure pattern analysis** — computes true failure rates and drills into failure-only runs
6. **Model economics (`models --json`)** — cost-per-run comparison across models, token audit before model-switch suggestions
7. **Trend validation (`trends --json`)** — daily time series to distinguish one-off spikes from systemic growth

### What the skill provides

- **Confidence grading** — Every anomaly rated HIGH / MEDIUM / LOW with supporting evidence
- **Alternative explanations** — The agent must consider why a finding might be normal
- **Guardrails** — "Known Ways to Fool Yourself" prevents common false positives:
  - Pace < 1.0 on new jobs (age-gating via `jobs.json` `created_at`)
  - Script jobs (`[N]` in name) running differently than agent jobs
  - Single spikes without temporal cross-check
  - Outlier costs in job groups
  - Deliberately growing jobs
- **`jobs.json` cross-reference** — Human-readable names, schedules, creation dates, delivery errors, and `last_status` for silent failure detection

### Example output

The agent produces structured findings like:

```
Anomalies (confidence-graded):
1. [HIGH] Watchdog script jobs failing — 4 jobs with "Script not found" since May 10
   Evidence: jobs.json last_status for all 4 instances
   Remediation: Check ~/.hermes/scripts/ for missing files

2. [HIGH] phosphor-daily context creep — input_tokens 38K → 816K over 3 weeks
   Evidence: per-run trajectory showing 28× variance
   Remediation: Cap input size or split large sources

3. [LOW] Gateway Check pace 0.48 — expected; job created May 1, window is 30 days
   Evidence: jobs.json created_at confirms age < window
   Alternative: Not a drift signal; focus on cost/tokens instead
```

> **"Dashboard for people, CLI for agents, skill for reasoning."**

### Tailoring Assessments to Your Environment

The same assessment prompt produces different depth depending on your fleet size and how you frame the request. Six distinct prompt angles each surface different signals:

| Angle | Surfaces Best | Good For |
|-------|---------------|----------|
| Cost forensics | Ranked burners, model economics, annualized projections | "My bill is high" |
| Failure hunting | Silent failures, broken `no_agent` jobs, error patterns | "Something is broken" |
| Growth / acceleration | Context creep, cost acceleration, session archaeology | "Is anything getting worse?" |
| Temporal patterns | Schedule clustering, UTC drift, off-peak gaps | "When are my jobs actually running?" |
| Value / frustration | Blunt bottom-line, "what to fix first" priority list | "Am I wasting money?" |
| Weekly status check | Concise top-5 digest, borderline cases | "Quick check — what's up?" |

**Composite prompt** (catches all angles in one shot):

> "I think my cron jobs are wasting money and some might be broken without me knowing. Show me which jobs are burning the most money, which are failing silently, and whether anything is accelerating out of control. Include day-of-week and hour-of-day patterns, rank by cost, and give me a blunt bottom line of what's broken and what to fix first."

**Time window matters.** The CLI defaults to 30 days, but long-term creep and cost acceleration are invisible inside a month. If you do not specify a window, the skill defaults to the **full dataset span** (`--days 0`). Specify only when you want a narrow slice (e.g., "this week" → `--days 7`).

### Model Choice for Assessments

You do **not** need a frontier model to run a cronalytics assessment. Pattern detection on structured data is what cheap models excel at.

| Model | Est. Cost per Assessment | Best For |
|-------|-------------------------|----------|
| gemini-3-flash | ~$0.01–0.05 | Weekly recurring assessments |
| gpt-5.4-mini | ~$0.02–0.08 | Weekly with deeper reasoning |
| kimi-k2.6 | ~$0.10–0.50 | Monthly deep-dives, full composite prompt |
| claude-sonnet / gpt-5.5 | $2.00–5.00+ | **Overkill — avoid for routine assessments** |

At weekly cadence:
- gemini-3-flash: ~$0.04–0.20/month to monitor a fleet
- gpt-5.5: ~$8–20/month — a 100× waste for the same signal

**Rule:** Use the cheapest model that reliably produces the structured output you need. If the assessment misses a signal, upgrade the model, not the prompt.

> ## Localization (i18n)

Cronalytics automatically detects your system language. If you are using Hermes in **Spanish**, **Simplified Chinese**, or **Traditional Chinese**, the dashboard will update its labels and documentation accordingly.

> **Note to Community:** These locales are AI-validated community contributions. If you spot a discrepancy or regional phrasing error, please open a Pull Request. We follow a strict consensus protocol for all translation changes.

---

> ## Advanced: Multiple Profiles

Hermes supports multiple profiles via `hermes --profile <name>`. Each profile has its own `state.db`, cron jobs, and plugin directory.

Most users run cron exclusively in the **default** profile, even if they have other profiles configured. For these users, Cronalytics works without limitation.

If you create jobs under `hermes --profile work cron create ...`, those jobs run in an isolated gateway. Cronalytics must also be installed in `~/.hermes/profiles/work/plugins/` to see them. We are exploring cross-profile aggregation for a future release.

---

 ## Important Notes ⚠️
>
> ### Cost data is estimated, not exact. 
>
> Cronalytics reports the estimated cost that Hermes computed and stored in `state.db`. Your actual invoice may differ due to rate changes, credits, or rounding. Use this for directional awareness, not accounting.

> ### Understanding Success
> 
> **Cronalytics tracks two different notions of "success"**:
> 
> | Signal | What It Means | Source |
|--------|--------------|--------|
| **Wrapper Success** (`success` toggle in dashboard) | The cron wrapper finished without error — the job ran, the agent responded, and the wrapper exited cleanly. | `end_reason` field |
| **Payload Success** | The agent's actual output was correct, useful, or achieved the intended  goal. | **Not tracked** |
> 
> ### How to interpret the dashboard
> 
> - **Success = high, Failure = low** → Your cron jobs are mechanically reliable.
> - **Success = high, but output quality is poor** → The infrastructure is fine; the issue is in the > prompt, model choice, or task definition.
> - **Failure = high** → Investigate timeouts, API errors, or wrapper crashes.
> 
> The Success/Failure toggle is a **reliability** signal, not a **correctness** signal.

> ### Single-profile cron by default. 
> 
> Cronalytics monitors the Hermes profile where it is installed. Most users — even those with multiple profiles configured — run cron jobs in the **default** profile. For them, Cronalytics works fully.
> 
> The edge case: if you explicitly create a cron job under a non-default profile (`hermes --profile <name> cron create ...`), that job runs in an isolated gateway with its own `state.db`. Cronalytics, installed in the default profile, cannot see it. To monitor those jobs, install Cronalytics in that profile's `plugins/` directory as well.
> 
> Multi-profile cron support is on our roadmap.
>
---

*Version: 1.1.0*  
*Last updated: 2026-05-26

