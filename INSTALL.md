# Installation Guide

## Method 1: Copy

Hermes plugins are static directories. No package manager required.

```bash
# 1. Copy the plugin into your Hermes plugins directory
mkdir -p ~/.hermes/plugins
cp -r /path/to/cronalytics ~/.hermes/plugins/cronalytics

# 2. Restart the Hermes dashboard server
hermes dashboard --no-open

# 3. Hard-refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

# 4. Open the Cronalytics tab in the sidebar
```

## Method 2: Symlink (recommended for development)

```bash
mkdir -p ~/.hermes/plugins
ln -s /path/to/cronalytics ~/.hermes/plugins/cronalytics
```

This keeps your build directory and the active plugin in sync. Any change you make is immediately reflected after a dashboard restart.

## Method 3: Dashboard Plugins Tab

Open the Hermes dashboard and navigate to the **Plugins** tab. Find the **Install from GitHub / Git URL** section and enter either:

- `owner/repo` shorthand (e.g. `yourname/cronalytics`)
- A full `https://` or `git@` clone URL (e.g. `https://github.com/yourname/cronalytics.git`)

The dashboard will clone the repository into `~/.hermes/plugins/cronalytics/` automatically.

Then restart the dashboard server:

```bash
hermes dashboard --no-open
```

## Structure After Install

```
~/.hermes/plugins/cronalytics/
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
│   ├── plugin_api.py        # REST API mounted at /api/plugins/cronalytics/
│   ├── build.js             # esbuild bundler script
│   ├── src/                 # Modular frontend source
│   └── dist/
│       └── index.js         # Bundled React frontend
└── tests/                   # Unit tests (run with pytest)
```

## First-Time Setup

After install, the plugin needs data.

1. **Wait for a cron job to run** — the `on_session_end` hook captures it automatically.
2. **Or trigger a manual backfill** — click **Sync Now** in the dashboard, or run:

```bash
curl -X POST http://localhost:9119/api/plugins/cronalytics/sync
```

If the dashboard shows "No cron jobs captured," click **Sync Now**.

## Requirements

- Hermes Agent v0.10.0+
- `state.db` present at `~/.hermes/state.db` (default Hermes install)
- Dashboard server running (`hermes dashboard`)

## Verification

After install and restart:

1. Open the dashboard sidebar — you should see a **Cronalytics** tab.
2. Click it — the hero banner and toolbar should render.
3. Click **Sync Now** — after a few seconds, the toast should show `✓ Synced N runs`.
4. The Jobs Breakdown table should populate with your cron job history.

---

*Version: 1.0.0*
