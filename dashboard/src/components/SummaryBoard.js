import { React, Card, CardHeader, CardTitle, CardContent } from "../lib/sdk.js";
import { fmtCost, fmtCompact, paceColor } from "../lib/formatters.js";
import { ZapIcon, BanknoteIcon, BlocksIcon, MetronomeIcon, HelpCircleIcon } from "../lib/icons.js";

export function SummaryBoard({ summary, days, outcome, onRunsClick, onCostClick, onTokensClick, onPaceClick }) {
  const s = summary || {};
  const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0
    ? ((s.total_runs - s.previous_period.runs) / s.previous_period.runs) * 100
    : null;
  const costPct = s.previous_period && s.previous_period.cost != null && s.previous_period.cost !== 0
    ? ((s.total_estimated_cost - s.previous_period.cost) / s.previous_period.cost) * 100
    : null;

  const cardHover = {
    onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
    onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
  };
  const cardProps = (onClick, label) => ({
    style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
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
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "1rem",
      marginBottom: "1.5rem",
      alignItems: "stretch"
    }
  },
    // Job Runs
    React.createElement("div", cardProps(onRunsClick, "Job Runs details"),
      React.createElement(Card, { style: { flex: 1 } },
        React.createElement(CardHeader, null,
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
            React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, ZapIcon(14)),
            React.createElement(CardTitle, null, "Job Runs"),
            React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
          )
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } }, (s.total_runs || 0).toLocaleString()),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: runPct != null ? (runPct > 0 ? "#ef4444" : "#4ade80") : null } },
            runPct != null ? (runPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(runPct).toFixed(0) + "%" : "\u2014"
          ),
          React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
            "vs prior ", days === 0 ? "period" : days + "d"
          )
        )
      )
    ),
    // Cost
    React.createElement("div", cardProps(onCostClick, outcome === "failure" ? "Wasted cost details" : "Cost details"),
      React.createElement(Card, { style: { flex: 1 } },
        React.createElement(CardHeader, null,
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
            React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, BanknoteIcon(14)),
            React.createElement(CardTitle, null, outcome === "failure" ? "Wasted" : "Cost"),
            React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
          )
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: outcome === "failure" ? "#ef4444" : "#f5a623" } },
            fmtCost(s.total_estimated_cost)
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: costPct != null ? (costPct > 0 ? "#ef4444" : "#4ade80") : null } },
            costPct != null ? (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "%" : "\u2014"
          ),
          React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
            "vs prior ", days === 0 ? "period" : days + "d"
          ),
          React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.3rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.25rem" } },
            "Actual: ", s.total_actual_cost != null ? fmtCost(s.total_actual_cost) : "\u2014"
          ),
          React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem" } },
            React.createElement("span", { style: { color: "#4ade80" } }, "\u2713 ", s.success_runs || 0),
            " \u00b7 ",
            React.createElement("span", { style: { color: (s.failure_runs || 0) > 0 ? "#ef4444" : null } }, "\u2717 ", s.failure_runs || 0),
            (s.failure_cost != null && s.failure_cost > 0) ? " (" + fmtCost(s.failure_cost) + " wasted)" : ""
          )
        )
      )
    ),
    // Tokens
    React.createElement("div", cardProps(onTokensClick, "Tokens details"),
      React.createElement(Card, { style: { flex: 1 } },
        React.createElement(CardHeader, null,
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
            React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, BlocksIcon(14)),
            React.createElement(CardTitle, null, "Tokens"),
            React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
          )
        ),
        React.createElement(CardContent, null,
          React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
            fmtCompact(s.total_tokens)
          ),
          React.createElement("div", { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "In"),
              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, ((s.total_input_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
              ),
              React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_input_tokens))
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Out"),
              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, ((s.total_output_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
              ),
              React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_output_tokens))
            ),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Cached"),
              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, ((s.total_cache_read_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
              ),
              React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_cache_read_tokens))
            )
          )
        )
      )
    ),
    // Pace
    (() => {
      const nominalPace = s.nominal_monthly_total || 0;
      const trendPace = s.trend_monthly_total || 0;
      const maxPace = Math.max(nominalPace, trendPace, 1);
      return React.createElement("div", cardProps(onPaceClick, "Pace details"),
        React.createElement(Card, { style: { flex: 1 } },
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, MetronomeIcon(14)),
              React.createElement(CardTitle, null, "Pace"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", {
              style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) }
            }, s.pace != null ? s.pace.toFixed(2) + "\u00d7" : "\u2014"),
            React.createElement("div", { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Nominal"),
                React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: (Math.min(100, (nominalPace / maxPace) * 100)) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
                ),
                React.createElement("span", { style: { width: "4.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(nominalPace))
              ),
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Trend"),
                React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: (Math.min(100, (trendPace / maxPace) * 100)) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
                ),
                React.createElement("span", { style: { width: "4.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(trendPace))
              )
            )
          )
        )
      );
    })()
  );
}
