import { React, Card, CardHeader, CardTitle, CardContent } from "../lib/sdk.js";
import { fmtCost, fmtCompact, paceColor } from "../lib/formatters.js";
import { ZapIcon, BanknoteIcon, BlocksIcon, MetronomeIcon, InfoIcon } from "../lib/icons.js";

export function LeaderBoard({ jobList, onTopRunsClick, onTopCostClick, onTopTokensClick, onTopPaceClick }) {
  // Precompute totals for "% of total" context on leader cards
  const totalRuns = jobList.reduce((sum, j) => sum + (j.runs || 0), 0);
  const totalCost = jobList.reduce((sum, j) => sum + (j.tot_estimated_cost || 0), 0);
  const totalTokens = jobList.reduce((sum, j) => sum + (j.total_tokens || 0), 0);

  const cardHover = {
    onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
    onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
  };
  const cardProps = (onClick, label, extraStyle) => ({
    style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column", ...(extraStyle || {}) },
    tabIndex: 0,
    role: "button",
    "aria-label": label,
    onClick,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
    onMouseEnter: cardHover.onMouseEnter,
    onMouseLeave: cardHover.onMouseLeave,
  });

  return React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "1rem",
      marginBottom: "1.5rem",
      alignItems: "stretch"
    }
  },
    // Top Runs
    (() => {
      const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
      const label = j ? (j.name || j.job_id) : "\u2014";
      return React.createElement("div", cardProps(onTopRunsClick, "Top Runs details", { minWidth: 0, overflow: "hidden" }),
        React.createElement(Card, { style: { flex: 1 } },
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, ZapIcon(14)),
              React.createElement(CardTitle, null, "Top Runs"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", {
              style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, j ? (j.runs || 0).toLocaleString() : "\u2014"),
            React.createElement("div", {
              style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              title: label
            }, label),
            React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
              totalRuns > 0 ? (Math.round(((j.runs || 0) / totalRuns) * 100)) + "% of total runs" : ""
            )
          )
        )
      );
    })(),
    // Top Cost
    (() => {
      const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.tot_estimated_cost || 0) > (a.tot_estimated_cost || 0) ? b : a, jobList[0]) : null;
      const label = j ? (j.name || j.job_id) : "\u2014";
      return React.createElement("div", cardProps(onTopCostClick, "Top est cost details", { minWidth: 0, overflow: "hidden" }),
        React.createElement(Card, { style: { flex: 1 } },
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BanknoteIcon(14)),
              React.createElement(CardTitle, null, "Top Cost"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#f5a623", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, j ? fmtCost(j.tot_estimated_cost) : "\u2014"),
              j && React.createElement("span", { style: { fontSize: "0.7rem", opacity: 0.95, fontFamily: "var(--theme-font-mono, monospace)", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: "0.25rem", padding: "0.05rem 0.4rem" } }, "Estimated")
            ),
            React.createElement("div", {
              style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              title: label
            }, label),
            React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
              totalCost > 0 ? (Math.round(((j.tot_estimated_cost || 0) / totalCost) * 100)) + "% of total est cost" : ""
            )
          )
        )
      );
    })(),
    // Top Tokens
    (() => {
      const j = jobList.length > 0 ? jobList.reduce((a, b) => ((b.total_tokens || 0) > (a.total_tokens || 0) ? b : a), jobList[0]) : null;
      const label = j ? (j.name || j.job_id) : "\u2014";
      return React.createElement("div", cardProps(onTopTokensClick, "Top Tokens details", { minWidth: 0, overflow: "hidden" }),
        React.createElement(Card, { style: { flex: 1 } },
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BlocksIcon(14)),
              React.createElement(CardTitle, null, "Top Tokens"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", {
              style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#5b8def", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, j ? fmtCompact(j.total_tokens) : "\u2014"),
            React.createElement("div", {
              style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              title: label
            }, label),
            React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
              totalTokens > 0 ? (Math.round(((j.total_tokens || 0) / totalTokens) * 100)) + "% of total tokens" : ""
            )
          )
        )
      );
    })(),
    // Top Pace
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
      return React.createElement("div", cardProps(onTopPaceClick, "Top Pace details", { minWidth: 0, overflow: "hidden" }),
        React.createElement(Card, { style: { flex: 1 } },
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, MetronomeIcon(14)),
              React.createElement(CardTitle, null, "Top Pace"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", {
              style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: p != null ? paceColor(p) : null, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, p != null ? p.toFixed(2) + "\u00d7" : "\u2014"),
            React.createElement("div", {
              style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              title: label
            }, label),
            React.createElement("div", { style: { height: "3rem" } })
          )
        )
      );
    })()
  );
}
