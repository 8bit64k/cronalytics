# Frequently Asked Questions

> Quick answers to common questions. For error messages and fixes, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Cost & Billing

### Why is my cost showing $0.00?

Cronalytics reads the estimated cost that Hermes computed during each cron session. If Hermes doesn't have a cost estimate for a run (provider didn't return one, model doesn't report costs, or the session predates cost tracking), the field is `$0.00`. This is most common with `no_agent` script jobs and very old historical runs.

**Fix:** Click **Sync Now** to backfill recent runs. If zero-cost rows persist, check whether the provider/model you're using reports estimated costs (or actual) to Hermes.

### How is estimated cost different from what my provider charges?

Cronalytics shows the **estimated cost** that Hermes computed locally at session time — based on the provider's published per-token rates. Your actual invoice may differ because of:

- Rate changes since the session ran
- Credits, free tiers, or volume discounts
- Provider-side rounding
- Auxiliary API calls not captured in session tracking

Use Cronalytics for **directional awareness** ("spend is trending up"), not accounting ("this is exactly what I'll be billed").

### Why do some rows show Actual: — ?

Hermes populates `actual_cost_usd` only when provider billing data is available — which is rare in most setups. Until reliable provider billing integration arrives, the Actual field is intentionally suppressed to avoid showing `$0.00` as if it were ground truth.

### Why does the cost and token reporting look different from the Hermes Analytics tab, Insights, or my provider invoice?

They're measuring different things:

- **Hermes Analytics tab** — gateway activity (chat, cron, API calls). Broader scope than Cronalytics, not filtered to cron-only.
- **Hermes Insights** — per-session cost snapshots. Can be filtered with `--source`, but most users see the aggregate view.
- **Your provider invoice** — what you're actually billed, including rate changes, credits, and auxiliary charges.
- **Cronalytics** — cron-only runs within one profile, using Hermes's session-time cost estimates.

Cronalytics is intentionally narrow: it isolates scheduled jobs so you can track per-job economics. If you're trying to square Cronalytics with your invoice, some drift is expected — see "How is estimated cost different from what my provider charges?" above.

### I see more models in the Analytics tab than in Cronalytics. Why?

Cronalytics only tracks models used by **cron jobs**. Chat sessions, ad-hoc CLI runs, and API calls use different models but don't appear here. The Models Breakdown card shows "models your cron jobs are costing you," not "every model you've ever used."

---

## Visibility & Data

### Where are my jobs? I created jobs but don't see them.

Check three things:

1. **Did the cron job actually run?** Cronalytics only captures completed runs. If the job is scheduled but hasn't fired yet, it won't appear.
2. **Are you on the right profile?** Cronalytics hooks into `on_session_end` on the profile where it's installed — by default, your **default** Hermes profile. Jobs created under a different profile run in an isolated gateway with their own `state.db` and won't appear.
3. **Did you click Sync Now?** Historical runs before installation need backfill. Click **Sync Now** in the dashboard toolbar.

**Cronalytics currently only supports the default profile.** Multi-profile cron support is on our roadmap.

### How often does data update?

Cronalytics captures data when a cron session **ends** (the `on_session_end` hook). There is no polling or real-time feed. If a session is still running, it won't appear until it finishes.

Historical data is backfilled by the reconciliation scanner — triggered manually (**Sync Now** button) or on plugin load.

### How far back can I look? How do I see my entire history?

The dashboard supports custom day ranges from **0 to 365 days**. The CLI supports `--days 0` for "all time" — no cap:

```bash
cronalytics summary --days 0 --json
cronalytics jobs --days 0 --json
```

Data goes back to the oldest session in `state.db` that the reconciliation scanner has processed.

### The job detail modal only shows 250 runs — why? How do I get all of them?

The modal caps at **250 runs** to keep the UI responsive. The backend ceiling is 500, but above ~250 the browser can struggle with row rendering.

**To see every run for a job:**

```bash
cronalytics runs --job <job_id> --days 0 --json
```

This returns every run in the fact database for that job, with no limit. Pipe to `jq` for filtering:

```bash
cronalytics runs --job <job_id> --days 0 --json | jq '.data | length'  # total count
cronalytics runs --job <job_id> --days 0 --json | jq '.data[] | select(.success == 0)'  # failures only
```

---

## Metrics & Interpretation

### What does Pace mean, in plain English?

**Pace = how fast you're burning through your scheduled budget.**

If you scheduled a job to cost $10/month and it's currently trending toward $15/month, its Pace is 1.5×. Above 1.0× means you're overshooting. Below 1.0× means you're under.

- **< 1.0× (green)** — Under budget. The job is running less than scheduled.
- **1.0–2.0× (neutral)** — On track.
- **≥ 2.0× (red)** — Over budget. The job is costing significantly more than planned.

