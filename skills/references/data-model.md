# Data Model: cron_runs

The `cron_runs` table is the canonical store for all ingested cron activity.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `session_id` | TEXT | (PK) | Unique session ID (e.g. cron_job_date_time) |
| `job_id` | TEXT | NOT NULL | The ID of the cron job |
| `run_time` | REAL | NOT NULL | Unix timestamp of run start |
| `ended_at` | REAL | NULL | Unix timestamp of run end |
| `duration_seconds` | REAL | NULL | Difference between ended and started |
| `model` | TEXT | NULL | Model name used (e.g. gpt-4o) |
| `input_tokens` | INTEGER | 0 | Count of input tokens |
| `output_tokens` | INTEGER | 0 | Count of output tokens |
| `reasoning_tokens` | INTEGER | 0 | Count of reasoning tokens (O1 support) |
| `cache_read_tokens` | INTEGER | 0 | Count of tokens read from cache |
| `cache_write_tokens`| INTEGER | 0 | Count of tokens written to cache |
| `estimated_cost_usd`| REAL | NULL | Calculated cost based on pricing metadata |
| `actual_cost_usd` | REAL | NULL | Actual billed cost (if available) |
| `cache_write_tokens`| INTEGER | 0 | Count of tokens written to cache |
| `estimated_cost_usd`| REAL    | NULL | Calculated cost based on pricing metadata |
| `actual_cost_usd`   | REAL    | NULL | Actual billed cost (if available) |
| `cost_status`       | TEXT    | NULL | Status of cost calculation (e.g., 'verified') |
| `cost_source`       | TEXT    | NULL | Source of pricing data (e.g., 'provider_api') |
| `billing_provider`  | TEXT    | NULL | Provider for cost reference |
| `api_call_count`    | INTEGER | 0 | Total API requests in session |
| `message_count`     | INTEGER | 0 | Total messages sent/received |
| `tool_call_count`   | INTEGER | 0 | Total tool calls executed |
| `end_reason`        | TEXT    | NULL | Hermes exit state |
| `success`           | BOOLEAN | NULL | 1 if completed, 0 if failed |
| `job_mode`          | TEXT    | 'agent' | 'agent' or 'no_agent' |
| `ingested_at`       | REAL    | (unixepoch) | Timestamp of fact ingestion |

## Indices
## Indices
- `idx_cron_runs_job_id` on `job_id`
- `idx_cron_runs_run_time` on `run_time DESC`
- `idx_cron_runs_ingested` on `ingested_at`
- `idx_cron_runs_job_mode` on `job_mode`
