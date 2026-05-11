import { React, useState, useEffect } from "../lib/sdk.js";

export function HeroBanner() {
  const [heroLines, setHeroLines] = useState({ label: "cronalytics", sub: "Observe. Measure. Optimize." });
  useEffect(() => {
    fetch("/dashboard-plugins/cronalytics/dist/hero.txt")
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length >= 2) setHeroLines({ label: lines[0].trim(), sub: lines[1].trim() });
      })
      .catch(() => {});
  }, []);

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
    }, heroLines.sub)
  );
}
