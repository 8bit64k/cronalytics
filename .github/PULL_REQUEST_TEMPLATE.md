## Description

What does this PR do? Link the issue it fixes (e.g., `Fixes #123`).

## Type of change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature that would break existing behavior)
- [ ] Documentation update
- [ ] Chore (build, CI, tooling, cleanup)

## Checklist

- [ ] I have read [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Tests pass: `python -m pytest tests/ -v --tb=short`
- [ ] Lint clean: `ruff check .`
- [ ] Type check clean: `mypy cronalytics/ dashboard/plugin_api.py`
- [ ] Dashboard builds: `cd dashboard && node build.js`
- [ ] Docs updated (if applicable): `docs/` or `dev/` files reflect the change
- [ ] `CHECKPOINT.md` updated with decisions and verification notes (rebase will drop it)
- [ ] I am targeting `master` (or `release/X.Y` for hotfixes)