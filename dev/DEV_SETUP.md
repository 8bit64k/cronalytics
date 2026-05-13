# Developer Setup

This guide is for contributors and developers working on the Cronalytics plugin itself. End users should follow [`INSTALL.md`](INSTALL.md).

## Symlink Your Local Build (Recommended)

Keep your git repo and the active plugin in sync:

```bash
mkdir -p ~/.hermes/plugins
ln -s /path/to/cronalytics ~/.hermes/plugins/cronalytics
```

Any change you make in your build directory is immediately reflected after a gateway restart.

## Copy Method (If Symlink Fails)

Some environments don't follow symlinks for plugin loading:

```bash
mkdir -p ~/.hermes/plugins
cp -r /path/to/cronalytics ~/.hermes/plugins/cronalytics
```

You'll need to re-copy after every change.

## Running Tests

```bash
uv run pytest -q
```

For verbose output:

```bash
uv run pytest -v
```

## Lint & Type Check

```bash
uv run ruff check .
uv run mypy .
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
3. `hermes gateway restart` if you touched backend code
4. Hard-refresh browser
5. `uv run pytest -q` before committing

---

*For end-user install/uninstall, see [`INSTALL.md`](INSTALL.md) and [`UNINSTALL.md`](UNINSTALL.md).*
