# Troubleshooting

> Common issues and fixes for Cronalytics.

---

## Reverse Proxy Returns HTML for API Routes

If you run the Hermes dashboard behind a reverse proxy (e.g., **Caddy**, **Nginx**) and see JSON parse errors (`Unexpected token '<'`), the proxy may be routing API requests incorrectly. The Hermes dashboard serves the SPA fallback (`index.html`) for any unmatched route, so any proxy misconfiguration sends HTML instead of JSON to `/api/plugins/cronalytics/*`.

**Common cause:** Caddy `try_files` or Nginx `rewrite` rules intercepting `/api/*` paths before they reach the dashboard server.

**Fix:** Ensure your reverse proxy forwards `/api/plugins/cronalytics/*` directly to the Hermes dashboard backend without rewriting or serving static files.

**Minimal Caddy example:**

```caddy
# Forward all /api/* routes to the Hermes dashboard backend
reverse_proxy /api/* localhost:9119

# Serve the SPA for everything else
reverse_proxy localhost:9119
```

After updating the proxy config, hard-refresh the browser (`Ctrl+Shift+R` or `Cmd+Shift+R`).

---

## "Unexpected token '<'" Error in the Dashboard

If the Cronalytics tab shows a JSON parse error mentioning `<!doctype`, the dashboard's cached JavaScript bundle is requesting an old or unmounted API route. The Hermes dashboard server serves the SPA fallback (HTML) for any unmatched path, and the browser tries to parse that HTML as JSON.

**Fix:** Perform a **hard refresh** (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear the browser cache and load the latest frontend bundle. If you're behind a reverse proxy, also verify the [reverse proxy configuration](#reverse-proxy-returns-html-for-api-routes) above.

---

## API Routes Are Mounted but Requests Return HTML

If you see plugin API routes mounted in the dashboard server logs (e.g., `/api/plugins/cronalytics/`) but requests still return HTML, the dashboard server may have been restarted after the plugin loaded.

**Fix:** Restart the Hermes dashboard server and hard-refresh the browser.

---

## `curl` Returns `{"detail":"unauthorized"}`

The Cronalytics API (and all Hermes plugin APIs) requires the dashboard's ephemeral session token. This token is generated when the dashboard starts and is injected into the SPA's `index.html`.

**Fix:** Use the dashboard **Sync Now** button instead. If you must use `curl` from a script, extract `window.__HERMES_SESSION_TOKEN__` from the dashboard page source and pass it in the `X-Hermes-Session-Token` header.

---

## "No cron jobs captured" After Install

Cronalytics only captures jobs from the `on_session_end` hook going forward. Historical runs are backfilled via the reconciliation scanner.

**Fix:** Click **Sync Now** in the dashboard toolbar. The scanner reads `state.db` and inserts any cron sessions newer than the last watermark.

---

## CLI Not Found (`command not found: cronalytics`)

If you see `command not found: cronalytics`, the CLI hasn't been installed yet. The CLI requires a separate `pip` install:

```bash
pip install -e ~/.hermes/plugins/cronalytics --break-system-packages
```

*(Arch Linux requires `--break-system-packages` due to PEP 668. Other distros omit that flag.)*

Alternatively, run through the plugin directory without pip:

```bash
cd ~/.hermes/plugins/cronalytics && python -m cronalytics.cli --help
```

---

*Version: 1.1.0*  
*Last updated: 2026-05-17*
