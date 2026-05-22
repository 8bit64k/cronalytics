# Silent Failure Detection Worksheet for Cronalytics

Quick-reference decision tree for when cronalytics reports 100% success
but jobs look suspicious. Use this when the user says "I think my jobs
are wasting tokens" or when Step 4 (`--outcome failure`) returns empty.

---

## Detection Flowchart

```
Are there no_agent jobs with total_tokens == 0?
├── YES  → Cross-check jobs.json last_status / last_error
│          ├── last_status == "error"
│          │   └── Inline shell treated as filename
│          │       FIX: Create real script file, update jobs.json path
│          ├── last_status == "ok", last_error == null
│          │   └── Script exit 0 with no output
│          │       FIX: Review script; add `set -euo pipefail`
│          └── last_model == "unknown", avg_duration == null
│                └── Confirmed hollow run — scheduler recorded success
│                    but nothing executed
│
└── NO   → Check agent jobs for context creep / double-fires
```

---

## Field Mapping Between Surfaces

| What you need | cronalytics --json | jobs.json |
|---|---|---|
| Did it burn tokens? | `total_tokens`, `tot_estimated_cost` | N/A |
| Did it actually run? | `avg_duration` (null = hollow) | N/A |
| What did the scheduler say? | `success_runs` / `failure_runs` | `last_status` |
| Exact error string? | Not stored | `last_error` |
| Job age vs. window? | `observed_window_days` | `created_at` |
| Is it a script job? | `job_mode == "no_agent"` | `no_agent == true` |

---

## Detection Signatures

Signature for **inline shell treated as filename** (the most common silent failure):

| Signal | Value |
|---|---|
| `job_mode` | `"no_agent"` |
| `total_tokens` | `0` |
| `avg_duration` | `null` |
| `last_model` | `"unknown"` |
| `success_runs` | > 0 |
| `failure_runs` | `0` |
| `jobs.json` `last_status` | `"error"` |
| `jobs.json` `last_error` | Starts with `"Script not found: ..."` |

---

## One-Liner: Surface All Hollow Jobs

```bash
cronalytics jobs --days 30 --mode no_agent --json | \
  jq '.data[] | select(.total_tokens == 0 and .success_runs > 0) | {job_id, runs: .success_runs, name_hint: .job_id}'
```

Then for each, run:
```bash
cat ~/.hermes/cron/jobs.json | jq '.jobs[] | select(.id == "<job_id>") | {name, script, last_status, last_error}'
```

---

## Why jobs.json Matters

cronalytics `facts.db` and the scheduler's `jobs.json` are two independent
views. Never trust one alone when tokens are missing.

- `facts.db` = historical, aggregated, cost-weighted. Good for trends.
- `jobs.json` = current config, last attempt only. Good for ground-truth errors.

When they disagree (facts says "success", jobs.json says "error"),
`jobs.json` wins. The scheduler attempted the job and failed before
any tokens were consumed.
