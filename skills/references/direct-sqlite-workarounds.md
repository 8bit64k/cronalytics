# Direct SQLite Workarounds — When the CLI Falls Short

The cronalytics CLI is the primary interface, but some analyses require joins,
window functions, or custom aggregations the CLI does not expose. Use these
SQL recipes when the CLI surface is insufficient.

## Full Chronological Run List

When you need every field for a job, not just the columns the CLI JSON exposes:

```sql
SELECT run_time, ended_at, duration_seconds, model,
       input_tokens, output_tokens, reasoning_tokens,
       cache_read_tokens, cache_write_tokens,
       estimated_cost_usd, actual_cost_usd, end_reason, success
FROM cron_runs
WHERE job_id = '<id>'
ORDER BY run_time;
```

## Compute True Failure Rates (Do Not Use `--outcome failure` on `jobs`)

The `--outcome` filter pre-filters runs before aggregation. `jobs --outcome failure`
produces a dataset with only failures, so `success_runs` is always 0. This is
intended behavior, not a bug. Compute rates from unfiltered output instead:

```python
# Python post-processing of `cronalytics jobs --days 0 --json`
for job in data['data']:
    fail_rate = job['failure_runs'] / job['runs'] if job['runs'] > 0 else 0
    if fail_rate > 0.5 and job['runs'] > 50:
        print(f"{job['job_name']}: {fail_rate*100:.1f}% fail ({job['failure_runs']}/{job['runs']})")
```

Only use `--outcome failure` on the `runs` subcommand (per-job drill-down), never
on the `jobs` subcommand.

## Context Creep Analysis via SQLite

When the `runs` cap prevents chronological token analysis, use this query to
compute early-vs-late token averages:

```sql
WITH ordered AS (
  SELECT input_tokens, estimated_cost_usd, duration_seconds,
         ROW_NUMBER() OVER (ORDER BY run_time) as rn,
         COUNT(*) OVER () as total
  FROM cron_runs
  WHERE job_id = '<id>'
)
SELECT
  AVG(CASE WHEN rn <= total * 0.1 THEN input_tokens END) as early_avg,
  AVG(CASE WHEN rn >= total * 0.9 THEN input_tokens END) as late_avg,
  AVG(CASE WHEN rn <= total * 0.1 THEN estimated_cost_usd END) as early_cost,
  AVG(CASE WHEN rn >= total * 0.9 THEN estimated_cost_usd END) as late_cost
FROM ordered;
```

**Interpretation:** `late_avg / early_avg` > 2× is strong context creep.
>5× is runaway bloat requiring immediate cap/remediation.

## Double-Fire Detection via SQLite

```sql
WITH gaps AS (
  SELECT run_time,
         LAG(run_time) OVER (ORDER BY run_time) as prev_run_time
  FROM cron_runs
  WHERE job_id = '<id>'
)
SELECT COUNT(*) as double_fires
FROM gaps
WHERE run_time - prev_run_time < 21600;  -- 6 hours
```

If double_fires > 10% of total runs, the job fires faster than it can finish
or is being manually triggered.

## Daily Cost Slope (Cost Acceleration)

```sql
SELECT date(run_time, 'unixepoch') as day,
       SUM(estimated_cost_usd) as cost,
       COUNT(*) as runs
FROM cron_runs
WHERE job_id = '<id>'
GROUP BY day
ORDER BY day;
```

Pipe the output into a linear regression (Python/jq) to compute slope.
Positive slope = accelerating spend (unbounded growth signal).

## Orphan Job Detection

Find job IDs present in `cron_runs` but absent from `jobs.json`:

```sql
SELECT DISTINCT job_id
FROM cron_runs
WHERE job_id NOT IN (
  SELECT json_extract(value, '$.id')
  FROM json_each(readfile('~/.hermes/cron/jobs.json'), '$.jobs')
);
```

Note: SQLite does not have `readfile()` natively. Use the Python sqlite3
module or a shell pipeline instead:

```bash
python3 -c "
import json, sqlite3
db = sqlite3.connect('/home/nick/.hermes/plugins/cronalytics/facts.db')
with open('/home/nick/.hermes/cron/jobs.json') as f:
    jobs = {j['id'] for j in json.load(f)['jobs']}
c = db.cursor()
c.execute('SELECT DISTINCT job_id FROM cron_runs')
orphans = [r[0] for r in c.fetchall() if r[0] not in jobs]
print(f'Orphans: {len(orphans)}')
for o in orphans:
    print(f'  {o}')
"
```
