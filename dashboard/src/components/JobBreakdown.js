import { React, Card, CardHeader, CardTitle, CardContent, Badge, Button } from "../lib/sdk.js";
import { fmtCost, fmtCompact, fmtDuration, fmtTime, fmtRel, fmtSyncAge, paceColor, paceBg } from "../lib/formatters.js";
import { ClockIcon, RefreshCwIcon } from "../lib/icons.js";
import { useCronalyticsI18n } from "../i18n/index.js";

export function JobBreakdown({
  jobList, sortedJobs, sortConfig, expandedId,
  syncing, syncInfo, days, windowLabel,
  onSync, onSort, onExpandToggle, onSelectJob
}) {
  const t = useCronalyticsI18n();
  const HEADERS = [
    t("job_breakdown.job", "Job"),
    t("job_breakdown.runs", "Runs"),
    t("job_breakdown.avg_time", "Avg Time"),
    t("job_breakdown.est_cost", "Est Cost"),
    t("job_breakdown.avg_est_cost", "Avg Est Cost"),
    t("job_breakdown.nominal_mo", "Nominal/mo"),
    t("job_breakdown.trend_mo", "Trend/mo"),
    t("job_breakdown.pace", "Pace"),
  ];

  return React.createElement(Card, { style: { marginBottom: "1.5rem" } },
    React.createElement(CardHeader, null,
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
          ClockIcon(16),
          React.createElement(CardTitle, null, t("job_breakdown.title", "Jobs Breakdown"))
        ),
        React.createElement("div", { style: { display: "flex", gap: "0.75rem", alignItems: "center" } },
          React.createElement(Button, {
            size: "sm",
            outlined: !syncing,
            disabled: syncing,
            onClick: onSync,
          }, syncing
            ? React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "0.35rem" } },
                RefreshCwIcon(14, { style: { animation: "cronalytics-spin 1s linear infinite" } }),
                t("shared.loading", "Syncing")
              )
            : t("shared.sync_now", "Sync Now")
          ),
          syncInfo && syncInfo.lastSync && (() => {
            const age = fmtSyncAge(syncInfo.lastSync);
            return age ? React.createElement("span", {
              style: {
                fontSize: "0.65rem",
                opacity: age.color ? 1 : 0.45,
                fontFamily: "var(--theme-font-mono, monospace)",
                color: age.color || "inherit",
              }
            }, age.text) : null;
          })()
        )
      )
    ),
    React.createElement(CardContent, null,
      jobList.length === 0
        ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } },
          syncing
            ? t("shared.loading", "Syncing cron sessions...")
            : (syncInfo && syncInfo.lastSync
              ? t("job_breakdown.no_jobs_window", "No jobs in {window}. Last sync: {time} UTC", { window: windowLabel.toLowerCase(), time: syncInfo.lastSync.split("T").join(" ").slice(0, 19) })
              : t("job_breakdown.no_jobs_sync", "No cron jobs captured. Click Sync Now to backfill from state.db."))
        )
        : React.createElement("div", { style: { overflow: "auto" } },
          React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" } },
            React.createElement("thead", null,
              React.createElement("tr", { style: { borderBottom: "1px solid var(--color-border)" } },
                HEADERS.map(h => {
                  const isActive = sortConfig.key === h;
                  return React.createElement("th", {
                    key: h,
                    tabIndex: 0,
                    role: "button",
                    "aria-label": isActive
                      ? t("job_breakdown.sorted_by", "Sorted by {col}, {dir}", { col: h, dir: sortConfig.direction === "asc" ? t("job_breakdown.ascending", "ascending") : t("job_breakdown.descending", "descending") })
                      : t("job_breakdown.sort_by", "Sort by {col}", { col: h }),
                    onClick: () => onSort(h),
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSort(h);
                      }
                    },
                    style: {
                      textAlign: h === HEADERS[0] ? "left" : "right",
                      padding: "0.5rem 0.35rem",
                      cursor: "pointer",
                      fontFamily: "var(--theme-font-mono, monospace)",
                      fontWeight: 600,
                      userSelect: "none",
                      borderBottom: "2px solid var(--color-border)",
                    },
                    title: h === t("job_breakdown.pace", "Pace") ? "Pace = Trend \u00f7 Nominal. Under 1.0\u00d7 = under budget. Over 2.0\u00d7 = over budget." : undefined
                  }, h + (isActive ? (sortConfig.direction === "asc" ? " \u2191" : " \u2193") : ""));
                })
              )
            ),
            React.createElement("tbody", null,
              sortedJobs.map(j => [
                React.createElement("tr", {
                  key: j.job_id,
                  style: { borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s ease" },
                  onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; },
                  onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
                  onClick: () => onExpandToggle(j.job_id)
                },
                  React.createElement("td", { style: { padding: "0.4rem 0.35rem" } },
                    React.createElement("div", { style: { fontSize: "0.78rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4rem" } },
                      j.name || j.job_id,
                      j.job_mode === "no_agent" && React.createElement(Badge, {
                        size: "xs",
                        style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 }
                      }, t("job_breakdown.mode_no_agent", "No agent"))
                    )
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, (j.runs || 0).toLocaleString()),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtDuration(j.avg_duration)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.tot_estimated_cost)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_estimated_cost)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
                    j.projections && j.projections.projected_cost_30d != null
                      ? fmtCost(j.projections.projected_cost_30d) + "/mo"
                      : "\u2014"
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontWeight: 500 } },
                    j.projections && j.projections.trend_projected_cost_30d != null
                      ? fmtCost(j.projections.trend_projected_cost_30d) + "/mo"
                      : "\u2014"
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
                    React.createElement("span", {
                      style: {
                        fontWeight: 700,
                        color: paceColor(j.projections && j.projections.pace),
                        background: paceBg(j.projections && j.projections.pace),
                        borderRadius: "0.25rem",
                        padding: "0.15rem 0.4rem",
                        display: "inline-block",
                        fontFamily: "var(--theme-font-mono, monospace)",
                      }
                    },
                      j.projections && j.projections.pace != null
                        ? j.projections.pace.toFixed(2) + "\u00d7"
                        : "\u2014"
                    )
                  )
                ),
                expandedId === j.job_id && React.createElement("tr", { key: j.job_id + "_detail" },
                  React.createElement("td", { colSpan: 8, style: { padding: "0.6rem 0.35rem 0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", fontSize: "0.72rem" } },
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.3rem" } },
                      React.createElement("div", {
                        style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
                      },
                        t("summary.tokens", "Tokens") + ": " + fmtCompact(j.total_tokens) + " total "
                          + "(" + fmtCompact(j.total_input_tokens) + " " + t("summary.in", "in") + " / "
                          + fmtCompact(j.total_output_tokens) + " " + t("summary.out", "out") + " / "
                          + fmtCompact(j.total_cache_read_tokens) + " " + t("summary.cached", "cached") + ")"
                      ),
                      React.createElement("div", {
                        style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
                      },
                        React.createElement("span", { style: { color: "#4ade80" } }, "\u2713 ", j.success_runs || 0),
                        " \u00b7 ",
                        React.createElement("span", { style: { color: (j.failure_runs || 0) > 0 ? "#ef4444" : null } }, "\u2717 ", j.failure_runs || 0)
                      ),
                      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
                        React.createElement("div", {
                          style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "0.5rem" }
                        },
                          (j.projections && j.projections.schedule_display ? j.projections.schedule_display : t("job_breakdown.no_schedule", "No schedule")),
                          "   " + t("job_breakdown.last", "Last") + ": ", fmtTime(j.last_run),
                          j.last_model ? "   " + t("job_breakdown.using", "using") + " " + j.last_model : "",
                          "   " + t("job_breakdown.next", "Next") + ": ", j.projections && j.projections.next_run_at ? fmtRel(j.projections.next_run_at) : "\u2014",
                          j.job_mode === "no_agent" && React.createElement("span", { style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.5, marginLeft: "0.25rem" } }, "[" + t("job_breakdown.mode_no_agent", "No agent") + "]")
                        ),
                        React.createElement("button", {
                          type: "button",
                          onClick: (e) => { e.stopPropagation(); onSelectJob(j.job_id); },
                          style: {
                            fontSize: "0.72rem",
                            fontFamily: "var(--theme-font-mono, monospace)",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "0.3rem",
                            padding: "0.25rem 0.5rem",
                            color: "var(--foreground-base, var(--foreground))",
                            cursor: "pointer",
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                          },
                          onMouseEnter: (e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; },
                          onMouseLeave: (e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; },
                        }, t("job_breakdown.see_runs", "See Runs"))
                      )
                    )
                  )
                ),
              ]).flat()
            )
          )
        )
    )
  );
}
