# Uninstall Guide

Cronalytics stores all data locally inside the plugin directory. Uninstall is a single directory removal.

## Quick Uninstall

```bash
rm -rf ~/.hermes/plugins/cronalytics
```

This removes:
- The plugin code
- The fact database (`facts.db`)
- The sync watermark (`watermark.json`)
- The pending queue (`pending.jsonl`)

## If Enabled in Config

If you added `cronalytics` to `plugins.enabled` in `~/.hermes/config.yaml`, remove it:

```yaml
plugins:
  enabled:
    - some_other_plugin
    # - cronalytics   <-- remove this line
```

Then restart the dashboard server:

```bash
hermes dashboard --no-open
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

## Clean Install (Remove All Trace)

```bash
# Remove plugin directory
rm -rf ~/.hermes/plugins/cronalytics

# Remove from enabled plugins list
# Edit ~/.hermes/config.yaml and delete the cronalytics line

# Restart dashboard
hermes dashboard --no-open
```

---

*Version: 1.0.0*
