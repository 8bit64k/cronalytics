import { React, useState, useEffect, fetchJSON, Button } from "../lib/sdk.js";
import { useApi, useModal } from "../hooks/useApi.js";
import { Modal } from "../components/Modal.js";
import { DaySelector } from "../components/DaySelector.js";
import { OutcomeToggle } from "../components/OutcomeToggle.js";
import { ModeToggle } from "../components/ModeToggle.js";
import { SparkLine } from "../components/SparkLine.js";
import { JobDetailView } from "../components/JobDetailView.js";
import { HeroBanner } from "../components/HeroBanner.js";
import { SummaryBoard } from "../components/SummaryBoard.js";
import { LeaderBoard } from "../components/LeaderBoard.js";
import { ModelBreakdown } from "../components/ModelBreakdown.js";
import { JobBreakdown } from "../components/JobBreakdown.js";
import { fmtCost, fmtTime, fmtCompact, fmtDuration, fmtSyncAge, paceColor } from "../lib/formatters.js";
import { RefreshCwIcon } from "../lib/icons.js";

export function CronalyticsTab() {
  const [days, setDaysRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("cronalytics:days");
      if (saved !== null) return Number(saved);
    } catch {}
    return 30;
  });
  const setDays = (v) => {
    try { localStorage.setItem("cronalytics:days", String(v)); } catch {}
    setDaysRaw(v);
  };
  const [outcome, setOutcomeRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("cronalytics:outcome");
      if (saved) return saved;
    } catch {}
    return "both";
  });
  const setOutcome = (v) => {
    try { localStorage.setItem("cronalytics:outcome", v); } catch {}
    setOutcomeRaw(v);
  };
  const [mode, setModeRaw] = useState(() => {
    try {
      const saved = localStorage.getItem("cronalytics:mode");
      if (saved) return saved;
    } catch {}
    return "all";
  });
  const setMode = (v) => {
    try { localStorage.setItem("cronalytics:mode", v); } catch {}
    setModeRaw(v);
  };
  const summary = useApi("/api/plugins/cronalytics/summary?days=" + days + "&outcome=" + outcome + "&mode=" + mode);
  const jobs = useApi("/api/plugins/cronalytics/jobs?days=" + days + "&outcome=" + outcome + "&mode=" + mode);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);
  const [syncToast, setSyncToast] = useState(null);

  const [selectedJobId, setSelectedJobId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const paceModal = useModal();
  const runsModal = useModal();
  const costModal = useModal();
  const tokensModal = useModal();
  const topRunsModal = useModal();
  const topCostModal = useModal();
  const topTokensModal = useModal();
  const topPaceModal = useModal();

  useEffect(() => {
    fetchJSON("/api/plugins/cronalytics/health")
      .then(d => {
        if (d && d.sync) {
          setSyncInfo({
            lastSync: d.sync.last_sync,
            rowsSynced: d.sync.rows_synced,
          });
        }
      })
      .catch(() => {});
  }, []);

  const onSync = () => {
    if (syncing) return;
    setSyncing(true);
    let cancelled = false;
    let syncResult = null;
    let hasError = false;

    fetchJSON("/api/plugins/cronalytics/sync", { method: "POST" })
      .then(d => { syncResult = d; })
      .then(() => fetchJSON("/api/plugins/cronalytics/health"))
      .then(d2 => {
        if (!cancelled && d2 && d2.sync) {
          setSyncInfo({
            lastSync: d2.sync.last_sync,
            rowsSynced: d2.sync.rows_synced,
          });
        }
      })
      .catch(e => {
        if (!cancelled) {
          setSyncInfo({ error: e.message });
          hasError = true;
        }
      })
      .then(() => {
        if (cancelled || hasError) {
          if (!cancelled) setSyncing(false);
          return;
        }
      })
      .then(() => {
        if (cancelled || hasError) return;
        setSyncing(false);
        if (syncResult && syncResult.result) {
          const { inserted, elapsed_ms } = syncResult.result;
          setSyncToast({ msg: "\u2713 Synced " + inserted + " runs \u00b7 " + (elapsed_ms / 1000).toFixed(1) + "s" });
          setTimeout(() => setSyncToast(null), 5000);
        }
        summary.refetch();
        jobs.refetch();
      });
  };

  const firstLoad = summary.loading && !summary.data && jobs.loading && !jobs.data;
  if (firstLoad) {
    return null;
  }

  if (summary.error || jobs.error) {
    return React.createElement("div", { style: { padding: "0 0.25rem 1rem 0", color: "var(--color-destructive)" } },
      "Error: " + (summary.error || jobs.error)
    );
  }

  const s = summary.data || {};
  const jobList = (jobs.data && jobs.data.jobs) ? jobs.data.jobs : [];
  const windowLabel = days === 0 ? "All time" : "Last " + days + " days";

  const costPct = s.previous_period && s.previous_period.cost != null && s.previous_period.cost !== 0
    ? ((s.total_estimated_cost - s.previous_period.cost) / s.previous_period.cost) * 100
    : null;
  const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0
    ? ((s.total_runs - s.previous_period.runs) / s.previous_period.runs) * 100
    : null;

  const getSortValue = (j, key) => {
    switch (key) {
      case "Job": return j.name || j.job_id;
      case "Runs": return j.runs || 0;
      case "Avg Time": return j.avg_duration || 0;
      case "Total Cost": return j.total_cost || 0;
      case "Avg Cost": return j.avg_cost || 0;
      case "Nominal/mo": return j.projections && j.projections.projected_cost_30d != null ? j.projections.projected_cost_30d : -Infinity;
      case "Trend/mo": return j.projections && j.projections.trend_projected_cost_30d != null ? j.projections.trend_projected_cost_30d : -Infinity;
      case "Pace": return j.projections && j.projections.pace != null ? j.projections.pace : -Infinity;
      default: return 0;
    }
  };

  const sortedJobs = [...jobList].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = getSortValue(a, sortConfig.key);
    const vb = getSortValue(b, sortConfig.key);
    if (typeof va === "string" && typeof vb === "string") {
      return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortConfig.direction === "asc" ? va - vb : vb - va;
  });

  return React.createElement("div", {
    style: {
      padding: "0 0.25rem 1rem 0",
      color: "var(--foreground-base, var(--foreground))",
      position: "relative"
    }
  },
    // Spinner animation keyframe
    React.createElement('style', {}, `@keyframes cronalytics-spin { to { transform: rotate(360deg); } }`),

    React.createElement(HeroBanner),

    // Sticky toolbar
    React.createElement("div", {
      style: {
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: "0.5rem 0.75rem",
        padding: "0.5rem 0",
        marginBottom: "0.5rem",
        background: "var(--background, rgba(12,12,12,0.88))",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))"
      }
    },
      // Toggles group — nowrap so they stay together as one unit.
      React.createElement("div", { style: { display: "flex", flexWrap: "nowrap", gap: "1.5rem", alignItems: "center" } },
        React.createElement(OutcomeToggle, { selected: outcome, onChange: setOutcome, label: "Outcomes" }),
        React.createElement(ModeToggle, { selected: mode, onChange: setMode, label: "Mode" }),
      ),
      // Right-side group: Days selector + Refresh, pushed to the right edge.
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem 0.75rem", alignItems: "center", marginLeft: "auto" } },
        // DaySelector returns [label, presets, custom] — flattened as direct flex children
        // so presets, custom input, and Refresh wrap independently.
        React.createElement(DaySelector, { selected: days, onChange: setDays, label: "Days" }),
        // Refresh — its own flex item so it breaks away first at 110%.
        React.createElement(Button, {
          type: "button",
          size: "sm",
          outlined: true,
          disabled: summary.loading || jobs.loading,
          onClick: () => { summary.refetch(); jobs.refetch(); },
          style: { minWidth: "5.5rem" }
        }, summary.loading || jobs.loading
          ? "\u2026"
          : React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "0.25rem" } },
              RefreshCwIcon(14),
              "Refresh"
            )
        )
      ),
    ),

    // Job Detail Modal
    React.createElement(Modal, {
      isOpen: !!selectedJobId,
      onClose: () => setSelectedJobId(null),
      maxWidth: "95%",
    }, selectedJobId && React.createElement(JobDetailView, {
      key: selectedJobId,
      jobId: selectedJobId,
      jobName: (jobList.find(j => j.job_id === selectedJobId) || {}).name,
      days: days,
      outcome: outcome,
      sortKey: ({"Job":"run_time","Runs":"run_time","Avg Time":"duration_seconds","Total Cost":"estimated_cost_usd","Avg Cost":"estimated_cost_usd","Nominal/mo":"run_time","Trend/mo":"run_time","Pace":"run_time"}[sortConfig.key] || "run_time"),
      sortDir: sortConfig.direction || "desc",
    })),

    React.createElement(SummaryBoard, {
      summary: s,
      days,
      outcome,
      onRunsClick: runsModal.open,
      onCostClick: costModal.open,
      onTokensClick: tokensModal.open,
      onPaceClick: paceModal.open,
    }),

    React.createElement(LeaderBoard, {
      jobList,
      onTopRunsClick: topRunsModal.open,
      onTopCostClick: topCostModal.open,
      onTopTokensClick: topTokensModal.open,
      onTopPaceClick: topPaceModal.open,
    }),

    // ── Pace Modal ───────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: paceModal.isOpen, onClose: paceModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
          React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) } },
            s.pace != null ? s.pace.toFixed(2) + "\u00d7" : "\u2014"
          ),
          React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Pace")
        ),
        React.createElement("div", { style: { marginBottom: "1rem" } },
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Nominal"),
              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: (Math.min(100, ((s.nominal_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1)) * 100)) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(s.nominal_monthly_total) + "/mo")
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Trend"),
              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: (Math.min(100, ((s.trend_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1)) * 100)) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(s.trend_monthly_total) + "/mo")
            )
          )
        ),
        React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem", textTransform: "none" } },
            "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019"
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "How it\u2019s calculated"),
          React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6, textTransform: "none" } },
            React.createElement("div", null, "Nominal = scheduled runs \u00d7 average cost per run"),
            React.createElement("div", null, "Trend     = actual runs \u00d7 average cost per run"),
            React.createElement("div", null, "Pace      = Trend / Nominal"),
            React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6, textTransform: "none" } }, "All scaled to a 30\u2011day month using the selected window.")
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Color guide"),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", marginBottom: "0.75rem", textTransform: "none" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
              React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#4ade80" } }),
              React.createElement("span", null, "Green (< 1.0\u00d7) \u2014 Under budget. Spending less than scheduled.")
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
              React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "var(--foreground)" } }),
              React.createElement("span", null, "Neutral (1.0\u20132.0\u00d7) \u2014 On track. Slight variance within normal range.")
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
              React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#ef4444" } }),
              React.createElement("span", null, "Red (\u2265 2.0\u00d7) \u2014 Over budget. Actual spend is double (or more) the nominal rate.")
            )
          )
        )
      )
    ),

    // ── Runs Modal ─────────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: runsModal.isOpen, onClose: runsModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
          React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
            (s.total_runs || 0).toLocaleString()
          ),
          React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Job Runs")
        ),
        runPct != null && React.createElement("div", { style: { marginBottom: "1rem" } },
          React.createElement("div", { style: { fontSize: "0.82rem", color: runPct > 0 ? "#ef4444" : "#4ade80" } },
            (runPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(runPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
          )
        ),
        React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
            "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task\u2014whether it succeeds, fails, or retries."
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
          React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
            React.createElement("div", null, "Trend % = ((current runs \u2212 prior runs) / prior runs) \u00d7 100"),
            React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6 } }, "Positive = more runs than the prior window. Negative = fewer runs."),
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
            "Showing ", React.createElement("strong", null, windowLabel), ". The prior comparison window is the same duration shifted back in time."
          )
        )
      )
    ),

    // ── Cost Modal ─────────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: costModal.isOpen, onClose: costModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
          React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
            fmtCost(s.total_estimated_cost)
          ),
          React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Estimated Cost")
        ),
        s.total_actual_cost != null && React.createElement("div", { style: { marginBottom: "0.75rem", fontSize: "0.8rem", opacity: 0.85 } },
          "Actual: ", React.createElement("span", { style: { fontWeight: 700 } }, fmtCost(s.total_actual_cost))
        ),
        costPct != null && React.createElement("div", { style: { marginBottom: "1rem" } },
          React.createElement("div", { style: { fontSize: "0.82rem", color: costPct > 0 ? "#ef4444" : "#4ade80" } },
            (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
          )
        ),
        React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
            "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity."
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
          React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
            React.createElement("div", null, "Trend % = ((current cost \u2212 prior cost) / prior cost) \u00d7 100"),
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
            "Showing ", React.createElement("strong", null, windowLabel), ". The prior comparison window is the same duration shifted back in time."
          )
        )
      )
    ),

    // ── Tokens Modal ───────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: tokensModal.isOpen, onClose: tokensModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
          React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
            fmtCompact(s.total_tokens)
          ),
          React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Tokens")
        ),
        React.createElement("div", { style: { marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
            React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "In"),
            React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
              React.createElement("div", { style: { width: Math.min(100, ((s.total_input_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
            ),
            React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_input_tokens))
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
            React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Out"),
            React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
              React.createElement("div", { style: { width: Math.min(100, ((s.total_output_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
            ),
            React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_output_tokens))
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
            React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Cached"),
            React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
              React.createElement("div", { style: { width: Math.min(100, ((s.total_cache_read_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
            ),
            React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_cache_read_tokens))
          )
        ),
        React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
          React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
            "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper)."
          ),
          React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Breakdown"),
          React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
            React.createElement("div", null, "Input:  " + fmtCompact(s.total_input_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_input_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
            React.createElement("div", null, "Output: " + fmtCompact(s.total_output_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_output_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
            React.createElement("div", null, "Cached: " + fmtCompact(s.total_cache_read_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_cache_read_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)")
          )
        )
      )
    ),

    // ── Top Runs Modal ─────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: topRunsModal.isOpen, onClose: topRunsModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        (() => {
          const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
          const label = j ? (j.name || j.job_id) : "\u2014";
          return React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
              React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
                j ? (j.runs || 0).toLocaleString() : "\u2014"
              ),
              React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "runs")
            ),
            j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
              React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
              React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                React.createElement("div", null, "Schedule: " + ((j.schedule && j.schedule.display) || "\u2014")),
                React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                React.createElement("div", null, "Avg duration: " + (j.avg_duration != null ? fmtDuration(j.avg_duration) : "\u2014")),
                React.createElement("div", null, "Tokens: " + (j.total_tokens != null ? fmtCompact(j.total_tokens) : "\u2014"))
              )
            )
          );
        })()
      )
    ),

    // ── Top Cost Modal ─────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: topCostModal.isOpen, onClose: topCostModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        (() => {
          const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_cost || 0) > (a.total_cost || 0) ? b : a, jobList[0]) : null;
          const label = j ? (j.name || j.job_id) : "\u2014";
          return React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
              React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
                j ? fmtCost(j.total_cost) : "\u2014"
              ),
              React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "total cost")
            ),
            j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
              React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
              React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                React.createElement("div", null, "Schedule: " + ((j.schedule && j.schedule.display) || "\u2014")),
                React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                React.createElement("div", null, "Avg duration: " + (j.avg_duration != null ? fmtDuration(j.avg_duration) : "\u2014")),
                React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \u00b7 Avg: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
              )
            )
          );
        })()
      )
    ),

    // ── Top Tokens Modal ───────────────────────────────────────────────
    React.createElement(Modal, { isOpen: topTokensModal.isOpen, onClose: topTokensModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        (() => {
          const j = jobList.length > 0 ? jobList.reduce((a, b) => ((b.total_tokens || 0) > (a.total_tokens || 0) ? b : a), jobList[0]) : null;
          const label = j ? (j.name || j.job_id) : "\u2014";
          return React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
              React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
                j ? fmtCompact(j.total_tokens) : "\u2014"
              ),
              React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "tokens")
            ),
            j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
              React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
              React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                React.createElement("div", null, "Schedule: " + ((j.schedule && j.schedule.display) || "\u2014")),
                React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString())
              )
            )
          );
        })()
      )
    ),

    // ── Top Pace Modal ─────────────────────────────────────────────────
    React.createElement(Modal, { isOpen: topPaceModal.isOpen, onClose: topPaceModal.close },
      React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
        (() => {
          const j = jobList.length > 0
            ? jobList.reduce((a, b) => {
                const aPace = (a.projections && a.projections.pace != null) ? a.projections.pace : -Infinity;
                const bPace = (b.projections && b.projections.pace != null) ? b.projections.pace : -Infinity;
                return bPace > aPace ? b : a;
              }, jobList[0])
            : null;
          const label = j ? (j.name || j.job_id) : "\u2014";
          const p = j && j.projections && j.projections.pace != null ? j.projections.pace : null;
          return React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
              React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(p) } },
                p != null ? p.toFixed(2) + "\u00d7" : "\u2014"
              ),
              React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "pace")
            ),
            React.createElement("div", { style: { marginBottom: "1rem" } },
              React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                  React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Nominal/mo"),
                  React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                    React.createElement("div", { style: { width: Math.min(100, ((j && j.projections && j.projections.projected_cost_30d || 1) / Math.max((j && j.projections && j.projections.projected_cost_30d) || 1, (j && j.projections && j.projections.trend_projected_cost_30d) || 1, 1)) * 100) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
                  ),
                  React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(j && j.projections ? j.projections.projected_cost_30d : null) + "/mo")
                ),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                  React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Trend/mo"),
                  React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                    React.createElement("div", { style: { width: Math.min(100, ((j && j.projections && j.projections.trend_projected_cost_30d || 1) / Math.max((j && j.projections && j.projections.projected_cost_30d) || 1, (j && j.projections && j.projections.trend_projected_cost_30d) || 1, 1)) * 100) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
                  ),
                  React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(j && j.projections ? j.projections.trend_projected_cost_30d : null) + "/mo")
                )
              )
            ),
            j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
              React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
              React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                React.createElement("div", null, "Schedule: " + ((j.schedule && j.schedule.display) || "\u2014")),
                React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \u00b7 Avg cost: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
              )
            )
          );
        })()
      )
    ),

    React.createElement(ModelBreakdown, { costByModel: s.cost_by_model }),

    mode === "all" && s.script_jobs_in_window > 0 && React.createElement("div", {
      style: { fontSize: "0.65rem", opacity: 0.45, fontFamily: "var(--theme-font-mono, monospace)", marginBottom: "0.5rem", paddingLeft: "0.25rem" }
    }, s.script_jobs_in_window + " no-agent job" + (s.script_jobs_in_window === 1 ? "" : "s") + " at $0.00 included. Filter to isolate agent costs."),

    React.createElement(JobBreakdown, {
      jobList,
      sortedJobs,
      sortConfig,
      expandedId,
      syncing,
      syncInfo,
      days,
      windowLabel,
      onSync,
      onSort: (h) => setSortConfig(prev => ({ key: h, direction: prev.key === h && prev.direction === "asc" ? "desc" : "asc" })),
      onExpandToggle: (id) => setExpandedId(expandedId === id ? null : id),
      onSelectJob: setSelectedJobId,
    }),

    // Sync toast
    syncToast && React.createElement("div", {
      style: {
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--background)",
        color: "var(--foreground-base, var(--foreground))",
        border: "1px solid var(--foreground-base, var(--foreground))",
        borderRadius: "0.5rem",
        padding: "0.6rem 1.25rem",
        fontSize: "0.85rem",
        fontFamily: "var(--theme-font-mono, monospace)",
        zIndex: 10000,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }
    }, syncToast.msg),
  );
}
