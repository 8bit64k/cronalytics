import { React, Card, CardHeader, CardTitle, CardContent } from "../lib/sdk.js";
import { fmtCost } from "../lib/formatters.js";
import { CpuIcon } from "../lib/icons.js";

export function ModelBreakdown({ costByModel }) {
  if (!costByModel || costByModel.length === 0) return null;
  const topModels = costByModel.slice(0, 5);
  const remaining = costByModel.length - 5;
  const maxCost = (topModels[0] && topModels[0].tot_estimated_cost) || 1;

  return React.createElement(Card, { style: { marginBottom: "1.5rem" } },
    React.createElement(CardHeader, null,
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
        CpuIcon(16),
        React.createElement(CardTitle, null, "Per-Model Breakdown")
      )
    ),
    React.createElement(CardContent, null,
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.15rem" } },
        topModels.map(m => React.createElement("div", {
          key: m.model,
          style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", borderRadius: "0.25rem", cursor: "default", transition: "background 0.15s ease" },
          onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; },
          onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
        },
          React.createElement("span", {
            style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, minWidth: 0, flex: "0 0 38%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
          }, m.model),
          React.createElement("div", {
            style: { flex: 1, background: "rgba(255,255,255,0.04)", height: "0.4rem", borderRadius: "0.2rem", overflow: "hidden" }
          },
            React.createElement("div", {
              style: { width: (Math.min(100, ((m.tot_estimated_cost || 0) / maxCost) * 100)) + "%", background: "#f5a623", height: "100%", borderRadius: "0.2rem", transition: "width 0.5s ease" }
            })
          ),
          React.createElement("span", {
            style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0, flex: "0 0 9rem", justifyContent: "flex-end" }
          },
            React.createElement("span", { style: { color: "#f5a623", width: "4.5rem", textAlign: "right", display: "inline-block" } }, fmtCost(m.tot_estimated_cost)),
            React.createElement("span", { style: { opacity: 0.45, width: "3.5rem", textAlign: "right", display: "inline-block" } }, "\u00b7 " + (m.runs || 0).toLocaleString())
          )
        )),
        remaining > 0 && React.createElement("div", {
          style: { textAlign: "center", fontSize: "0.65rem", opacity: 0.35, marginTop: "0.3rem", fontFamily: "var(--theme-font-mono, monospace)" }
        }, "and " + remaining + " more")
      )
    )
  );
}
