# Developer Setup

This guide is for contributors and developers working on the Cronalytics plugin itself. End users should follow [`INSTALL.md`](../INSTALL.md).

## Running from Source

For development, clone the repo and install the plugin from your local path:

```bash
hermes plugins install /path/to/cronalytics --enable
```

Or work directly in `~/.hermes/plugins/cronalytics/` if you already installed from GitHub.

## Running Tests

```bash
python -m pytest tests/ -v --tb=short
```

For verbose output:

```bash
python -m pytest tests/ -v
```

## Lint & Type Check

```bash
ruff check .
mypy .
```

## Building the Dashboard

```bash
cd dashboard
node build.js
```

Produces `dashboard/dist/index.js`.

## Workflow Summary

1. Make changes in your git repo
2. `node dashboard/build.js` if you touched frontend code
3. Restart the Hermes dashboard server if you touched backend code
4. Hard-refresh browser (`Ctrl+Shift+R` or `Cmd+Shift+R`)
5. `python -m pytest tests/ -v --tb=short` before committing

---

*For end-user install/uninstall, see [`INSTALL.md`](INSTALL.md) and [`UNINSTALL.md`](../UNINSTALL.md).*
