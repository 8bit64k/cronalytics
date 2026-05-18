# Cronalytics — Session Checkpoint

**Date:** 2026-05-17  
**Branch:** `feat/cli-terminal-access`  
**Tip:** `509cb38`  
**Goal:** Validate and lock down all install/upgrade paths for Cronalytics v1.1.0 ("The CLI Tool + Skill" release) shipping Tuesday.

---

## What Happened This Session

Full documentation audit and alignment across all public and developer docs. v1.1.0 code remains locked.

### Commits (newest first)

```
509cb38 docs: add CHANGELOG.md and RELEASE_NOTES.md to README index
088b07c docs: add CHANGELOG.md and RELEASE_NOTES.md; fix manifest version
2c905a0 docs: audit and align all docs for v1.1.0 release
7cb672b (prior) Revert skill auto-link from __init__.py
```

---

## Key Changes Made

### 1. Stale CLI Path Elimination

Every doc had `python ~/.hermes/plugins/cronalytics/cli.py` — the pre-restructure flat-file path. Updated to the correct post-restructure invocations:

- **Primary:** `cronalytics` (via `pip install -e ~/.hermes/plugins/cronalytics`)
- **Fallback:** `python -m cronalytics.cli`

Files touched: `README.md`, `docs/INSTALL.md`, `docs/USAGE.md`, `cronalytics/cli.py` docstring, `skills/devops/cronalytics/SKILL.md`.

### 2. "Standalone CLI" → "Terminal CLI" / "Optional Add-On"

The CLI is not a standalone product. It requires the plugin's `facts.db`. Removed "standalone" branding everywhere. Positioned as: install plugin → optionally pip-install CLI → optionally install skill.

### 3. CLI and Skill Are Not Auto-Included

Removed false claims that "CLI and skill are included automatically." Clarified:
- Plugin install gets you the dashboard only.
- CLI requires separate `pip install -e`.
- Skill requires separate `hermes skills install`.

### 4. File Layouts Updated

README, INSTALL, DESIGN, FEATURES all showed old flat layout (`cli.py` at root). Updated to show the `cronalytics/` package directory structure.

### 5. `docs/TROUBLESHOOTING.md` Created

Extracted from the troubleshooting section in `docs/INSTALL.md`. New sections added: "CLI Not Found" (`command not found: cronalytics` fix). INSTALL.md now links to it.

### 6. `CHANGELOG.md` and `docs/RELEASE_NOTES.md` Created

- **CHANGELOG.md** (root): Full version history extracted from README inline content.
- **RELEASE_NOTES.md**: v1.1.0 narrative with upgrade instructions, new feature walkthroughs, and old→new CLI invocation migration table.

### 7. `dashboard/manifest.json` Version Fix

Bumped `"version": "0.1.0"` → `"1.1.0"` — the only user-facing code asset that was out of sync with `plugin.yaml`, `pyproject.toml`, and `plugin_api.py`.

### 8. `.gitignore` Deduped

Removed duplicate `CHECKPOINT.md` entry.

### 9. `dev/DEV_SETUP.md` Rewritten

Removed symlink advocacy (against user policy). Aligned with official install methods only.

### 10. Version Strings and Test Counts Fixed

- `dev/FEATURES.md`: header → `1.1.0`, test count → 149, added CLI shared flags section.
- Removed "Focus trap deferred to v1.1" → "deferred to a future release" (v1.1 shipped).
- Removed "planned for v1.1" references in README config section.

---

## Current File State Summary

### Public Docs (visitors / users / influencers)

| File | Status | Notes |
|------|--------|-------|
| `README.md` | Updated | Removed stale paths, added TROUBLESHOOTING + RELEASE_NOTES + CHANGELOG to index |
| `CHANGELOG.md` | New | Standalone version history |

### User Docs (`docs/`)

| File | Status | Notes |
|------|--------|-------|
| `docs/INSTALL.md` | Updated | pip install instructions, skill manual install, troubleshooting extracted to separate file |
| `docs/USAGE.md` | Updated | pip install instructions, `python -m cronalytics.cli` fallback |
| `docs/UNINSTALL.md` | Updated | pip uninstall step added, stale gateway restart ref removed |
| `docs/TROUBLESHOOTING.md` | New | All common issues + new "CLI Not Found" section |
| `docs/RELEASE_NOTES.md` | New | v1.1.0 narrative release notes |

### Developer Docs (`dev/`)

| File | Status | Notes |
|------|--------|-------|
| `dev/DESIGN.md` | Updated | "standalone CLI" → "terminal CLI", file layout updated, terminology fixed |
| `dev/FEATURES.md` | Updated | Version 1.1.0, 149 tests, shared flags, focus trap wording |
| `dev/DEV_SETUP.md` | Rewritten | No symlink advocacy, aligned with official install |
| `dev/BRIEF.md` | Unchanged | Already aligned |

### Skill

| File | Status | Notes |
|------|--------|-------|
| `skills/devops/cronalytics/SKILL.md` | Updated | CLI invocation paths fixed, pip install added as option |

### Code Assets (v1.1.0 locked, only alignment fixes)

| File | Status | Notes |
|------|--------|-------|
| `cronalytics/cli.py` docstring | Updated | Usage examples now show `cronalytics` command, not old flat path |
| `dashboard/manifest.json` | Fixed | Version `0.1.0` → `1.1.0` |
| `.gitignore` | Fixed | Duplicate `CHECKPOINT.md` removed |

---

## Remaining Known Mismatches (Minor)

1. **`plugin.yaml` version:** `1.1.0 (a58b0e9)` — commit hash is `a58b0e9` but actual tip is `509cb38`. This is intentional per prior decision: hash mismatch signals "old vs new" to users. Acceptable.
2. **`dashboard/plugin_api.py`:** Hardcodes `"version": "1.1.0"` — consistent with manifest and pyproject.toml. No mismatch.
3. **`pyproject.toml`:** `version = "1.1.0"` — consistent.
4. **`uv.lock`:** Contains `version = "1.0.0"` for the self-referential cronalytics entry. This is a uv artifact that updates on next `uv sync`; not user-facing.

---

## What's Next (for user review tonight)

- Read all updated docs for tone consistency and factual accuracy.
- Decide if anything needs tightening before Tuesday release.
- Final UAT repo verification (currently on hold; repo reset to `81aced7` baseline).

---

## Key Decisions Still in Force

- **CLI is an add-on, not standalone.**
- **Editable pip install preferred:** `pip install -e ~/.hermes/plugins/cronalytics`.
- **Skill must be installed manually** — plugin does not auto-link.
- **No direct master commits** — merge `feat/cli-terminal-access` into master on release day, tag `v1.1.0`, push.
- **UAT repo** (`8bit64k/cronalytics-uat`) preserves pre-upgrade baseline at `81aced7` for final verification.

---

*Plugin path: `~/.hermes/plugins/cronalytics/`*  
*Fact DB: `~/.hermes/plugins/cronalytics/facts.db`*  
*API base: `/api/plugins/cronalytics/`*
