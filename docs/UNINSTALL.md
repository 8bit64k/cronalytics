# Uninstall Guide

## Method 1: Dashboard Plugins Tab (Recommended)

Navigate to the **Plugins** tab in the Hermes dashboard. Find Cronalytics in the list and click **Delete**. This removes the plugin directory and disables it in config automatically.

## Method 2: Manual Removal

```bash
rm -rf ~/.hermes/plugins/cronalytics
```

This removes:
- The plugin code
- The fact database (`facts.db`)
- The sync watermark (`watermark.json`)
- The pending queue (`pending.jsonl`)

If you added `cronalytics` to `plugins.enabled` in `~/.hermes/config.yaml`, remove it:

```yaml
plugins:
  enabled:
    - some_other_plugin
    # - cronalytics   <-- remove this line
```

Then restart the gateway:

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
*Last updated: 2026-05-16*
