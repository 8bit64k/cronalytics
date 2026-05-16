# Installation Guide

Cronalytics installs as a **dashboard plugin** (primary) with an optional **pip install** for global CLI access and **skill symlink** for agent diagnostics.

---

## Dashboard Plugin (Recommended)

Open the Hermes dashboard and navigate to the **Plugins** tab. Find the **Install from GitHub / Git URL** section and enter either:

- `owner/repo` shorthand (e.g. `8bit64k/cronalytics`)
- A full `https://` or `git@` clone URL

Check **Enable after install**, then click **Install**.

Hard-refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear cached JS.

The **Cronalytics** tab appears in the sidebar. The CLI is available immediately at `~/.hermes/plugins/cronalytics/cli.py`.

---

## Manual Copy

If you prefer to install from a local clone:

```bash
mkdir -p ~/.hermes/plugins
cp -r /path/to/cronalytics ~/.hermes/plugins/cronalytics
```

Then restart the gateway so hooks register and API routes mount:

```bash
hermes gateway restart
```

Hard-refresh your browser to pick up the new frontend bundle.

---

## CLI via pip (Optional)

For global terminal access outside the Hermes environment:

```bash
pip install cronalytics
```

This installs the `cronalytics` command, which auto-detects your plugin's fact database and works from any directory:

```bash
cronalytics summary --days 14
cronalytics jobs --json | jq '.data[] | select(.pace > 1.0)'
```

**No additional setup needed** if you already installed the dashboard plugin — the pip CLI discovers `~/.hermes/plugins/cronalytics/facts.db` automatically.

---

## Skill Setup (Optional)

Cronalytics includes a built-in diagnostic skill at `skills/devops/cronalytics/SKILL.md`. To enable it for your Hermes agent:

```bash
# Create the skill directory if it doesn't exist
mkdir -p ~/.hermes/skills/devops

# Symlink the skill from the plugin directory
ln -s ~/.hermes/plugins/cronalytics/skills/devops/cronalytics \
  ~/.hermes/skills/devops/cronalytics
```

Verify it loads:

```bash
hermes skills list | grep cronalytics
# → cronalytics ✓
```

Once enabled, the agent automatically uses the skill when you ask about cron jobs. No manual invocation required — the skill's trigger conditions match natural language queries like "check my cron jobs" or "what's burning tokens?".

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
2. **Or trigger a manual backfill** — click **Sync Now** in the dashboard toolbar.

If the dashboard shows "No cron jobs captured," click **Sync Now**.

> **Note on `curl`:** The sync endpoint requires the dashboard's ephemeral session token for security. The token is injected into the SPA and changes on each dashboard restart. If you need to trigger sync from a script, extract the token from `window.__HERMES_SESSION_TOKEN__` in the dashboard page source and pass it as:
> ```bash
> curl -H "X-Hermes-Session-Token: <token>" -X POST http://localhost:9119/api/plugins/cronalytics/sync
> ```
> Most users should use the dashboard **Sync Now** button instead.

## Reverse Proxy Setup

If you run the Hermes dashboard behind **Caddy**, **Nginx**, or another reverse proxy, ensure `/api/*` routes are forwarded directly to the dashboard backend. The Hermes dashboard serves the SPA fallback (`index.html`) for any unmatched path, so a misconfigured proxy will return HTML instead of JSON for plugin API calls.

**Common cause:** `try_files` or `rewrite` rules intercepting `/api/*` paths.

**Minimal Caddy example:**

```caddy
# Forward all /api/* routes to the Hermes dashboard backend
reverse_proxy /api/* localhost:9119

# Serve the SPA for everything else
reverse_proxy localhost:9119
```

If you see `Unexpected token '<'` errors in the Cronalytics tab after installing behind a proxy, check this configuration first. See [Troubleshooting](#troubleshooting) for more details.

## Requirements

- Hermes Agent v0.10.0+
- `state.db` present at `~/.hermes/state.db` (default Hermes install)
- Dashboard server running (`hermes dashboard`)

## Verification

After install:

1. Open the dashboard sidebar — you should see a **Cronalytics** tab.
2. Click it — the hero banner and toolbar should render.
3. Click **Sync Now** — after a few seconds, the toast should show `✓ Synced N runs`.
4. The Jobs Breakdown table should populate with your cron job history.

---

*Version: 1.1.0*  
*Last updated: 2026-05-16*

---

## Troubleshooting

### Reverse proxy (Caddy, Nginx) returns HTML for API routes

If you run the Hermes dashboard behind a reverse proxy and see JSON parse errors (`Unexpected token '<'`), the proxy may be routing API requests incorrectly. The Hermes dashboard serves the SPA fallback (`index.html`) for any unmatched route, so any proxy misconfiguration sends HTML instead of JSON to `/api/plugins/cronalytics/*`.

**Common cause:** Caddy (or Nginx) `try_files` or `rewrite` rules intercepting `/api/*` paths before they reach the dashboard server.

**Fix:** Ensure your reverse proxy forwards `/api/plugins/cronalytics/*` directly to the Hermes dashboard backend without rewriting or serving static files. A minimal Caddy example:

```caddy
# Forward all /api/* routes to the Hermes dashboard backend
reverse_proxy /api/* localhost:9119

# Serve the SPA for everything else
reverse_proxy localhost:9119
```

After updating the proxy config, hard-refresh the browser.

### "Unexpected token '<'" error in the dashboard

If the Cronalytics tab shows a JSON parse error mentioning `<!doctype`, the dashboard's cached JavaScript bundle is requesting an old or unmounted API route. The Hermes dashboard server serves the SPA fallback (HTML) for any unmatched path, and the browser tries to parse that HTML as JSON.

**Fix:** Perform a **hard refresh** (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear the browser cache and load the latest frontend bundle. If you're behind a reverse proxy, also verify the [reverse proxy configuration](#reverse-proxy-setup) above.

### API routes are mounted but requests return HTML

If you see plugin API routes mounted in the dashboard server logs (e.g., `/api/plugins/cronalytics/`) but requests still return HTML, the dashboard server may have been restarted after the plugin loaded.

**Fix:** Restart the dashboard server (`hermes dashboard --stop` then `hermes dashboard`) and hard-refresh the browser.

### `curl` returns `{"detail":"unauthorized"}`

The Cronalytics API (and all Hermes plugin APIs) requires the dashboard's ephemeral session token. This token is generated when the dashboard starts and is injected into the SPA's `index.html`.

**Fix:** Use the dashboard **Sync Now** button instead. If you must use `curl` from a script, extract `window.__HERMES_SESSION_TOKEN__` from the dashboard page source and pass it in the `X-Hermes-Session-Token` header.

### "No cron jobs captured" after install

Cronalytics only captures jobs from the `on_session_end` hook going forward. Historical runs are backfilled via the reconciliation scanner.

**Fix:** Click **Sync Now** in the dashboard toolbar. The scanner reads `state.db` and inserts any cron sessions newer than the last watermark.