# Uninstall Guide

## Method 1: Dashboard Plugins Tab (Recommended)

Navigate to the **Plugins** tab in the Hermes dashboard. Find Cronalytics in the list and click **Delete**. This removes the plugin code, fact database, watermark, and pending queue.

> **Important:** If you installed the CLI via `pip`, it must be uninstalled separately:
> ```bash
> pip uninstall cronalytics
> ```
> *(Arch Linux users (btw) may need to add `--break-system-packages` due to PEP 668. Other distros omit that flag.)*

## Method 2: Manual Removal

```bash
rm -rf ~/.hermes/plugins/cronalytics
```

This removes the plugin code, fact database (`facts.db`), sync watermark (`watermark.json`), and pending queue (`pending.jsonl`).

If you added `cronalytics` to `plugins.enabled` in `~/.hermes/config.yaml`, remove it:

```yaml
plugins:
  enabled:
    - some_other_plugin
    # - cronalytics   <-- remove this line
```

If the dashboard still shows the Cronalytics tab after manual removal, restart the dashboard server.

```bash
hermes gateway restart
```

## Data Preservation

If you want to keep your analytics history before uninstalling, back up the fact database:

```bash
cp ~/.hermes/plugins/cronalytics/facts.db ~/cronalytics-backup-$(date +%Y%m%d).db
```

To restore later, reinstall the plugin and copy the backup back:

```bash
cp ~/cronalytics-backup-YYYYMMDD.db ~/.hermes/plugins/cronalytics/facts.db
```

---

*Version: 1.1.0*  
*Last updated: 2026-05-26*