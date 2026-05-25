# Cronalytics v1.1.0

 <a href="https://github.com/8bit64k/cronalytics/releases">
      <img src="https://img.shields.io/github/v/release/8bit64k/cronalytics?label=Release" alt="Latest Release">
    </a>
    <a href="https://github.com/8bit64k/cronalytics/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/8bit64k/cronalytics" alt="License">
    </a>
    <a href="https://github.com/8bit64k/cronalytics/commits/main">
      <img src="https://img.shields.io/github/last-commit/8bit64k/cronalytics" alt="Last Commit">
    </a>

---

/ˈkrɒn.əˌlɪt.ɪks/ (noun)

1. Cron analytics and observability.
2. The dashboard for agentic automations in Hermes.

Observe. Measure. Optimize.


Cronalytics is a Hermes Agent plugin that attributes session-level usage and estimated cost to every cron-originated run, so you can see what your scheduled jobs are costing you. It hooks into `on_session_end`, stores derived analytics in a local SQLite fact database, and surfaces them through **three interfaces**:

1. **Dashboard** — A dedicated `/cronalytics` tab inside `hermes dashboard` for visual exploration
2. **CLI** — A terminal tool for programmatic access, `--json` output, and agent consumption. Requires the plugin's `facts.db` to function — not a standalone product.
3. **Agent Skill** — A built-in diagnostic skill that teaches Hermes agents how to analyze your cron jobs with confidence-graded anomaly detection

