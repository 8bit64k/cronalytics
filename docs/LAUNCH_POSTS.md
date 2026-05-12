# Cronalytics v1.0.0 — Launch Posts
# Ready to copy-paste. Timestamp: 2026-05-12

---

## X/Twitter Thread (7 tweets)

### Tweet 1 (Hook)
I built a dashboard that shows me exactly what my cron jobs are costing.

Every scheduled run. Every model. Every dollar.

No more background automation turning into background waste.

Introducing Cronalytics → https://github.com/8bit64k/cronalytics

👇

### Tweet 2 (Problem)
My Hermes agent runs ~30 cron jobs per day.

Some hit GPT-4o. Some hit Claude 3.7 Sonnet. Some are just bash scripts.

I had no idea which ones were expensive, which ones were failing silently, or which ones had become pure waste.

The cost was invisible. Until now.

### Tweet 3 (Solution)
Cronalytics hooks into `on_session_end` and attributes every cron run to:

• Session cost (per-model pricing)
• Token usage (input / output / cached)
• Success vs failure split
• Pace (are you accelerating toward a surprise bill?)

All in a dashboard tab inside Hermes. Zero external dependencies.

### Tweet 4 (Dashboard features)
What you see:

📊 Summary Board — total runs, cost, tokens, pace
🏆 Leader Board — top jobs by runs, cost, tokens, pace
📊 Per-Model Breakdown — proportional cost bars
📋 Jobs Table — 8 sortable columns, expandable detail rows
🔍 Job Detail Modal — 200-run history, sticky headers

All filterable by outcome (success/failure) and mode (agent/no-agent).

### Tweet 5 (GIF)
[Attach: cronalytics-tour.gif]

30 seconds of the dashboard in action.

Outcome toggle. Sortable table. Expandable rows. Sync button.

Everything runs inside the Hermes dashboard. No separate service. No extra auth.

### Tweet 6 (Technical)
Built with:

• Python backend (SQLite fact DB, pytest, ruff, mypy)
• React frontend (Hermes SDK, zero npm deps)
• esbuild bundler (116 KB single file)
• 83 tests, clean lint, clean types

Open source. Install by copying one directory.

### Tweet 7 (CTA)
If you run cron jobs with LLMs and you're not tracking cost per run, you're flying blind.

Cronalytics fixes that in 30 seconds.

⭐ Star it: https://github.com/8bit64k/cronalytics
📝 Install: https://github.com/8bit64k/cronalytics/blob/master/docs/INSTALL.md
📸 Demo GIF in the release: https://github.com/8bit64k/cronalytics/releases/tag/v1.0.0

Built with @nousresearch Hermes Agent.

---

## Discord Announcement (Nous Research — #showcase or #general)

**Cronalytics v1.0.0 — Turn hidden automation into visible spend**

A Hermes Agent plugin that attributes session-level usage and estimated cost to every cron-originated run.

**What it does:**
Hooks into `on_session_end`, stores cost/token/duration/success data in a local SQLite fact DB, and surfaces it in a dedicated `/cronalytics` dashboard tab inside Hermes.

**Dashboard:**
• Summary Board (runs, cost, tokens, pace)
• Leader Board (top runs, cost, tokens, pace)
• Per-Model Breakdown (proportional cost bars)
• Jobs Table (8 sortable columns, expandable rows)
• Job Detail Modal (200-run history)
• Outcome + Mode filters with localStorage
• Sync Now button for on-demand backfill

**Quality:**
83 pytest tests. ruff + mypy clean. iPad + large-font theme compatible. Keyboard accessible. Zero external frontend dependencies.

**Install:**
```bash
cp -r /path/to/cronalytics ~/.hermes/plugins/
```

🔗 GitHub: https://github.com/8bit64k/cronalytics
🚀 Release: https://github.com/8bit64k/cronalytics/releases/tag/v1.0.0
📜 Docs: https://github.com/8bit64k/cronalytics/tree/master/docs

Built with Hermes Agent. Feedback welcome.

---

## Launch Checklist

- [x] GitHub release v1.0.0 live
- [x] Demo GIF attached to release
- [ ] X thread posted
- [ ] Discord announcement posted

**Repo:** https://github.com/8bit64k/cronalytics
**Release:** https://github.com/8bit64k/cronalytics/releases/tag/v1.0.0
