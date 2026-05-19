# Cronalytics Data Model Reference

Canonical field names and schema for programmatic queries against the
Cronalytics CLI JSON envelopes and the underlying SQLite `facts.db`.

## JSON Envelope: `cronalytics jobs --json`

The `data` array contains job-aggregate objects with these exact keys:

| JSON Key | Type | Meaning | Table Header |
|----------|------|---------|--------------|
| `job_id` | string | Unique job identifier | `Job ID` |
| `job_name` | string \| null | Human-readable name | `Job` |
| `job_mode` | string | `'agent'` or `'no_agent'` | `[N]` badge when `'no_agent'` |
| `runs` | int | Total runs in window | `Runs` |
| `success_runs` | int | Successful runs | — |
| `failure_runs` | int | Failed runs | — |
| `total_cost` | float | Aggregate estimated cost | `Cost` |
| `avg_cost` | float | Average cost per run | — |
| `success_cost` | float | Cost of successful runs | — |
| `failure_cost` | float | Cost of failed runs | — |
| `total_tokens` | int | Sum of all token types | `Tokens` |
| `total_input_tokens` | int | Input tokens | — |
| `total_output_tokens` | int | Output tokens | — |
| `total_cache_read_tokens` | int | Cache read tokens | — |
| `total_cache_write_tokens` | int | Cache write tokens | — |
| `total_duration` | float | Sum of durations (seconds) | — |
| `avg_duration` | float \| null | Average duration | `Dur` |
| `last_run` | float \| null | Unix timestamp of last run | — |
| `first_run` | float | Unix timestamp of first run | — |
| `last_model` | string \| null | Last model used | — |
| `schedule_display` | string \| null | Human schedule string | — |
| `next_run_at` | float \| null | Next scheduled run | — |
| `pace` | float \| null | Cost-to-schedule ratio | `Pace` |
| `drift_ratio` | float \| null | Schedule drift metric | — |
| `observed_window_days` | float | Days actually observed | — |
| `scheduled_runs_30d` | int | Expected runs in 30d | — |
| `scheduled_runs_90d` | int | Expected runs in 90d | — |
| `scheduled_runs_1yr` | int | Expected runs in 1yr | — |
| `projected_cost_30d` | float | Projected 30-day cost | — |
| `projected_cost_90d` | float | Projected 90-day cost | — |
| `projected_cost_1yr` | float | Projected 1-year cost | — |
| `trend_projected_cost_*` | float | Trend-based projections | — |

**Critical pitfall:** The rendered table headers (`Name`, `Fail`, `Cost`)
are NOT the JSON keys. The first attempt in testing used `name`, `success`,
`failure`, `cost` and produced all-zero output because the real keys are
`job_name`, `success_runs`, `failure_runs`, `total_cost`. Always verify with
`data[0].keys()` before writing aggregation scripts.

## JSON Envelope: `cronalytics runs --job <id> --json`

The `data` array contains individual run objects. Cost is **not present**
at the run level (`cost: null` for every row). Use `jobs --json` for cost
aggregates, or query SQLite directly.

## SQLite Schema: `facts.db` table `cron_runs`

```sql
CREATE TABLE cron_runs (
    session_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    run_time REAL NOT NULL,
    ended_at REAL,
    duration_seconds REAL,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL,
    actual_cost_usd REAL,
    cost_status TEXT,
    cost_source TEXT,
    billing_provider TEXT,
    api_call_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    end_reason TEXT,
    success BOOLEAN,
    job_mode TEXT DEFAULT 'agent',
    ingested_at REAL DEFAULT (unixepoch())
);
```

Key columns for diagnostics:
- `success` — `0` = failure, `1` = success
- `estimated_cost_usd` — the column to aggregate for cost analysis
- `end_reason` — failure taxonomy strings:
  - `timeout`
  - `model_unavailable`
  - `gateway_restart`
  - `error`
  - `rate_limited`
  - `script_not_found`
