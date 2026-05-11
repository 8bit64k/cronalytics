import { React, useState } from "../lib/sdk.js";
import { Badge } from "../lib/sdk.js";
import { useApi } from "../hooks/useApi.js";
import { fmtTime, fmtCost, fmtCompact, fmtDuration } from "../lib/formatters.js";

const COLUMNS = [
  { label: "Time", key: "run_time", align: "left" },
  { label: "Cost", key: "estimated_cost_usd", align: "right" },
  { label: "Duration", key: "duration_seconds", align: "right" },
  { label: "Tokens", key: "input_tokens", align: "right" },
  { label: "Model", key: "model", align: "left" },
  { label: "Mode", key: "job_mode", align: "center" },
  { label: "Result", key: "success", align: "center" },
];

function tokTotal(r) {
  return (r.input_tokens || 0) + (r.output_tokens || 0) + (r.cache_read_tokens || 0) + (r.cache_write_tokens || 0);
}

export function JobDetailView({ jobId, jobName, days, outcome, sortKey, sortDir }) {
  const [sKey, setSKey] = useState(sortKey);
  const [sDir, setSDir] = useState(sortDir);

  const path = `/api/plugins/cronalytics/jobs/${encodeURIComponent(jobId)}/runs?days=${days}&outcome=${outcome}&sort_key=${sKey}&sort_dir=${sDir}&limit=200`;
  const runs = useApi(path);

  const sortedRuns = runs.data && runs.data.runs
    ? [...runs.data.runs].sort((a, b) => {
        const dir = sDir === "desc" ? -1 : 1;
        const av = a[sKey], bv = b[sKey];
        if (sKey === "input_tokens") return dir * (tokTotal(a) - tokTotal(b));
        if (sKey === "run_time" || sKey === "estimated_cost_usd" || sKey === "duration_seconds") return dir * (av - bv);
        if (sKey === "success") return dir * ((av ? 1 : 0) - (bv ? 1 : 0));
        if (av == null || av === "") return 1;
        if (bv == null || bv === "") return -1;
        return dir * String(av).localeCompare(String(bv));
      })
    : [];

  return React.createElement(
    "div",
    { style: { padding: "1.5rem 3rem 1.5rem 1.5rem" } },
    React.createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      React.createElement(
        "div",
        {
          style: {
            fontSize: "0.9rem",
            fontWeight: 600,
            fontFamily: "var(--theme-font-mono, monospace)",
            marginBottom: "0.2rem",
          },
        },
        jobName || jobId
      ),
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        React.createElement(
          "span",
          {
            style: {
              fontSize: "0.72rem",
              opacity: 0.45,
              fontFamily: "var(--theme-font-mono, monospace)",
            },
          },
          jobId
        ),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "0.72rem",
              opacity: 0.45,
              fontFamily: "var(--theme-font-mono, monospace)",
            },
          },
          runs.data && runs.data.runs ? runs.data.runs.length + " run" + (runs.data.runs.length === 1 ? "" : "s") : ""
        )
      )
    ),

    runs.loading
      ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, "Loading runs...")
      : runs.error
        ? React.createElement("div", { style: { color: "#ef4444", padding: "1rem 0" } }, "Error: " + runs.error)
        : !sortedRuns.length
          ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, "No runs captured for this job.")
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "table",
                {
                  style: {
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.78rem",
                    tableLayout: "fixed",
                  },
                },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    { style: { borderBottom: "1px solid var(--color-border)" } },
                    COLUMNS.map((col) => {
                      const isActive = sKey === col.key;
                      return React.createElement(
                        "th",
                        {
                          key: col.key,
                          onClick: () => {
                            setSKey(col.key);
                            setSDir(isActive && sDir === "desc" ? "asc" : "desc");
                          },
                          style: {
                            textAlign: col.align,
                            padding: "0.5rem 0.35rem",
                            fontFamily: "var(--theme-font-mono, monospace)",
                            fontWeight: 600,
                            borderBottom: "2px solid var(--color-border)",
                            cursor: "pointer",
                            userSelect: "none",
                            whiteSpace: "nowrap",
                          },
                        },
                        col.label + (isActive ? (sDir === "desc" ? " ↓" : " ↑") : "")
                      );
                    })
                  )
                )
              ),
              React.createElement(
                "div",
                { style: { overflow: "auto", maxHeight: "40vh" } },
                React.createElement(
                  "table",
                  {
                    style: {
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.78rem",
                      tableLayout: "fixed",
                    },
                  },
                  React.createElement(
                    "tbody",
                    null,
                    sortedRuns.map((r) =>
                      React.createElement(
                        "tr",
                        {
                          key: r.session_id,
                          style: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
                        },
                        React.createElement("td", { style: { padding: "0.4rem 0.35rem", whiteSpace: "nowrap" } }, fmtTime(r.run_time)),
                        React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(r.estimated_cost_usd)),
                        React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtDuration(r.duration_seconds)),
                        React.createElement(
                          "td",
                          { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)", whiteSpace: "nowrap" } },
                          (() => {
                            const total = tokTotal(r);
                            if (total === 0) return "—";
                            return fmtCompact(total);
                          })()
                        ),
                        React.createElement("td", { style: { padding: "0.4rem 0.35rem" } }, r.model || "—"),
                        React.createElement(
                          "td",
                          { style: { textAlign: "center", padding: "0.4rem 0.35rem" } },
                          r.job_mode === "no_agent"
                            ? React.createElement(Badge, { size: "xs", style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 } }, "No agent")
                            : React.createElement("span", { style: { fontSize: "0.65rem", opacity: 0.45 } }, "Agent")
                        ),
                        React.createElement(
                          "td",
                          { style: { textAlign: "center", padding: "0.4rem 0.35rem" } },
                          r.success
                            ? React.createElement("span", { style: { color: "#22c55e" } }, "✓")
                            : React.createElement("span", { style: { color: "#ef4444" } }, "✗")
                        )
                      )
                    )
                  )
                )
              )
            )
  );
}
