#!/usr/bin/env bash
# Run cronalytics tests standalone, bypassing pytest package discovery.
#
# The plugin directory name "cronalytics" contains a hyphen, which makes
# it an invalid Python package name. pytest tries to import __init__.py as
# a package root and fails on relative imports.
#
# This script runs tests via importlib, matching how the dashboard server
# loads plugin modules.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Running cronalytics tests..."
echo "Plugin root: $PLUGIN_ROOT"

cd "$PLUGIN_ROOT"

# Run test_parser.py directly with Python, loading facts.py via importlib
python3 -c "
import importlib.util
import sys
from pathlib import Path

# Load facts.py dynamically (same pattern as dashboard server)
spec = importlib.util.spec_from_file_location('test_facts', Path('$PLUGIN_ROOT') / 'facts.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
_make_job_id = mod._make_job_id

tests = [
    ('cron_841aee933270_20260429_222224', '841aee933270', 'simple id'),
    ('cron_daily_backup_v2_20260430_120000', 'daily_backup_v2', 'id with underscore'),
    ('cron_a_b_c_d_20260430_120000', 'a_b_c_d', 'multiple underscores'),
    ('cron_abc_20260430', None, 'too few segments'),
    ('cron_abc_20260430_120000', 'abc', 'exactly four segments'),
    ('cli_abc123_20260430_120000', None, 'non-cron prefix'),
    ('', None, 'empty string'),
    ('cron_', None, 'cron only'),
    ('cron_x_20260430_000001', 'x', 'single digit id'),
    ('cron_550e8400-e29b-41d4-a716-446655440000_20260430_120000', '550e8400-e29b-41d4-a716-446655440000', 'uuid style'),
]

passed = 0
failed = 0
for session_id, expected, name in tests:
    result = _make_job_id(session_id)
    if result == expected:
        passed += 1
        print(f'  PASS: {name}')
    else:
        failed += 1
        print(f'  FAIL: {name} — expected {expected!r}, got {result!r}')

print(f'\nResults: {passed} passed, {failed} failed')
sys.exit(1 if failed > 0 else 0)
"

echo "Done."
