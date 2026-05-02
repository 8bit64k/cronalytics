# Installation Guide

## Quick Install (Copy)

Hermes plugins are static directories. No package manager required.

```bash
# 1. Copy the plugin into your Hermes plugins directory
mkdir -p ~/.hermes/plugins
cp -r /path/to/cron-insights ~/.hermes/plugins/cron-insights

# 2. Restart the Hermes dashboard server
hermes dashboard --no-open

# 3. Hard-refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

# 4. Open the Cron Insights tab in the sidebar
```

## Structure After Install

```
~/.hermes/plugins/cron-insights/
├── plugin.yaml              # Plugin manifest (hooks, version)
├── __init__.py              # Register hook + bootstrap scanner
├── facts.py                 # SQLite fact database
├── scanner.py               # Backfill + watermark logic
├── ingester.py              # Deferred ingestion worker
├── config.py                # Paths + defaults
├── logger.py                # Shared logger
├── checkpoint.py            # Session state persistence
├── dashboard/
│   ├── manifest.json        # Slot registration + routes
│   ├── plugin_api.py        # REST API mounted at /api/plugins/cron-insights/
│   └── dist/
│       └── index.js         # Bundled React frontend
├── tests/                   # Unit tests (run with pytest)
└── watermark.json           # Auto-created: sync watermark
```

## First-Time Setup

After install, the plugin needs data.

1. **Wait for a cron job to run** — the `on_session_end` hook captures it automatically.
2. **Or trigger a manual backfill** — click **Sync Now** in the dashboard, or run:

```bash
curl -X POST http://localhost:9119/api/plugins/cron-insights/sync
```

If the dashboard shows "No cron jobs captured," click **Sync Now**.

## Requirements

- Hermes Agent v0.10.0+
- `state.db` present at `~/.hermes/state.db` (default Hermes install)
- Dashboard server running (`hermes dashboard`)

## Uninstall

```bash
rm -rf ~/.hermes/plugins/cron-insights
```

Remove `cron-insights` from `plugins.enabled` in `~/.hermes/config.yaml` if listed there, then restart the dashboard.
