import { React, useState } from "../lib/sdk.js";
import { useCronalyticsI18n } from "../i18n/index.js";

export function HeroBanner() {
  const t = useCronalyticsI18n();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("cronalytics:hero:collapsed") === "1"; } catch { return false; }
  });

  const toggle = () => {
    const next = !collapsed;
    try { localStorage.setItem("cronalytics:hero:collapsed", next ? "1" : "0"); } catch {}
    setCollapsed(next);
  };

  // Collapsed: thin bar with label + tagline only
  if (collapsed) {
    return React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.3rem 0.5rem 0.3rem 0.75rem",
        marginBottom: "0.5rem",
        borderLeft: "3px solid var(--color-accent)",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
        cursor: "pointer",
      },
      onClick: toggle,
      title: t("hero.expand_tooltip", "Expand hero banner"),
    },
      React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "0.5rem" } },
        React.createElement("span", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" } }, t("hero.title", "CRONALYTICS")),
        React.createElement("span", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.65rem", opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase" } }, t("hero.tagline", "Observe. Measure. Optimize."))
      ),
      React.createElement("span", { style: { fontSize: "0.7rem", opacity: 0.5 } }, "▼")
    );
  }

  // Expanded: full hero
  return React.createElement("div", {
    style: {
      position: "relative",
      padding: "0.75rem 0 0.5rem 0.75rem",
      marginBottom: "0.5rem",
      borderLeft: "3px solid var(--color-accent)",
      borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))"
    }
  },
    // Collapse toggle
    React.createElement("button", {
      onClick: toggle,
      title: t("hero.collapse_tooltip", "Collapse hero banner"),
      style: {
        position: "absolute",
        top: 4,
        right: 8,
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.3)",
        fontSize: "0.7rem",
        cursor: "pointer",
        lineHeight: 1,
        padding: "0.15rem 0.25rem",
        borderRadius: "0.2rem",
      },
    }, "▲"),

    React.createElement("div", {
      style: {
        fontFamily: "var(--theme-font-mono, monospace)",
        fontSize: "0.7rem",
        opacity: 0.6,
        marginBottom: "0.15rem"
      }
    }, t("hero.pronunciation", "/ˈkrɒn.əˌlɪt.ɪks/"),
      React.createElement("i", { style: { opacity: 0.5, marginLeft: "0.5rem", fontSize: "0.65rem" } }, t("hero.noun", "(noun)"))
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
    }, t("hero.definition_1", "1. Cron analytics and observability.")),
    React.createElement("div", {
      style: {
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "0.95rem",
        opacity: 0.85,
        lineHeight: 1.35,
        maxWidth: "42rem",
        marginBottom: "0.35rem"
      }
    }, t("hero.definition_2", "2. The dashboard for agentic automations in Hermes.")),
    React.createElement("div", {
      style: {
        fontFamily: "var(--theme-font-mono, monospace)",
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        opacity: 0.6
      }
    }, t("hero.tagline", "Observe. Measure. Optimize."))
  );
}
