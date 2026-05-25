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

## How to Contribute

1. **Fork the repo** and clone your fork.
2. **Create a branch** — `feature/my-feature` or `fix/bug-description`.
3. **Make your changes.** Keep commits focused and atomic.
4. **Run the test suite:** `python -m pytest tests/ -v --tb=short`
5. **Lint and type check:** `ruff check . && mypy cronalytics/ dashboard/plugin_api.py`
6. **Build the dashboard:** `cd dashboard && node build.js`
7. **Open a pull request** against `master` (or `release/X.Y` for hotfixes).

## Pull Requests

- All changes to `master` and `release/*` branches require PR review.
- `release/*` branches require at least 1 approving review.
- Keep commits focused and atomic. Squash fixups before merge if the branch is noisy.
- Use the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) — it gives reviewers the context they need.

## Reporting Bugs

Please use the [Bug Report](https://github.com/8bit64k/cronalytics/issues/new?template=bug_report.md) template. A good bug report includes:

- What you did (exact steps or commands)
- What you expected to happen
- What actually happened (error message, incorrect output)
- Your environment (Cronalytics version, Hermes version, OS, browser)

The more specific you are, the faster we can reproduce and fix it.

## Feature Requests

Use the [Feature Request](https://github.com/8bit64k/cronalytics/issues/new?template=feature_request.md) template. Tell us the problem you're trying to solve, not just the solution you want. Context helps us find the right fix.

## Development Environment

See [`dev/DEV_SETUP.md`](dev/DEV_SETUP.md) for build, test, and plugin setup instructions.

## Code Review

Reviewers will check for:

- Tests pass and cover the change
- Docs reflect new or changed behavior
- Lint and type checks are clean
- The change follows existing patterns and conventions in the codebase

If your PR is large, open it as a draft and ask for early feedback. Small, incremental PRs review faster and merge sooner.