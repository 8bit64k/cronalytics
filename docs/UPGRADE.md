# Upgrading Cronalytics

This guide covers the transition to **Cronalytics v1.1.0**, which introduces a major architecture change (namespace restructure) to support the new CLI and Agent Skill.

## From v1.0.x to v1.1.0

### 1. Update the Plugin
Pull the latest code using the Hermes CLI:
```bash
hermes plugins update cronalytics
```

### 2. Restart the Dashboard (Required)
Because v1.1.0 changes the internal Python namespace and API validation patterns, you **must** restart the dashboard to clear the old code from memory:
```bash
hermes dashboard restart
```
*Note: Failure to restart may result in `422 Unprocessable Entity` errors in the browser.*

### 3. Register the CLI Add-on
To enable the new `cronalytics` terminal command, register the entry point from the updated plugin directory:
```bash
pip install -e ~/.hermes/plugins/cronalytics
```
*Note: Arch Linux users (btw) may need to add `--break-system-packages` to the pip command due to PEP 668. Other distros should omit this flag.*


---

## Troubleshooting Upgrade Issues

### 422 Error: string_pattern_mismatch
**Symptoms:** Dashboard fails to load; browser console shows 422 error on `outcome` or `mode`.
**Cause:** Old v1.0 code is still running in the Gateway/Dashboard memory.
**Fix:** Run `hermes dashboard restart` and perform a hard refresh in your browser ($Ctrl+Shift+R$).

### Missing Command: `cronalytics`
**Cause:** The CLI is an optional entry point that must be registered via pip.
**Fix:** Run the `pip install -e` command listed in Step 3 above.
