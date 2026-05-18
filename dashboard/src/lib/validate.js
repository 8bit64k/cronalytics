/**
 * Lightweight runtime validation for Cronalytics API responses.
 *
 * Runs in development only. In the browser (no `process.env`) it defaults
 * to silent — gate with `typeof process !== "undefined"` check.
 *
 * @module validate
 */

const IS_DEV = (() => {
  try {
    return typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();

/**
 * Assert that `value` matches an expected primitive type or constructor.
 *
 * @param {string} endpoint - API endpoint path (for error messages)
 * @param {any} value - The value to inspect
 * @param {string|Function} expected - "string", "number", "boolean", "object", "array", Array, Object, etc.
 * @param {string} [path="root"] - JSON-path string for pinpointing failures
 */
function assertType(endpoint, value, expected, path = "root") {
  if (!IS_DEV) return;
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  let ok;
  if (expected === Array) ok = Array.isArray(value);
  else if (expected === Object) ok = value !== null && typeof value === "object" && !Array.isArray(value);
  else if (expected === "null") ok = value === null;
  else ok = actual === expected;
  if (!ok) {
    console.error(
      `[Cronalytics API] ${endpoint}: expected ${path} to be ${expected.name || expected}, got ${actual}`
    );
  }
}

// ---------------------------------------------------------------------------
// Per-endpoint validators
// ---------------------------------------------------------------------------

/**
 * @param {any} d
 */
export function validateHealth(d) {
  assertType("/health", d, Object);
  assertType("/health", d.plugin, "string", "plugin");
  assertType("/health", d.status, "string", "status");
  assertType("/health", d.fact_db, Object, "fact_db");
  assertType("/health", d.sync, Object, "sync");
  assertType("/health", d.version, "string", "version");
}

/**
 * @param {any} d
 */
export function validateSync(d) {
  assertType("/sync", d, Object);
  assertType("/sync", d.synced, "boolean", "synced");
  assertType("/sync", d.result, Object, "result");
}

/**
 * @param {any} d
 */
export function validateSummary(d) {
  assertType("/summary", d, Object);
  assertType("/summary", d.total_runs, "number", "total_runs");
  assertType("/summary", d.total_estimated_cost, "number", "total_estimated_cost");
  assertType("/summary", d.total_tokens, "number", "total_tokens");
  assertType("/summary", d.success_runs, "number", "success_runs");
  assertType("/summary", d.failure_runs, "number", "failure_runs");
  assertType("/summary", d.previous_period, "object", "previous_period");
}

/**
 * @param {any} d
 */
export function validateJobs(d) {
  assertType("/jobs", d, Object);
  assertType("/jobs", d.days, "number", "days");
  assertType("/jobs", d.jobs, Array, "jobs");
  if (IS_DEV && Array.isArray(d.jobs)) {
    d.jobs.forEach((j, i) => {
      assertType("/jobs", j.job_id, "string", `jobs[${i}].job_id`);
      assertType("/jobs", j.runs, "number", `jobs[${i}].runs`);
      assertType("/jobs", j.total_cost, "number", `jobs[${i}].total_cost`);
      assertType("/jobs", j.projections, "object", `jobs[${i}].projections`);
    });
  }
}

/**
 * @param {any} d
 */
export function validateJobRuns(d) {
  assertType("/jobs/:id/runs", d, Object);
  assertType("/jobs/:id/runs", d.job_id, "string", "job_id");
  assertType("/jobs/:id/runs", d.limit, "number", "limit");
  assertType("/jobs/:id/runs", d.runs, Array, "runs");
  if (d.total_runs != null) {
    assertType("/jobs/:id/runs", d.total_runs, "number", "total_runs");
  }
  if (d.more_available != null) {
    assertType("/jobs/:id/runs", d.more_available, "boolean", "more_available");
  }
  if (IS_DEV && Array.isArray(d.runs)) {
    d.runs.forEach((r, i) => {
      assertType("/jobs/:id/runs", r.session_id, "string", `runs[${i}].session_id`);
      assertType("/jobs/:id/runs", r.run_time, "number", `runs[${i}].run_time`);
      assertType("/jobs/:id/runs", r.estimated_cost_usd, "number", `runs[${i}].estimated_cost_usd`);
    });
  }
}

/**
 * @param {any} d
 */
export function validateModels(d) {
  assertType("/models", d, Object);
  assertType("/models", d.models, Array, "models");
  if (IS_DEV && Array.isArray(d.models)) {
    d.models.forEach((m, i) => {
      assertType("/models", m.model, "string", `models[${i}].model`);
      assertType("/models", m.runs, "number", `models[${i}].runs`);
      assertType("/models", m.total_cost, "number", `models[${i}].total_cost`);
    });
  }
}

/**
 * @param {any} d
 */
export function validateTrends(d) {
  assertType("/trends", d, Object);
  assertType("/trends", d.trend, Array, "trend");
  if (IS_DEV && Array.isArray(d.trend)) {
    d.trend.forEach((t, i) => {
      assertType("/trends", t.day, "string", `trend[${i}].day`);
      assertType("/trends", t.cost, "number", `trend[${i}].cost`);
      assertType("/trends", t.runs, "number", `trend[${i}].runs`);
    });
  }
}

/**
 * Pick the right validator given an API path.
 *
 * @param {string} path - e.g. "/api/plugins/cronalytics/summary?days=30"
 * @returns {(data: any) => void}|undefined
 */
export function validatorForPath(path) {
  if (path.includes("/health")) return validateHealth;
  if (path.includes("/sync")) return validateSync;
  if (path.includes("/summary")) return validateSummary;
  if (path.includes("/jobs/") && path.includes("/runs")) return validateJobRuns;
  if (path.includes("/jobs")) return validateJobs;
  if (path.includes("/models")) return validateModels;
  if (path.includes("/trends")) return validateTrends;
  return undefined;
}
