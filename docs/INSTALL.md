# Installation Guide

Cronalytics installs as a **Hermes dashboard plugin** (primary). The CLI and agent skill are included automatically — no separate install needed.

> **Install path mantra:** Use Hermes-native methods first. Fallback to manual copy only when the native tools don't fit.

---

## 1. Plugin Install

### Primary: Dashboard UI (Recommended)

Open the Hermes dashboard and navigate to the **Plugins** tab. Find the **Install from GitHub / Git URL** section and enter either:

- `8bit64k/cronalytics` (owner/repo shorthand)
- `https://github.com/8bit64k/cronalytics.git` (full clone URL)

Check **Enable after install**, then click **Install**.

Hard-refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear cached JS. The **Cronalytics** tab appears in the sidebar.

The CLI and skill are available immediately from the plugin directory — no extra steps.

### Secondary: CLI

```bash
hermes plugins install 8bit64k/cronalytics --enable
```

### Tertiary: Manual Copy

If you prefer to install from a local clone or prefer to audit every file:

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

## 2. CLI Access

The CLI is bundled with the plugin. You have it as soon as the plugin is installed.

### CLI Access

The CLI is bundled with the plugin. You have it as soon as the plugin is installed.

**Primary: Plugin Path (Default)**

```bash
python ~/.hermes/plugins/cronalytics/cli.py summary --days 14
python ~/.hermes/plugins/cronalytics/cli.py jobs --json
```

No `cd` needed — run from any directory. The CLI auto-detects its own fact DB.

**Secondary: Shell Alias**

If you want a shorter command, add an alias in `~/.bashrc` or `~/.zshrc`:

```bash
alias cronalytics='python ~/.hermes/plugins/cronalytics/cli.py'
```

Then use it anywhere:

```bash
cronalytics summary --days 14
cronalytics runs --job 67541bf6e230 --days 30
```

---

## 3. Skill Setup

The agent diagnostic skill ships inside the plugin at `skills/devops/cronalytics/SKILL.md`.

### Primary: Native Hermes Install

```bash
hermes skills install \
  https://raw.githubusercontent.com/8bit64k/cronalytics/main/skills/devops/cronalytics/SKILL.md \
  --category devops \
  --name cronalytics \
  --yes
```

This is the native Hermes path. It handles directory creation (`~/.hermes/skills/devops/`), conflict resolution, and skill validation automatically.

### Secondary: Manual Copy

If you already installed the plugin and want to enable the skill manually:

```bash
mkdir -p ~/.hermes/skills/devops
cp -r ~/.hermes/plugins/cronalytics/skills/devops/cronalytics \
  ~/.hermes/skills/devops/cronalytics
```

Verify it loads:

```bash
hermes skills list | grep cronalytics
# → cronalytics ✓
```

Once enabled, the agent automatically uses the skill when you ask about cron jobs. No manual invocation required — the skill's trigger conditions match natural language queries like "check my cron jobs" or "what's burning tokens?".

---

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
├── cli.py                   # Standalone terminal interface
├── skills/
│   └── devops/
│       └── cronalytics/
│           └── SKILL.md     # Built-in diagnostic skill for agents
├── dashboard/
│   ├── manifest.json        # Slot registration + routes
│   ├── plugin_api.py        # REST API mounted at /api/plugins/cronalytics/
│   ├── build.js             # esbuild bundler script
│   ├── src/                 # Modular frontend source
│   └── dist/
│       └── index.js         # Bundled React frontend
└── tests/                   # Unit tests (run with pytest)
```

---

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

---

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

---

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