Pace is computed by comparing `trend_monthly` (projection based on actual activity) to `nominal_monthly` (projection based on the job's schedule).

### Why is my Cost card amber/red?

The Cost card uses an **amber pill badge** to signal that all costs are estimated, not billed. If you're using the Success/Failure outcome toggle and switch to Failure-only view, the card background may shift to red to visually reinforce that you're looking at wasted spend.

### What's the difference between Success and Failure?

- **Success** = the cron wrapper finished without error — the job ran, the agent responded, and the wrapper exited cleanly.
- **Failure** = something went wrong with the run (timeout, API error, wrapper crash).

This is a **reliability** signal, not a **correctness** signal. A "successful" run might still have produced bad output if the prompt or model was wrong.

### What's the difference between agent and no-agent jobs?

Cron jobs run in two modes:

- **Agent** — Hermes spawns a full LLM agent session. The agent gets tools, thinking, and conversation turns. These are your "smart" jobs (summaries, research, analysis). They consume tokens and incur cost.
- **No agent** — Hermes runs a script directly (`/bin/bash` or Python) with no LLM involved. These are your "dumb" jobs (health checks, file cleanup, notifications). They cost nothing in tokens but still show up in Cronalytics with `$0.00` estimated cost.

Use the **Mode toggle** (All / Agent / No agent) in the dashboard toolbar to filter between them. No-agent jobs that show `$0.00` estimated cost and zero tokens are working correctly — they're not broken.

---

## Setup & Configuration

### Do I need to install the CLI?

No — the dashboard works standalone. The CLI is an optional add-on for:

- Scripting and automation (pipe `--json` output to `jq`)
- Agent consumption (Hermes agents read CLI output in diagnostic flows)
- Environments where you don't have a browser
- Getting a full run dump without the 250-run modal limit

Install it with: `pip install -e ~/.hermes/plugins/cronalytics`

### `cronalytics` isn't in my PATH — why, and how do I fix it?

The CLI isn't registered automatically — it's an optional add-on that requires a `pip install`:

```bash
pip install -e ~/.hermes/plugins/cronalytics
```

*(Arch Linux users may need `--break-system-packages` due to PEP 668.)*

Until installed, you can run it through Python:

```bash
cd ~/.hermes/plugins/cronalytics && python -m cronalytics.cli --help
```

If you've already `pip install`ed and it still isn't found, check that your `pip` user bin directory is in your `$PATH`. Pip will warn you on install if it isn't.

### Can I use Cronalytics without the Hermes dashboard?

You can use the CLI without opening the dashboard: `cronalytics summary --days 7`. But Cronalytics needs the dashboard plugin infrastructure to **collect** data (the `on_session_end` hook only fires inside a running dashboard server). The CLI reads from the fact database; it doesn't produce data on its own.

---

## Privacy & Data

### Is my data sent anywhere?

No. All data stays **local**:

- `facts.db` — plugin directory on your machine
- `state.db` — Hermes core directory, read by the reconciliation scanner
- API endpoints — served by your local dashboard server

Nothing is uploaded, phoned home, or sent to Nous Research or any third party.

### Can I see the raw data? How do I get a snapshot of my entire facts.db?

Yes — three ways, from quickest to most thorough:

```bash
# Quick: all CLI commands support --json
cronalytics all --days 0 --json

# Full job dump with per-run detail
cronalytics jobs --days 0 --json | jq '.data'

# Complete snapshot: everything in the database
sqlite3 ~/.hermes/plugins/cronalytics/facts.db '.mode json' 'SELECT * FROM cron_runs;'
```

The fact database is a standard SQLite file (`~/.hermes/plugins/cronalytics/facts.db`). You can query it directly with any SQLite client.

### How do I reset everything and start over?

1. Stop the Hermes dashboard: `hermes dashboard --stop`
2. Delete the fact database: `rm ~/.hermes/plugins/cronalytics/facts.db`
3. Delete the watermark: `rm ~/.hermes/plugins/cronalytics/watermark.json`
4. Reinstall the plugin (or restart the dashboard to trigger a fresh bootstrap)
5. Click **Sync Now** to backfill available history

---

## Contributing & Community

### I found a bug. Where do I report it?

Open an issue on [GitHub](https://github.com/8bit64k/cronalytics/issues).

### Can I contribute translations?

Yes — all locale catalogs are labeled "AI-validated first pass." Native speaker PRs are welcome and encouraged. See [I18N_PROTOCOL.md](I18N_PROTOCOL.md) for the translation process and [GLOSSARY.md](GLOSSARY.md) for technical term definitions.

---

*Version: 1.1.0*
