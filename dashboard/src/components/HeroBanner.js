import { React } from "../lib/sdk.js";

export function HeroBanner() {
  return React.createElement("div", {
    style: {
      padding: "0.75rem 0 0.5rem 0.75rem",
      marginBottom: "0.5rem",
      borderLeft: "3px solid var(--color-accent)",
      borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))"
    }
  },
    React.createElement("div", {
      style: {
        fontFamily: "var(--theme-font-mono, monospace)",
        fontSize: "0.7rem",
        opacity: 0.6,
        marginBottom: "0.15rem"
      }
    }, "/\u02c8kr\u0252n.\u0259\u02ccl\u026at.\u026aks/",
      React.createElement("i", { style: { opacity: 0.5, marginLeft: "0.5rem", fontSize: "0.65rem" } }, "(noun)")
    ),
    React.createElement("div", {
      style: {
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "0.95rem",
        opacity: 0.85,
        lineHeight: 1.35,
        maxWidth: "42rem",
        marginBottom: "0.15rem"
      }
    }, "1. Cron analytics and observability."),
    React.createElement("div", {
      style: {
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "0.95rem",
        opacity: 0.85,
        lineHeight: 1.35,
        maxWidth: "42rem",
        marginBottom: "0.35rem"
      }
    }, "2. The dashboard for agentic automations in Hermes."),
    React.createElement("div", {
      style: {
        fontFamily: "var(--theme-font-mono, monospace)",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: 0.6
      }
    }, "Observe. Measure. Optimize.")
  );
}
