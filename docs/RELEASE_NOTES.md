# Release Notes — Cronalytics v1.1.0 (2026-05-26)
**"The CLI Tool + Skill" Release**

## New and Improved Features

### New Features
1. Terminal CLI Tool
2. Agent Diagnostic Skill
3. **Multilingual/Localization Support (i18n)**: coverage for [en, es, zh-CN, zh-TW].

### Improvements
- **Trend Spikes:** Gated arrows behind 1.75x history window to prevent false alarms.
- **UI Uniformity:** Consistent naming ("Avg Duration") and modernized icon-only refresh.

---

## What's New

### Terminal CLI

Cronalytics now ships a terminal interface for scripts, agents, and programmatic access.

```bash
# Full diagnostic report in one command
cronalytics all --days 30

# Find jobs burning the most tokens
cronalytics jobs --days 7 --json | jq '.data[] | select(.pace > 1.2)'

# Drill into a specific job's run history
cronalytics runs --job 67541bf6e230 --days 30 --json
```

**Important:** The CLI is not a standalone product. It requires the plugin's `facts.db` to function. If you uninstall the plugin, the CLI stops working.

### Agent Diagnostic Skill

A built-in skill that teaches Hermes agents how to analyze your cron jobs with structured diagnostics.

Ask your agent:

> "Check my cron jobs for the last two weeks — flag anything that looks off."

The skill guides the agent through a structured 7-step diagnostic workflow (time window verification → baseline health → job-level drill → per-run investigation → failure pattern → model economics → trend validation). Every finding is confidence-graded (HIGH / MEDIUM / LOW) with required evidence and alternative explanations.

---

### File Layout Change

v1.1.0 restructures the repo from flat files at root into a `cronalytics/` package directory. This is a transparent change for dashboard-plugin users — `git pull` handles it automatically. If you previously ran `python cli.py` directly from the plugin directory, update your invocation:

| Before (v1.0.x) | After (v1.1.0) |
|-----------------|----------------|
| `python ~/.hermes/plugins/cronalytics/cli.py` | `cronalytics` (pip) or `python -m cronalytics.cli` |

---

## Known Limitations (unchanged from v1.0.x)

- Wrapper-level success only — we track whether the session finished, not whether the task succeeded.
- Abandoned sessions are invisible — crashes or hangs never reach `ended_at`.
- No user-editable config file yet — all tuning values are hardcoded.
- Job detail modal capped at 200 runs.
- Mobile layout is functional but not optimized.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

---

## Requirements

- Hermes Agent v0.10.0+
- `state.db` present at `~/.hermes/state.db`
- Dashboard server running (`hermes dashboard`)
- Python ≥3.11

---

*For the full version history, see [CHANGELOG.md](../CHANGELOG.md).*
