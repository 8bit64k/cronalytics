# Contributing to Cronalytics

## Branching Model

- **`master`** — Active development for the next minor/major release.
- **`release/X.Y`** — Stable line for version X.Y. Hotfixes only.
- **`feature/*` or `fix/*`** — Branch from `master`, PR back to `master`.

### Critical bugs in released versions

1. Branch from `release/X.Y`
2. PR back to `release/X.Y`
3. Tag the release (e.g., `v1.0.1`)
4. Merge or cherry-pick the fix into `master` so it doesn't regress in the next release

## Pull Requests

- All changes to `master` and `release/*` branches require PR review.
- `release/*` branches require at least 1 approving review.
- Keep commits focused and atomic. Squash fixups before merge if the branch is noisy.
