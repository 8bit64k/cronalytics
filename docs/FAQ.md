# Frequently Asked Questions

> Quick answers to common questions. For error messages and fixes, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Cost & Billing

### Why is my cost showing $0.00?

Cronalytics reads the cost that Hermes computed during each cron session. If Hermes doesn't have a cost estimate for a run (provider didn't return one, model doesn't report costs, or the session predates cost tracking), the field is `$0.00`. This is most common with `no_agent` script jobs and very old historical runs.

**Fix:** Click **Sync Now** to backfill recent runs. If zero-cost rows persist, check whether the provider/model you're using reports costs to Hermes.

### How is estimated cost different from what my provider charges?

Cronalytics shows the **estimated cost** that Hermes computed locally at session time — based on the provider's published per-token rates. Your actual invoice may differ because of:

- Rate changes since the session ran
- Credits, free tiers, or volume discounts
- Provider-side rounding
- Auxiliary API calls not captured in session tracking

Use Cronalytics for **directional awareness** ("spend is trending up"), not accounting ("this is exactly what I'll be billed").

### Why do some rows show Actual: — ?

Hermes populates `actual_cost_usd` only when provider billing data is available — which is rare in most setups. Until reliable provider billing integration arrives, the Actual field is intentionally suppressed to avoid showing `$0.00` as if it were ground truth.

---

## Visibility & Data

### Why don't I see ALL my cron jobs?

Cronalytics hooks into `on_session_end` on the profile where it's installed. By default, that's your **default** Hermes profile. If you've created cron jobs under a different profile (`hermes --profile staging cron create ...`), those jobs run in an isolated gateway with their own `state.db` — Cronalytics can't see them.

**To monitor multiple profiles:** install Cronalytics in each profile's `plugins/` directory.

### How often does data update?

Cronalytics captures data when a cron session **ends** (the `on_session_end` hook). There is no polling or real-time feed. If a session is still running, it won't appear until it finishes.

Historical data is backfilled by the reconciliation scanner — triggered manually (**Sync Now** button) or on plugin load.

### How far back can I look?

The dashboard supports custom day ranges from **0 to 365 days**. The CLI supports `--days 0` for "all time." Data retention depends on how long you've had Cronalytics installed and how many sessions `state.db` retains.

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

---

## Setup & Configuration

### Do I need to install the CLI?

No — the dashboard works standalone. The CLI is an optional add-on for:

- Scripting and automation (pipe `--json` output to `jq`)
- Agent consumption (Hermes agents read CLI output in diagnostic flows)
- Environments where you don't have a browser

Install it with: `pip install -e ~/.hermes/plugins/cronalytics`

### What's the difference between Cronalytics and Hermes's built-in analytics tab?

Hermes's built-in analytics tab shows **aggregate gateway statistics** across all activity types (chat, cron, API). Cronalytics isolates **cron-only runs**, tracks per-job economics, and adds scheduling context (pace, nominal, trend projections). They're complementary — analytics for "what's happening," Cronalytics for "what's it costing and is it on plan."

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

### Can I see the raw data?

Yes — the CLI outputs JSON for every data command:

```bash
cronalytics summary --days 7 --json
cronalytics jobs --days 30 --json
cronalytics runs --job <id> --json
```

The fact database is also a standard SQLite file (`~/.hermes/plugins/cronalytics/facts.db`). You can query it directly with any SQLite client.

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