> Turn hidden automation into visible spend.
> Built for **[Hermes Agent](https://github.com/nousresearch/hermes-agent)**, the autonomous agent framework by **[Nous Research](https://nousresearch.com)**.

---

## Three Ways to Use Cronalytics

>The dashboard is insightful, but the CLI + Skill are the real superpower.

### 1. Dashboard (for people)
Visual exploration with cards, tables, charts, and modals. Best for human pattern recognition.

### 2. CLI (for agents and tooling)

```
usage: cronalytics [-h] [--db DB] [--days DAYS] [--outcome {all,success,failure}]
                   [--mode {all,agent,no_agent}] [--json]
                   {summary,jobs,models,trends,health,runs,all,sync} ...

Cronalytics CLI — dump cron run insights to the terminal

positional arguments:
  {summary,jobs,models,trends,health,runs,all,sync}
    summary             Aggregate headline summary
    jobs                Per-job breakdown with pace
    models              Per-model estimated cost breakdown
    trends              Daily run-count / estimated cost sparkline
    health              Fact DB health check
    runs                Individual runs for a job
    all                 Run health + summary + jobs + models + trends
    sync                Backfill cron sessions from state.db into fact DB

options:
  -h, --help            show this help message and exit
  --db DB               Path to fact DB (default: auto-detected from plugin directory)
  --days DAYS           Number of days to look back (default: 30, 0 = all time)
  --outcome {all,success,failure}
                        Filter by outcome (default: all)
  --mode {all,agent,no_agent}
                        Filter by job mode (default: all)
  --json                Output raw JSON instead of formatted tables
  ```

### 3. Agent Skill (for reasoning and superpowers)
An agent skill that guides agents through structured cron health checks and diagnostics. Ask your agent:

> "Check my cron jobs for the last two weeks — flag anything that looks off."

The agent loads the `cronalytics` skill, follows a structured 7-step diagnostic workflow (time window verification → baseline → job-level drill → per-run investigation → failure pattern → model economics → trend validation), cross-references `jobs.json`, and grades every finding by confidence (HIGH / MEDIUM / LOW) with supporting evidence and alternative explanations.

---

## Ready to jump in?

| I am... | Path |
| :--- | :--- |
| **A New User** | [Install Guide (Fresh Start)](docs/INSTALL.md) |
| **An Existing v1.0.x User** | [Upgrade Guide (v1.1 Migration)](docs/UPGRADE.md) |
| **Exploring Features** | [Usage & Workflows](docs/USAGE.md) or [Feature Catalog](dev/FEATURES.md) |

---
# A Closer Look into Cronalytics

## Mini-Tour
![Short Tour](docs/screenshots/cronalytics-tour.gif)

[YouTube](https://youtu.be/nbeViSt9hCk?si=EH2u7Ys2vDTVDqka): short video showing basic install and usage.

---

## What Cronalytics Does

- **Captures** every cron job run as it completes via the `on_session_end` hook
- **Persists** cost, token counts, model, duration, and success state to a local fact database
- **Backfills** historical data automatically on plugin load and on demand via reconciliation scanner
- **Surfaces** data through three interfaces:

### Dashboard — visual exploration:
- Summary cards (total runs, estimated cost, tokens, pace)
- Leader board (top runs, top cost, top tokens, top pace)
- Cost-by-model breakdown with proportional bars
- Per-job table with runs, cost, duration, projections, and sortable columns
- Expandable detail rows showing token breakdown, schedule, and success/failure split
- Job detail modal with full run history (sortable, 200-run limit)
- Educational modals explaining Pace, Nominal, Trend, and cost math
- Outcome filter (All / Success / Failure) with conditional card colors
- Mode filter (All / Agent / No agent) for script-only job visibility
- Day selector  `7D | 30D | 90D` presets + custom input (0–365 days, Enter/Go)
- Refresh — re-fetches summary and jobs
- Sync Now button to trigger backfill on demand
  
**Multi-Locale Support**
Cronalytics implements a self-hosted internationalization layer for independent Hermes plugins. All UI elements, educational explainers, and metrics are fully localized for:
- 🇺🇸 **English** (Source of Truth)
- 🇪🇸 **Spanish** (Professional/Technical)
- 🇨🇳 **Chinese Simplified** (zh-CN)
- 🇹🇼 **Chinese Traditional** (zh-TW)

### CLI — terminal access:
- `summary` — headline aggregates + leader board + cost-by-model table
- `jobs` — per-job table with ID, runs, cost, tokens, pace, avg duration
- `runs --job <id>` — individual run history (time, duration, cost, tokens, model)
- `models` — per-model aggregate table
- `trends` — daily bar chart (ASCII) of cost + runs
- `health` — fact DB metadata, job count, last sync
- `all` — chains health → summary → jobs → models → trends
- All commands support `--days N`, `--outcome`, and `--mode`; every data command except `all` supports `--json`
- Job name resolution from `~/.hermes/cron/jobs.json`

### Agent Skill — agent-guided diagnostics:
- Structured 7-step workflow: time window verification → baseline → job-level drill → per-run investigation → failure pattern → model economics → trend validation
- Confidence-graded anomaly detection (HIGH / MEDIUM / LOW)
- `jobs.json` cross-reference for temporal context and silent failure detection
- "Known Ways to Fool Yourself" guardrails prevent false positives
- Works in any terminal session or messaging channel

For full details about usage and common workflows see **[USAGE.md](docs/USAGE.md)** and to explore the complete feature catalog see **[FEATURES.md](dev/FEATURES.md)**.

---

## ⚠️ Important Notes

### **Cost data is estimated, not exact.** 

Cronalytics reports the estimated cost that Hermes computed and stored in `state.db`. Your actual invoice may differ due to rate changes, credits, or rounding. Use this for directional awareness, not accounting.

> See **[FAQ: Cost & Billing](docs/FAQ.md)** — $0.00 costs, estimated vs actual, and why Cronalytics differs from your provider invoice.

### Understanding Success

**Cronalytics tracks two different notions of "success"**:

| Signal | What It Means | Source |
|--------|--------------|--------|
| **Wrapper Success** (`success` toggle in dashboard) | The cron wrapper finished without error — the job ran, the agent responded, and the wrapper exited cleanly. | `end_reason` field |
| **Payload Success** | The agent's actual output was correct, useful, or achieved the intended goal. | **Not tracked** |

### How to interpret the dashboard

- **Success = high, Failure = low** → Your cron jobs are mechanically reliable.
- **Success = high, but output quality is poor** → The infrastructure is fine; the issue is in the prompt, model choice, or task definition.
- **Failure = high** → Investigate timeouts, API errors, or wrapper crashes.

> The Success/Failure toggle is a **reliability** signal, not a **correctness** signal.

See **[FAQ: Metrics & Interpretation](docs/FAQ.md)** for Success vs Failure, agent vs no-agent jobs, and what Pace really means.

### **Single-profile cron by default.** 

Cronalytics monitors the Hermes profile where it is installed. Most users — even those with multiple profiles configured — run cron jobs in the **default** profile. For them, Cronalytics works fully.

The edge case: if you explicitly create a cron job under a non-default profile (`hermes --profile <name> cron create ...`), that job runs in an isolated gateway with its own `state.db`. Cronalytics, installed in the default profile, cannot see it.

Multi-profile cron support is on our roadmap.

See **[FAQ: Where are my jobs?](docs/FAQ.md)** for a checklist of common reasons jobs don't appear.

---

## Documentation Index

### User Documentation (`docs/`)

- **[INSTALL.md](docs/INSTALL.md)** — Installation guide (dashboard plugin + pip CLI + skill setup)
- **[UPGRADE.md](docs/UPGRADE.md)** — Transition guide for v1.0.x users (Namespace restructure)
- **[UNINSTALL.md](docs/UNINSTALL.md)** — Clean removal instructions
- **[USAGE.md](docs/USAGE.md)** — Dashboard and CLI usage guide
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — Common issues and fixes
- **[RELEASE_NOTES.md](docs/RELEASE_NOTES.md)** — Per-release upgrade notes and highlights
- **[FAQ.md](docs/FAQ.md)** — Common questions and quick answers

### Developer Documentation (`dev/`)

- **[BRIEF.md](dev/BRIEF.md)** — Product opportunity brief & positioning
- **[DESIGN.md](dev/DESIGN.md)** — Architecture, data flow, and technical decisions
- **[FEATURES.md](dev/FEATURES.md)** — Complete feature catalog with formulas
- **[DEV_SETUP.md](dev/DEV_SETUP.md)** — Development environment setup

### Project Meta

- **[CHANGELOG.md](CHANGELOG.md)** — Full version history

---

## First-Time Setup

After install, the plugin needs data:

1. **Wait for a cron job to run** — the `on_session_end` hook captures it automatically.
2. **Or trigger a manual backfill** — click **Sync Now** in the dashboard.

If the dashboard shows "No cron jobs captured," click **Sync Now**.

See **[FAQ: Visibility & Data](docs/FAQ.md)** for more help — how data updates, how far back you can look, and the 250-run modal limit.

---

## Architecture at a Glance

Cronalytics hooks into Hermes's `on_session_end`, enqueues session IDs, queries `state.db`, and stores derived analytics in a plugin-owned `facts.db`. Three interfaces read from that database: Dashboard (HTTP API), CLI (direct SQLite queries), and Agent Skill (CLI-piped heuristics).

For the full architecture diagram, data flow, and technical decisions, see **[DESIGN.md](dev/DESIGN.md#3-architecture)**.

---

## API Endpoints

All endpoints are mounted at `/api/plugins/cronalytics/`. Core endpoints: `GET /health`, `GET /summary`, `GET /jobs`, `GET /jobs/{job_id}/runs`, `GET /models`, `GET /trends`, `POST /sync`.

For the full endpoint table with parameters and response shapes, see **[DESIGN.md §4.11 API Validation Layer](dev/DESIGN.md#411-api-validation-layer)**.

---

## Data Model

The fact database (`facts.db`) is append-only — rows are inserted once and never updated or deleted. Core fields include `session_id`, `job_id`, `estimated_cost_usd`, `actual_cost_usd`, `model`, token breakdowns, `duration_seconds`, `end_reason`, and `success`.

For the full schema with field descriptions, see **[DESIGN.md §4.3 Fact DB](dev/DESIGN.md#43-fact-db-plugin-owned-append-only-sqlite)**.

---

## File Layout

```
cronalytics/
├─── plugin.yaml              # Plugin manifest (hooks, version)
├─── __init__.py              # Register hook + bootstrap scanner
├─── cronalytics/             # Core package
│   ├── cli.py                # Terminal interface (entry point)
│   ├── config.py             # Paths + defaults
│   ├── facts.py              # SQLite fact DB: schema, insert, queries
│   ├── ingester.py           # Deferred ingestion worker + crash recovery
│   ├── scanner.py            # Reconciliation scanner + watermark I/O
│   ├── schedule.py           # Cron parsing + projection math
│   ├── logger.py             # Shared logger
│   └── checkpoint.py         # Session state persistence
├─── skills/
│   └─── devops/
│       └─── cronalytics/
│           └─── SKILL.md     # Built-in diagnostic skill for agents
├─── dashboard/
│   ├─── manifest.json        # Slot registration + routes
│   ├─── plugin_api.py        # REST API mounted at /api/plugins/cronalytics/
│   ├─── build.js             # esbuild bundler script
│   ├─── src/                 # Modular frontend source
│   └─── dist/
│       └─── index.js         # Bundled React frontend
└─── tests/                   # Unit tests (run with pytest)
```

---

## Configuration

### `plugin.yaml`

```yaml
name: cronalytics
version: 1.1.0
description: Cost and operational observability for Hermes cron jobs
provides_hooks:
  - on_session_end
```

### `config.py` (static defaults)

All current settings are hardcoded defaults. There is no user-editable config file yet (planned for a future release).

| Setting | Default | Meaning |
|---------|---------|---------|
| `RETRY_DELAYS` | `[3.0, 8.0, 15.0]` | Seconds to wait before each worker retry |
| `JITTER_MAX` | `2.0` | Max random seconds added to each retry delay |
| `MAX_RETRIES` | `3` | Total attempts to read a session from `state.db` |

Paths are resolved automatically:
- `STATE_DB`: `~/.hermes/state.db` (Hermes core session store)
- `FACT_DB`: `~/.hermes/plugins/cronalytics/facts.db` (plugin-owned SQLite)
- `WATERMARK_FILE`: `~/.hermes/plugins/cronalytics/watermark.json`
- `PENDING_FILE`: `~/.hermes/plugins/cronalytics/pending.jsonl`

---

## Known Limitations

1. **Wrapper-level success only.** The `success` boolean reflects whether the session wrapper completed, not whether the agent task succeeded.
2. **Abandoned sessions are invisible.** Sessions where the gateway crashed or the job got stuck are never ingested (they never reach `ended_at`).
3. **No user-editable config file yet.** All tuning values are hardcoded in `config.py`.
4. **Actual cost is often null.** Most runs only populate `estimated_cost_usd`; `actual_cost_usd` depends on provider billing data.
5. **Dashboard server caches plugins per-process.** Changes to `manifest.json` or `plugin_api.py` require a full dashboard restart.
6. **Mobile layout tested but not optimized.** The table may require horizontal scroll on narrow viewports.
7. **Job detail modal capped at 200 runs.** High-frequency jobs show full count in the table but the drill-down is limited.

See **[FAQ](docs/FAQ.md)** for more: the 250-run limit, agent vs no-agent, models breakdown, snapshotting your facts.db, and getting `cronalytics` on your PATH.

---

## Support

Found a bug? Open a [GitHub Issue](https://github.com/8bit64k/cronalytics/issues) with reproduction steps. Have a feature idea? Open a [Discussion](https://github.com/8bit64k/cronalytics/discussions) or fork it.

See **[SUPPORT.md](SUPPORT.md)** for the full help guide, FAQ, and response expectations.

**Caveat**: The cost estimates are approximate and as recorded by the Hermes Agent framework. The success/failure signal is wrapper-level only (see [Understanding Success](#understanding-success)). Verify anything mission-critical independently.

---

## Requirements
If you are running Hermes Agent you have everything you need:
- Hermes Agent with plugin hook support (`on_session_end`)
- Hermes dashboard server for UI components
- SQLite (bundled with Python)

---

## License

MIT — see [`LICENSE`](LICENSE) for full text.

---

## Changelog

See **[CHANGELOG.md](CHANGELOG.md)** for the full version history.

---

*Plugin path: `~/.hermes/plugins/cronalytics/`*  
*Fact DB: `~/.hermes/plugins/cronalytics/facts.db`*  
*API base: `/api/plugins/cronalytics/`*
