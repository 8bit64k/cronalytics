# jq Diagnostic Patterns for Cronalytics

Reference: common `jq` post-processing pipelines when `cronalytics --json` output is too noisy for direct reading.

## Per-Job Chronological Runs (Context Creep Detection)

Sort by `run_time` ascending to see token growth over time:

```bash
cronalytics runs --job <job_id> --days 30 --json | \
  jq '.data | sort_by(.run_time) | .[] | {run_time, input_tokens, output_tokens, model, success, duration_seconds}'
```

Spotting context creep: look for steadily climbing `input_tokens` across successive dates. Baseline ~30K → recent ~800K is a 20× creep flag.

## Top-N Token Consumers Per Job

Sort by `input_tokens` descending, take the worst 5:

```bash
cronalytics runs --job <job_id> --days 30 --json | \
  jq '.data | sort_by(.input_tokens) | .[-5:][] | {run_time, input_tokens, output_tokens, model, success, duration_seconds}'
```

Use for: identifying the exact runs that spiked cost/duration in a job with high variance.

## Clean `jobs.json` Cross-Reference

Human-readable snapshot of current scheduler state, filtered to fields that matter for failure analysis:

```bash
cat ~/.hermes/cron/jobs.json | \
  jq '{jobs: [.jobs[] | {id, name, no_agent, script, last_status, last_error, created_at: (.created_at // null), schedule}], updated_at}'
```

Key fields to eyeball when silent failures are suspected:
- `last_status`: `"ok"` vs `"error"`
- `last_error`: often `"Script not found: /home/nick/.hermes/scripts/..."` for inline shell commands misinterpreted as file paths
- `no_agent`: `true` → script job, higher silent-failure surface
- `created_at`: to verify job age vs. the `--days` filter window (pace interpretation)

## Quick Run Count Per Job

```bash
cronalytics runs --job <job_id> --days 30 --json | jq '.data | length'
```

Use to verify whether a job with suspiciously low pace actually fired during the window.

## Isolating no_agent Hollow Runs

If you already suspect a specific job is silently failing (0 tokens, null model):

```bash
cronalytics runs --job <job_id> --days 30 --json | \
  jq '.data | .[] | select(.input_tokens == 0 and .model == null) | {run_time, success, job_mode}'
```

All rows should be empty for a healthy no_agent job. If any appear, cross-check `jobs.json` immediately.
