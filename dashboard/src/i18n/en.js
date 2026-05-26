/**
 * Cronalytics English catalog — source of truth for all user-facing strings.
 *
 * Organized by namespace matching component names for discoverability.
 */

import { registerCatalog } from "./index.js";

registerCatalog("en", {
  // HeroBanner — the greeting
  hero: {
    title: "CRONALYTICS",
    tagline: "Observe. Measure. Optimize.",
    pronunciation: "/ˈkrɒn.əˌlɪt.ɪks/",
    noun: "(noun)",
    definition_1: "1. Cron analytics and observability.",
    definition_2: "2. The dashboard for agentic automations in Hermes.",
    expand_tooltip: "Expand hero banner",
    collapse_tooltip: "Collapse hero banner",
  },

  // SummaryBoard — headline stats
  summary: {
    job_runs: "Job Runs",
    cost: "Cost",
    wasted: "Wasted",
    tokens: "Tokens",
    cached: "Cached",
    pace: "Pace",
    trend: "Trend",
    estimated: "Estimated",
    actual: "Actual",
    all_time: "All time",
    last_n_days: "Last {n} days",
    vs_prior: "vs prior",
    period: "period",
    nominal: "Nominal",
    in: "In",
    out: "Out",
    no_schedule: "No schedule",
  },

  // LeaderBoard — top performers
  leaderboard: {
    title: "Leaderboard",
    top_est_cost: "Top Cost",
    top_runs: "Top Runs",
    top_tokens: "Top Tokens",
    top_duration: "Top Time",
    most_efficient: "Top Pace",
    of_total_est_cost: "% of total est cost",
    of_total_runs: "% of total runs",
    of_total_tokens: "% of total tokens",
  },

  // JobBreakdown — per-job table
  job_breakdown: {
    title: "Jobs Breakdown",
    job: "Job",
    runs: "Runs",
    avg_time: "Avg Duration",
    est_cost: "Est Cost",
    avg_est_cost: "Avg Est Cost",
    nominal_mo: "Nominal/mo",
    trend_mo: "Trend/mo",
    pace: "Pace",
    mode_agent: "Agent",
    mode_no_agent: "No agent",
    no_schedule: "No schedule",
    last: "Last",
    using: "using",
    next: "Next",
    see_runs: "See Runs",
    schedule: "Schedule",
    last_run: "Last run",
    no_jobs_window: "No jobs in {window}. Last sync: {time} UTC",
    no_jobs_sync: "No cron jobs captured. Click Sync Now to backfill from state.db.",
    sorted_by: "Sorted by {col}, {dir}",
    sort_by: "Sort by {col}",
    ascending: "ascending",
    descending: "descending",
  },

  // JobDetailView — individual run history
  job_detail: {
    title_runs: "Runs",
    mode: "Mode",
    mode_agent: "Agent",
    duration: "Duration",
    est_cost: "Est Cost",
    loading: "Loading runs...",
    error_prefix: "Error: ",
    for_full_history: " for full history.",
    no_runs: "No runs found.",
    showing: "Showing ",
    of: " of ",
    runs_plural: "runs",
    use_cli: "Use ",
    run: "run",
  },

  // ModelBreakdown — per-model stats
  model_breakdown: {
    title: "Per-Model Breakdown",
    model: "Model",
    runs: "Runs",
    est_cost: "Est Cost",
    and_more: "and {n} more",
  },

  // SparkLine — daily trends
  sparkline: {
    daily_cost: "Daily Est Cost",
    daily_runs: "Daily Runs",
    cost_bar: "\u2014 cost (bar) \u00b7 ",
    tokens_line: "\u2014 tokens",
    duration_line: "- - duration",
  },

  // DaySelector — time window picker
  day_selector: {
    label: "Days",
    apply_custom: "Apply custom days",
    go: "Go",
  },

  // ModeToggle — agent/no_agent/all filter
  mode_toggle: {
    label: "Mode",
    all: "All",
    agent: "Agent",
    no_agent: "No Agent",
  },

  // OutcomeToggle — success/failure/all filter
  outcome_toggle: {
    label: "Outcomes",
    all: "All",
    success: "Success",
    failure: "Failure",
  },

  // ErrorBoundary — crash handler
  error: {
    title: "Cronalytics Error",
    message: "Something went wrong. Please refresh or contact support.",
  },

  // Modal — popup dialog
  modal: {
    close: "Close",
  },

  // Pace modal explainer
  pace: {
    what_this_means: "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019",
    nominal_formula: "Nominal = scheduled runs \u00d7 average cost per run",
    trend_formula: "Trend     = actual runs \u00d7 average cost per run",
    pace_formula: "Pace      = Trend / Nominal",
  },

  // Runs modal explainer
  runs: {
    what_this_means: "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task\u2014whether it succeeds, fails, or retries.",
    trend_formula: "Trend % = ((current runs \u2212 prior runs) / prior runs) \u00d7 100",
    trend_note: "Positive = more runs than the prior window. Negative = fewer runs.",
  },

  // Cost modal explainer
  cost: {
    what_this_means: "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity.",
    trend_formula: "Trend % = ((current cost \u2212 prior cost) / prior cost) \u00d7 100",
  },

  // Tokens modal explainer
  tokens: {
    what_this_means: "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper).",
  },

  // Shared / generic
  shared: {
    loading: "Loading\u2026",
    retry: "Retry",
    show: "Show",
    hide: "Hide",
    refresh: "Refresh",
    sync_now: "Sync Now",
    synced_n_runs: "Synced {n} runs",
    what_this_means: "What this means",
    how_its_calculated: "How it's calculated",
    trend_calculation: "Trend calculation",
    window_context: "Window context",
    showing_window: "Showing ",
    prior_window_note: "The prior comparison window is the same duration shifted back in time.",
    job_details: "Job details",
    color_guide: "Color guide",
    neutral_budget: "Neutral (1.0\u20132.0\u00d7) \u2014 On track. Slight variance within normal range.",
    green_under_budget: "Green (< 1.0\u00d7) \u2014 Under budget. Spending less than scheduled.",
    red_over_budget: "Red (> 2.0\u00d7) \u2014 Over budget. Spending more than scheduled.",
    all_scaled_30d: "All scaled to a 30\u2011day month using the selected window.",
    breakdown: "Breakdown",
  },
});