- `job_mode` — `'agent'` or `'no_agent'` (script job)

### Ready-to-Paste SQL Patterns

**Daily failure cartography:**
```sql
SELECT
    DATE(run_time, 'unixepoch') as day,
    COUNT(*) as total_runs,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fails,
    COUNT(DISTINCT CASE WHEN success = 0 THEN job_id END) as failing_jobs,
    SUM(CASE WHEN success = 0 THEN estimated_cost_usd ELSE 0 END) as fail_cost
FROM cron_runs
GROUP BY day
ORDER BY day;
```

**Silent run detection (success=1, 0 tokens):**
```sql
SELECT
    job_id,
    COUNT(*) as silent_runs,
    MIN(DATE(run_time, 'unixepoch')) as first,
    MAX(DATE(run_time, 'unixepoch')) as last
FROM cron_runs
WHERE success = 1
  AND (input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) = 0
GROUP BY job_id
ORDER BY silent_runs DESC;
```

**Failure end-reason breakdown for a specific job:**
```sql
SELECT
    end_reason,
    COUNT(*) as cnt
FROM cron_runs
WHERE success = 0 AND job_id = '<job_id>'
GROUP BY end_reason
ORDER BY cnt DESC;
```

**Concentration: jobs accounting for 80% of failures:**
```sql
WITH ranked AS (
    SELECT
        job_id,
        COUNT(*) as fails,
        SUM(COUNT(*)) OVER () as total_fails,
        SUM(COUNT(*)) OVER (ORDER BY COUNT(*) DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative
    FROM cron_runs
    WHERE success = 0
    GROUP BY job_id
)
SELECT COUNT(*) as jobs_for_80_pct
FROM ranked
WHERE cumulative <= total_fails * 0.80;
```

**Recent 30-day vs previous 30-day failure rate:**
```sql
SELECT
    SUM(CASE WHEN run_time >= (SELECT MAX(run_time) - 2592000 FROM cron_runs) THEN 1 ELSE 0 END) as recent_total,
    SUM(CASE WHEN run_time >= (SELECT MAX(run_time) - 2592000 FROM cron_runs) AND success = 0 THEN 1 ELSE 0 END) as recent_fails,
    SUM(CASE WHEN run_time <  (SELECT MAX(run_time) - 2592000 FROM cron_runs) AND run_time >= (SELECT MAX(run_time) - 5184000 FROM cron_runs) THEN 1 ELSE 0 END) as prev_total,
    SUM(CASE WHEN run_time <  (SELECT MAX(run_time) - 2592000 FROM cron_runs) AND run_time >= (SELECT MAX(run_time) - 5184000 FROM cron_runs) AND success = 0 THEN 1 ELSE 0 END) as prev_fails
FROM cron_runs;
```

## Cross-Reference: `jobs.json` fields

Path: `~/.hermes/cron/jobs.json`. Structure: `{"jobs": [...], "updated_at": "..."}`.

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Same as `job_id` in cronalytics |
| `name` | string | Same as `job_name` |
| `no_agent` | boolean | `true` = script job. Maps to `job_mode` = `"no_agent"` in cronalytics JSON |
| `script` | string \| null | File path or inline command |
| `schedule` | object \| null | `{"kind": "cron" | "interval", ...}` |
| `schedule_display` | string \| null | Human schedule string |
| `enabled` | boolean | Active in scheduler? |
| `state` | string | e.g. `"paused"`, `"active"` |
| `last_status` | string \| null | Scheduler-side status |
| `last_error` | string \| null | Scheduler-side error string |
| `created_at` | string | ISO timestamp |
| `last_run_at` | string \| null | ISO timestamp |

**Pitfall:** Orphan jobs exist in `cron_runs` (fact DB) but not in
`jobs.json`. Always cross-check `jobs.json` when a `job_id` from cronalytics
has `last_status` = `null` and `last_error` = `null` — it may be a zombie
job deleted from config but still firing.
