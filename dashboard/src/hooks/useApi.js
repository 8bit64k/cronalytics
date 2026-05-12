import { useState, useEffect } from "../lib/sdk.js";
import { validatorForPath } from "../lib/validate.js";

// ---------------------------------------------------------------------------
// JSDoc type definitions — mirrored from the Pydantic/FastAPI backend
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ApiState
 * @property {any} data - Response payload (endpoint-specific shape)
 * @property {boolean} loading - Whether a request is in-flight
 * @property {string|null} error - Error message, or null on success
 * @property {() => void} refetch - Trigger a reload with identical path
 */

/**
 * @typedef {Object} SummaryResponse
 * @property {number} total_runs
 * @property {number} total_estimated_cost
 * @property {number} total_actual_cost
 * @property {number} total_tokens
 * @property {number} total_input_tokens
 * @property {number} total_output_tokens
 * @property {number} [total_cache_read_tokens]
 * @property {number} success_runs
 * @property {number} failure_runs
 * @property {number} [failure_cost]
 * @property {number} [nominal_monthly_total]
 * @property {number} [trend_monthly_total]
 * @property {number} [pace]
 * @property {number} [script_jobs_in_window]
 * @property {{ runs?: number, cost?: number }} [previous_period]
 */

/**
 * @typedef {Object} JobAggregate
 * @property {string} job_id
 * @property {string} [name]
 * @property {number} runs
 * @property {number} total_cost
 * @property {number} [avg_cost]
 * @property {number} [total_tokens]
 * @property {number} [total_duration]
 * @property {number} [avg_duration]
 * @property {Object} [projections]
 * @property {string} [schedule]
 * @property {string} [job_mode]
 */

/**
 * @typedef {Object} JobsResponse
 * @property {number} days
 * @property {JobAggregate[]} jobs
 */

/**
 * @typedef {Object} RunRecord
 * @property {string} session_id
 * @property {number} run_time
 * @property {number} estimated_cost_usd
 * @property {number} [duration_seconds]
 * @property {boolean} [success]
 * @property {string} [model]
 * @property {number} [input_tokens]
 * @property {number} [output_tokens]
 * @property {number} [cache_read_tokens]
 */

/**
 * @typedef {Object} JobRunsResponse
 * @property {string} job_id
 * @property {number} limit
 * @property {number} days
 * @property {string} outcome
 * @property {string} sort_key
 * @property {string} sort_dir
 * @property {RunRecord[]} runs
 */

/**
 * @typedef {Object} ModelAggregate
 * @property {string} model
 * @property {number} runs
 * @property {number} total_cost
 */

/**
 * @typedef {Object} ModelsResponse
 * @property {number} days
 * @property {ModelAggregate[]} models
 */

/**
 * @typedef {Object} TrendPoint
 * @property {string} day
 * @property {number} cost
 * @property {number} runs
 */

/**
 * @typedef {Object} TrendsResponse
 * @property {number} days
 * @property {TrendPoint[]} trend
 */

/**
 * @typedef {Object} HealthResponse
 * @property {string} plugin
 * @property {string} status
 * @property {Object} fact_db
 * @property {Object} sync
 * @property {string} version
 */

/**
 * @typedef {Object} SyncResponse
 * @property {boolean} synced
 * @property {Object} result
 */

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from a Cronalytics API endpoint with lightweight runtime
 * validation and cancellation safety.
 *
 * @param {string} path - API path (e.g. "/api/plugins/cronalytics/summary?days=30")
 * @returns {ApiState}
 */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Ingest fetchJSON from the SDK global at call time to avoid stale closure
    const { fetchJSON } = window.__HERMES_PLUGIN_SDK__;
    fetchJSON(path)
      .then((d) => {
        if (!cancelled) {
          const validate = validatorForPath(path);
          if (validate) {
            try {
              validate(d);
            } catch (e) {
              // Runtime validations log to console; never block rendering
            }
          }
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, reload]);

  return { data, loading, error, refetch: () => setReload((r) => r + 1) };
}

/**
 * Simple modal state toggle.
 *
 * @returns {{ isOpen: boolean, open: () => void, close: () => void }}
 */
export function useModal() {
  const [isOpen, setOpen] = useState(false);
  const open = () => setOpen(true);
  const close = () => setOpen(false);
  return { isOpen, open, close };
}
