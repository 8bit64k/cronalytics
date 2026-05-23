# Release Notes — v1.1.0 (2026-05-22)

## Major Launch: Native i18n & Multi-Model Consensus

This release introduces a hardened localization architecture for the Cronalytics dashboard.

### New Features
1. **Multilingual Dashboard:** 100% coverage for es, zh-CN, zh-TW.
2. **"2/4 Consensus" Gateway:** Multi-model validation protocol ensures technical accuracy. 
3. **Agent Standards (AGENTS.md):** Formal repo rules prohibiting hardcoded UI strings.
4. **Audit Trail:** New `docs/I18N_PROTOCOL.md` and `TRANSLATION.md` reference.

### Fixes & Improvements
- **Trend Spikes:** Gated arrows behind 1.75x history window to prevent false alarms.
- **UI Uniformity:** Consistent naming ("Avg Duration") and modernized icon-only refresh.

# Release Notes — Cronalytics v1.1.0

**Release date:** 2026-05-19  
**Codename:** "The CLI Tool + Skill"

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

**Install:** `pip install -e ~/.hermes/plugins/cronalytics` (requires plugin already installed via dashboard). Arch Linux users append `--break-system-packages`.

**Important:** The CLI is not a standalone product. It requires the plugin's `facts.db` to function. If you uninstall the plugin, the CLI stops working.

### Agent Diagnostic Skill

A built-in skill that teaches Hermes agents how to analyze your cron jobs with structured diagnostics.

Ask your agent:

> "Check my cron jobs for the last two weeks — flag anything that looks off."

The skill guides the agent through a 6-step workflow: baseline → jobs → per-run drill-down → failures → models → trends. Every finding is confidence-graded (HIGH / MEDIUM / LOW) with required evidence and alternative explanations.

**Install:** `hermes skills install https://raw.githubusercontent.com/8bit64k/cronalytics/main/skills/devops/cronalytics/SKILL.md --category devops --name cronalytics --yes`

---

## Upgrade Notes

### From v1.0.x

1. **Dashboard plugin:** Use the dashboard **Plugins** tab → **Update**, or run `hermes plugins update cronalytics`. Then **stop and start the dashboard** with a 2-second delay to ensure the port is released (`hermes dashboard --stop && sleep 2 && hermes dashboard`) for changes to take effect.
2. **CLI (new):** If you want the terminal command, run:
   ```bash
   pip install -e ~/.hermes/plugins/cronalytics
   ```
   *(Arch Linux users (btw) may need to add `--break-system-packages` due to PEP 668. Other distros omit that flag.)*
   ```bash
   hermes skills install \
     https://raw.githubusercontent.com/8bit64k/cronalytics/main/skills/devops/cronalytics/SKILL.md \
     --category devops --name cronalytics --yes
   ```
4. Hard-refresh the dashboard (`Ctrl+Shift+R` or `Cmd+Shift+R`).

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
