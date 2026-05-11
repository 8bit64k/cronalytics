(() => {
  // src/lib/sdk.js
  var SDK = window.__HERMES_PLUGIN_SDK__;
  var PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) {
    throw new Error("Cronalytics: Hermes SDK not available");
  }
  var React = SDK.React;
  var { useState, useEffect, useRef, useMemo } = SDK.hooks;
  var fetchJSON = SDK.fetchJSON;
  var { Card, CardHeader, CardTitle, CardContent, Badge, Button } = SDK.components;

  // src/components/ErrorBoundary.js
  var PluginErrorBoundary = class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
      return { hasError: true };
    }
    render() {
      if (this.state.hasError) {
        return React.createElement(
          "div",
          {
            style: {
              padding: "2rem",
              color: "var(--color-destructive, #ef4444)",
              textAlign: "center",
              fontFamily: "var(--theme-font-mono, monospace)"
            }
          },
          React.createElement(
            "div",
            { style: { fontWeight: 700, marginBottom: "0.5rem" } },
            "Cronalytics Error"
          ),
          React.createElement(
            "div",
            { style: { fontSize: "0.85rem", opacity: 0.8 } },
            "Something went wrong. Please refresh or contact support."
          )
        );
      }
      return this.props.children;
    }
  };

  // src/hooks/useApi.js
  function useApi(path) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      const { fetchJSON: fetchJSON2 } = window.__HERMES_PLUGIN_SDK__;
      fetchJSON2(path).then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      }).catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [path, reload]);
    return { data, loading, error, refetch: () => setReload((r) => r + 1) };
  }
  function useModal() {
    const [isOpen, setOpen] = useState(false);
    const open = () => setOpen(true);
    const close = () => setOpen(false);
    return { isOpen, open, close };
  }

  // src/components/Modal.js
  function Modal({ isOpen, onClose, children, maxWidth }) {
    const backdropRef = useRef(null);
    const [bounds, setBounds] = useState(null);
    useEffect(() => {
      if (!isOpen) return;
      const onKey = (e) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);
    useEffect(() => {
      if (!isOpen) return;
      function update() {
        const el = document.querySelector("main") || document.body;
        const r = el.getBoundingClientRect();
        setBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }, [isOpen]);
    if (!isOpen) return null;
    return React.createElement(
      "div",
      {
        ref: backdropRef,
        role: "dialog",
        "aria-modal": true,
        onClick: (e) => {
          if (e.target === backdropRef.current) onClose();
        },
        style: {
          position: "fixed",
          top: bounds && bounds.top || 0,
          left: bounds && bounds.left || 0,
          width: bounds && bounds.width || "100%",
          height: bounds && bounds.height || "100%",
          background: "rgba(0,0,0,0.78)",
          zIndex: 1e3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            background: "var(--background)",
            color: "var(--foreground-base, var(--foreground))",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            width: "100%",
            maxWidth: maxWidth || "28rem",
            maxHeight: "85vh",
            overflow: "auto",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            position: "relative"
          }
        },
        React.createElement(
          "button",
          {
            type: "button",
            "aria-label": "Close",
            onClick: onClose,
            style: {
              position: "absolute",
              top: "0.6rem",
              right: "0.6rem",
              width: "2rem",
              height: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "0.35rem",
              color: "var(--foreground-base, var(--foreground))",
              fontSize: "1.25rem",
              cursor: "pointer",
              lineHeight: 1,
              transition: "background 0.15s ease"
            },
            onMouseEnter: (e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.16)";
            },
            onMouseLeave: (e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }
          },
          "\xD7"
        ),
        children
      )
    );
  }

  // src/components/DaySelector.js
  var PRESETS = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "90D", value: 90 }
  ];
  var MAX_DAYS = 365;
  function DaySelector({ selected, onChange }) {
    const [custom, setCustom] = useState("");
    const applyCustom = () => {
      const v = parseInt(custom, 10);
      onChange(isNaN(v) || v < 0 ? 0 : Math.min(v, MAX_DAYS));
    };
    return [
      // Preset buttons group
      React.createElement(
        "span",
        {
          key: "presets",
          style: { display: "inline-flex", gap: "0.375rem", alignItems: "center" }
        },
        ...PRESETS.map(
          (d) => React.createElement(
            Button,
            {
              key: d.value,
              type: "button",
              size: "sm",
              outlined: selected !== d.value,
              onClick: () => {
                setCustom("");
                onChange(d.value);
              }
            },
            d.label
          )
        )
      ),
      // Custom input + Go group
      React.createElement(
        "span",
        {
          key: "custom",
          style: { display: "inline-flex", gap: "0.375rem", alignItems: "center" }
        },
        React.createElement("input", {
          type: "number",
          min: 0,
          step: 1,
          max: MAX_DAYS,
          placeholder: "days",
          value: custom,
          onChange: (e) => setCustom(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") applyCustom();
          },
          style: {
            width: "3.5rem",
            fontSize: "0.7rem",
            fontFamily: "var(--theme-font-mono, monospace)",
            background: "var(--background, rgba(12,12,12,0.5))",
            color: "var(--foreground-base, var(--foreground))",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: "0.25rem",
            padding: "0.25rem 0.35rem",
            outline: "none"
          }
        }),
        React.createElement(
          Button,
          {
            type: "button",
            size: "sm",
            outlined: true,
            onClick: applyCustom,
            title: "Apply custom days"
          },
          "Go"
        )
      )
    ];
  }

  // src/components/OutcomeToggle.js
  var OPTIONS = [
    { label: "All", value: "both" },
    { label: "Success", value: "success" },
    { label: "Failure", value: "failure" }
  ];
  function OutcomeToggle({ selected, onChange, label }) {
    return React.createElement(
      "div",
      { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
      label ? React.createElement(
        "span",
        {
          style: {
            fontSize: "0.75rem",
            textTransform: "uppercase",
            opacity: 0.55,
            fontWeight: 500,
            letterSpacing: "0.03em",
            lineHeight: 1,
            userSelect: "none"
          }
        },
        label
      ) : null,
      ...OPTIONS.map(
        (o) => React.createElement(
          Button,
          {
            key: o.value,
            type: "button",
            size: "sm",
            outlined: selected !== o.value,
            onClick: () => onChange(o.value)
          },
          o.label
        )
      )
    );
  }

  // src/components/ModeToggle.js
  var OPTIONS2 = [
    { label: "All", value: "all" },
    { label: "Agent", value: "agent" },
    { label: "No Agent", value: "no_agent" }
  ];
  function ModeToggle({ selected, onChange, label }) {
    return React.createElement(
      "div",
      { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
      label ? React.createElement(
        "span",
        {
          style: {
            fontSize: "0.75rem",
            textTransform: "uppercase",
            opacity: 0.55,
            fontWeight: 500,
            letterSpacing: "0.03em",
            lineHeight: 1,
            userSelect: "none"
          }
        },
        label
      ) : null,
      ...OPTIONS2.map(
        (o) => React.createElement(
          Button,
          {
            key: o.value,
            type: "button",
            size: "sm",
            outlined: selected !== o.value,
            onClick: () => onChange(o.value)
          },
          o.label
        )
      )
    );
  }

  // src/lib/formatters.js
  function fmtCost(n) {
    if (n == null) return "\u2014";
    if (n === 0) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }
  function fmtTime(ts) {
    if (!ts) return "\u2014";
    const d = new Date(ts * 1e3);
    const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
    return new Intl.DateTimeFormat(void 0, opts).format(d);
  }
  function fmtRel(iso) {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    const now = /* @__PURE__ */ new Date();
    const diffMs = d - now;
    if (diffMs < 0) return "Overdue";
    const h = Math.floor(diffMs / (1e3 * 60 * 60));
    const d2 = Math.floor(h / 24);
    if (h < 1) return Math.floor(diffMs / (1e3 * 60)) + "m";
    if (d2 > 0) return d2 + "d " + h % 24 + "h";
    return h + "h";
  }
  function fmtCompact2(n) {
    if (n == null || n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toLocaleString();
  }
  function fmtDuration(s) {
    if (s == null || s === 0) return "\u2014";
    const seconds = Math.round(s);
    if (seconds < 60) return seconds + "s";
    const m = Math.floor(seconds / 60);
    const rem = seconds % 60;
    if (m < 60) return rem > 0 ? m + "m " + rem + "s" : m + "m";
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return remM > 0 ? h + "h " + remM + "m" : h + "h";
  }
  function fmtSyncAge(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const now = /* @__PURE__ */ new Date();
    const diffSec = Math.floor((now - d) / 1e3);
    if (diffSec < 60) return { text: diffSec + "s ago", color: "#4ade80" };
    if (diffSec < 3600) return { text: Math.floor(diffSec / 60) + "m ago", color: "#4ade80" };
    if (diffSec < 86400) return { text: Math.floor(diffSec / 3600) + "h ago", color: null };
    if (diffSec < 604800) return { text: Math.floor(diffSec / 86400) + "d ago", color: "#f59e0b" };
    return { text: Math.floor(diffSec / 86400) + "d ago", color: "#ef4444" };
  }
  function paceColor(pace) {
    if (pace == null) return "var(--foreground-base, var(--foreground))";
    if (pace < 1) return "#4ade80";
    if (pace < 2) return null;
    return "#ef4444";
  }
  function paceBg(pace) {
    return "transparent";
  }

  // src/components/JobDetailView.js
  var COLUMNS = [
    { label: "Time", key: "run_time", align: "left" },
    { label: "Cost", key: "estimated_cost_usd", align: "right" },
    { label: "Duration", key: "duration_seconds", align: "right" },
    { label: "Tokens", key: "input_tokens", align: "right" },
    { label: "Model", key: "model", align: "left" },
    { label: "Mode", key: "job_mode", align: "center" },
    { label: "Result", key: "success", align: "center" }
  ];
  function tokTotal(r) {
    return (r.input_tokens || 0) + (r.output_tokens || 0) + (r.cache_read_tokens || 0) + (r.cache_write_tokens || 0);
  }
  function JobDetailView({ jobId, jobName, days, outcome, sortKey, sortDir }) {
    const [sKey, setSKey] = useState(sortKey);
    const [sDir, setSDir] = useState(sortDir);
    const path = `/api/plugins/cronalytics/jobs/${encodeURIComponent(jobId)}/runs?days=${days}&outcome=${outcome}&sort_key=${sKey}&sort_dir=${sDir}&limit=200`;
    const runs = useApi(path);
    const sortedRuns = runs.data && runs.data.runs ? [...runs.data.runs].sort((a, b) => {
      const dir = sDir === "desc" ? -1 : 1;
      const av = a[sKey], bv = b[sKey];
      if (sKey === "input_tokens") return dir * (tokTotal(a) - tokTotal(b));
      if (sKey === "run_time" || sKey === "estimated_cost_usd" || sKey === "duration_seconds") return dir * (av - bv);
      if (sKey === "success") return dir * ((av ? 1 : 0) - (bv ? 1 : 0));
      if (av == null || av === "") return 1;
      if (bv == null || bv === "") return -1;
      return dir * String(av).localeCompare(String(bv));
    }) : [];
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
              marginBottom: "0.2rem"
            }
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
                fontFamily: "var(--theme-font-mono, monospace)"
              }
            },
            jobId
          ),
          React.createElement(
            "span",
            {
              style: {
                fontSize: "0.72rem",
                opacity: 0.45,
                fontFamily: "var(--theme-font-mono, monospace)"
              }
            },
            runs.data && runs.data.runs ? runs.data.runs.length + " run" + (runs.data.runs.length === 1 ? "" : "s") : ""
          )
        )
      ),
      runs.loading ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, "Loading runs...") : runs.error ? React.createElement("div", { style: { color: "#ef4444", padding: "1rem 0" } }, "Error: " + runs.error) : !sortedRuns.length ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, "No runs captured for this job.") : React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "table",
          {
            style: {
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.78rem",
              tableLayout: "fixed"
            }
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
                      whiteSpace: "nowrap"
                    }
                  },
                  col.label + (isActive ? sDir === "desc" ? " \u2193" : " \u2191" : "")
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
                tableLayout: "fixed"
              }
            },
            React.createElement(
              "tbody",
              null,
              sortedRuns.map(
                (r) => React.createElement(
                  "tr",
                  {
                    key: r.session_id,
                    style: { borderBottom: "1px solid rgba(255,255,255,0.04)" }
                  },
                  React.createElement("td", { style: { padding: "0.4rem 0.35rem", whiteSpace: "nowrap" } }, fmtTime(r.run_time)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(r.estimated_cost_usd)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtDuration(r.duration_seconds)),
                  React.createElement(
                    "td",
                    { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)", whiteSpace: "nowrap" } },
                    (() => {
                      const total = tokTotal(r);
                      if (total === 0) return "\u2014";
                      return fmtCompact2(total);
                    })()
                  ),
                  React.createElement("td", { style: { padding: "0.4rem 0.35rem" } }, r.model || "\u2014"),
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", padding: "0.4rem 0.35rem" } },
                    r.job_mode === "no_agent" ? React.createElement(Badge, { size: "xs", style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 } }, "No agent") : React.createElement("span", { style: { fontSize: "0.65rem", opacity: 0.45 } }, "Agent")
                  ),
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", padding: "0.4rem 0.35rem" } },
                    r.success ? React.createElement("span", { style: { color: "#22c55e" } }, "\u2713") : React.createElement("span", { style: { color: "#ef4444" } }, "\u2717")
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  // src/components/HeroBanner.js
  function HeroBanner() {
    const [heroLines, setHeroLines] = useState({ label: "cronalytics", sub: "Observe. Measure. Optimize." });
    useEffect(() => {
      fetch("/dashboard-plugins/cronalytics/dist/hero.txt").then((r) => r.ok ? r.text() : Promise.reject()).then((text) => {
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length >= 2) setHeroLines({ label: lines[0].trim(), sub: lines[1].trim() });
      }).catch(() => {
      });
    }, []);
    return React.createElement(
      "div",
      {
        style: {
          padding: "0.75rem 0 0.5rem 0.75rem",
          marginBottom: "0.5rem",
          borderLeft: "3px solid var(--color-accent)",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))"
        }
      },
      React.createElement(
        "div",
        {
          style: {
            fontFamily: "var(--theme-font-mono, monospace)",
            fontSize: "0.7rem",
            opacity: 0.6,
            marginBottom: "0.15rem"
          }
        },
        "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/",
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

  // src/lib/icons.js
  function CpuIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("path", { d: "M12 20v2" }),
      React.createElement("path", { d: "M12 2v2" }),
      React.createElement("path", { d: "M17 20v2" }),
      React.createElement("path", { d: "M17 2v2" }),
      React.createElement("path", { d: "M2 12h2" }),
      React.createElement("path", { d: "M2 17h2" }),
      React.createElement("path", { d: "M2 7h2" }),
      React.createElement("path", { d: "M20 12h2" }),
      React.createElement("path", { d: "M20 17h2" }),
      React.createElement("path", { d: "M20 7h2" }),
      React.createElement("path", { d: "M7 20v2" }),
      React.createElement("path", { d: "M7 2v2" }),
      React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: 2 }),
      React.createElement("rect", { x: "8", y: "8", width: "8", height: "8", rx: 1 })
    );
  }
  function ClockIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
      React.createElement("path", { d: "M12 6v6l4 2" })
    );
  }
  function RefreshCwIcon(size, opts) {
    opts = opts || {};
    return React.createElement(
      "svg",
      {
        width: size || 14,
        height: size || 14,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: Object.assign({ display: "inline-block", verticalAlign: "middle" }, opts.style || {})
      },
      React.createElement("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
      React.createElement("path", { d: "M21 3v5h-5" }),
      React.createElement("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
      React.createElement("path", { d: "M8 16H3v5" })
    );
  }
  function BanknoteIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("rect", { width: 20, height: 12, x: 2, y: 6, rx: 2 }),
      React.createElement("circle", { cx: 12, cy: 12, r: 2 }),
      React.createElement("path", { d: "M6 12h.01M18 12h.01" })
    );
  }
  function BlocksIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("path", { d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" }),
      React.createElement("rect", { x: "14", y: "2", width: "8", height: "8", rx: 1 })
    );
  }
  function MetronomeIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("path", { d: "M12 11.4V9.1" }),
      React.createElement("path", { d: "m12 17 6.59-6.59" }),
      React.createElement("path", { d: "m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2" }),
      React.createElement("circle", { cx: 20, cy: 9, r: 2 })
    );
  }
  function ZapIcon(size) {
    return React.createElement(
      "svg",
      {
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "inline-block", verticalAlign: "middle" }
      },
      React.createElement("path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" })
    );
  }
  function InfoIcon(props) {
    const { size, style } = props || {};
    return React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: Object.assign({ display: "inline-block", verticalAlign: "middle", cursor: "pointer" }, style || {})
      },
      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
      React.createElement("path", { d: "M12 16v-4" }),
      React.createElement("path", { d: "M12 8h.01" })
    );
  }
  function HelpCircleIcon(props) {
    const { size, style } = props || {};
    return React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size || 16,
        height: size || 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: Object.assign({ display: "inline-block", verticalAlign: "middle" }, style || {})
      },
      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
      React.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
      React.createElement("path", { d: "M12 17h.01" })
    );
  }

  // src/components/SummaryBoard.js
  function SummaryBoard({ summary, days, outcome, onRunsClick, onCostClick, onTokensClick, onPaceClick }) {
    const s = summary || {};
    const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0 ? (s.total_runs - s.previous_period.runs) / s.previous_period.runs * 100 : null;
    const costPct = s.previous_period && s.previous_period.cost != null && s.previous_period.cost !== 0 ? (s.total_estimated_cost - s.previous_period.cost) / s.previous_period.cost * 100 : null;
    const cardHover = {
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "";
      }
    };
    return React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
          alignItems: "stretch"
        }
      },
      // Job Runs
      React.createElement(
        "div",
        {
          style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
          onClick: onRunsClick,
          ...cardHover
        },
        React.createElement(
          Card,
          { style: { flex: 1 } },
          React.createElement(
            CardHeader,
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, ZapIcon(14)),
              React.createElement(CardTitle, null, "Job Runs"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(
            CardContent,
            null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } }, (s.total_runs || 0).toLocaleString()),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: runPct != null ? runPct > 0 ? "#ef4444" : "#4ade80" : null } },
              runPct != null ? (runPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(runPct).toFixed(0) + "%" : "\u2014"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
              "vs prior ",
              days === 0 ? "period" : days + "d"
            )
          )
        )
      ),
      // Cost
      React.createElement(
        "div",
        {
          style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
          onClick: onCostClick,
          ...cardHover
        },
        React.createElement(
          Card,
          { style: { flex: 1 } },
          React.createElement(
            CardHeader,
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, BanknoteIcon(14)),
              React.createElement(CardTitle, null, outcome === "failure" ? "Wasted" : "Cost"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(
            CardContent,
            null,
            React.createElement(
              "div",
              { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: outcome === "failure" ? "#ef4444" : "#f5a623" } },
              fmtCost(s.total_estimated_cost)
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: costPct != null ? costPct > 0 ? "#ef4444" : "#4ade80" : null } },
              costPct != null ? (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "%" : "\u2014"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
              "vs prior ",
              days === 0 ? "period" : days + "d"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.3rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.25rem" } },
              "Actual: ",
              s.total_actual_cost != null ? fmtCost(s.total_actual_cost) : "\u2014"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem" } },
              React.createElement("span", { style: { color: "#4ade80" } }, "\u2713 ", s.success_runs || 0),
              " \xB7 ",
              React.createElement("span", { style: { color: (s.failure_runs || 0) > 0 ? "#ef4444" : null } }, "\u2717 ", s.failure_runs || 0),
              s.failure_cost != null && s.failure_cost > 0 ? " (" + fmtCost(s.failure_cost) + " wasted)" : ""
            )
          )
        )
      ),
      // Tokens
      React.createElement(
        "div",
        {
          style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
          onClick: onTokensClick,
          ...cardHover
        },
        React.createElement(
          Card,
          { style: { flex: 1 } },
          React.createElement(
            CardHeader,
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
              React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, BlocksIcon(14)),
              React.createElement(CardTitle, null, "Tokens"),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(
            CardContent,
            null,
            React.createElement(
              "div",
              { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
              fmtCompact2(s.total_tokens)
            ),
            React.createElement(
              "div",
              { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "In"),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.total_input_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
                ),
                React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact2(s.total_input_tokens))
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Out"),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.total_output_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
                ),
                React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact2(s.total_output_tokens))
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Cached"),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.total_cache_read_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
                ),
                React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact2(s.total_cache_read_tokens))
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
        return React.createElement(
          "div",
          {
            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
            onClick: onPaceClick,
            ...cardHover
          },
          React.createElement(
            Card,
            { style: { flex: 1 } },
            React.createElement(
              CardHeader,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
                React.createElement("span", { style: { lineHeight: 0, filter: "drop-shadow(0 0 4px rgba(255,87,34,0.55))" } }, MetronomeIcon(14)),
                React.createElement(CardTitle, null, "Pace"),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) }
              }, s.pace != null ? s.pace.toFixed(2) + "\xD7" : "\u2014"),
              React.createElement(
                "div",
                { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                  React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Nominal"),
                  React.createElement(
                    "div",
                    { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                    React.createElement("div", { style: { width: Math.min(100, nominalPace / maxPace * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
                  ),
                  React.createElement("span", { style: { width: "4.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(nominalPace))
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                  React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Trend"),
                  React.createElement(
                    "div",
                    { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                    React.createElement("div", { style: { width: Math.min(100, trendPace / maxPace * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
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

  // src/components/LeaderBoard.js
  function LeaderBoard({ jobList, onTopRunsClick, onTopCostClick, onTopTokensClick, onTopPaceClick }) {
    const cardHover = {
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "";
      }
    };
    return React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
          alignItems: "stretch"
        }
      },
      // Top Runs
      (() => {
        const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
        const label = j ? j.name || j.job_id : "\u2014";
        return React.createElement(
          "div",
          {
            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
            onClick: onTopRunsClick,
            ...cardHover
          },
          React.createElement(
            Card,
            { style: { flex: 1 } },
            React.createElement(
              CardHeader,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
                React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, ZapIcon(14)),
                React.createElement(CardTitle, null, "Top Runs"),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, j ? (j.runs || 0).toLocaleString() : "\u2014"),
              React.createElement("div", {
                style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: label
              }, label),
              React.createElement("div", { style: { height: "3rem" } })
            )
          )
        );
      })(),
      // Top Cost
      (() => {
        const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_cost || 0) > (a.total_cost || 0) ? b : a, jobList[0]) : null;
        const label = j ? j.name || j.job_id : "\u2014";
        return React.createElement(
          "div",
          {
            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
            onClick: onTopCostClick,
            ...cardHover
          },
          React.createElement(
            Card,
            { style: { flex: 1 } },
            React.createElement(
              CardHeader,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
                React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BanknoteIcon(14)),
                React.createElement(CardTitle, null, "Top Cost"),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#f5a623", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, j ? fmtCost(j.total_cost) : "\u2014"),
              React.createElement("div", {
                style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: label
              }, label),
              React.createElement("div", { style: { height: "3rem" } })
            )
          )
        );
      })(),
      // Top Tokens
      (() => {
        const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_tokens || 0) > (a.total_tokens || 0) ? b : a, jobList[0]) : null;
        const label = j ? j.name || j.job_id : "\u2014";
        return React.createElement(
          "div",
          {
            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
            onClick: onTopTokensClick,
            ...cardHover
          },
          React.createElement(
            Card,
            { style: { flex: 1 } },
            React.createElement(
              CardHeader,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
                React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BlocksIcon(14)),
                React.createElement(CardTitle, null, "Top Tokens"),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#5b8def", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, j ? fmtCompact2(j.total_tokens) : "\u2014"),
              React.createElement("div", {
                style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: label
              }, label),
              React.createElement("div", { style: { height: "3rem" } })
            )
          )
        );
      })(),
      // Top Pace
      (() => {
        const j = jobList.length > 0 ? jobList.reduce((a, b) => {
          const aPace = a.projections && a.projections.pace != null ? a.projections.pace : -Infinity;
          const bPace = b.projections && b.projections.pace != null ? b.projections.pace : -Infinity;
          return bPace > aPace ? b : a;
        }, jobList[0]) : null;
        const label = j ? j.name || j.job_id : "\u2014";
        const p = j && j.projections && j.projections.pace != null ? j.projections.pace : null;
        return React.createElement(
          "div",
          {
            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
            onClick: onTopPaceClick,
            ...cardHover
          },
          React.createElement(
            Card,
            { style: { flex: 1 } },
            React.createElement(
              CardHeader,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" } },
                React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, MetronomeIcon(14)),
                React.createElement(CardTitle, null, "Top Pace"),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: p != null ? paceColor(p) : null, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, p != null ? p.toFixed(2) + "\xD7" : "\u2014"),
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

  // src/components/ModelBreakdown.js
  function ModelBreakdown({ costByModel }) {
    if (!costByModel || costByModel.length === 0) return null;
    const topModels = costByModel.slice(0, 5);
    const remaining = costByModel.length - 5;
    const maxCost = topModels[0] && topModels[0].total_cost || 1;
    return React.createElement(
      Card,
      { style: { marginBottom: "1.5rem" } },
      React.createElement(
        CardHeader,
        null,
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
          CpuIcon(16),
          React.createElement(CardTitle, null, "Per-Model Breakdown")
        )
      ),
      React.createElement(
        CardContent,
        null,
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "0.15rem" } },
          topModels.map((m) => React.createElement(
            "div",
            {
              key: m.model,
              style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", borderRadius: "0.25rem", cursor: "default", transition: "background 0.15s ease" },
              onMouseEnter: (e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.background = "transparent";
              }
            },
            React.createElement("span", {
              style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, width: "38%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, m.model),
            React.createElement(
              "div",
              {
                style: { flex: 1, background: "rgba(255,255,255,0.04)", height: "0.4rem", borderRadius: "0.2rem", overflow: "hidden" }
              },
              React.createElement("div", {
                style: { width: Math.min(100, (m.total_cost || 0) / maxCost * 100) + "%", background: "#f5a623", height: "100%", borderRadius: "0.2rem", transition: "width 0.5s ease" }
              })
            ),
            React.createElement(
              "span",
              {
                style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.35rem", width: "9rem", justifyContent: "flex-end" }
              },
              React.createElement("span", { style: { color: "#f5a623", width: "4.5rem", textAlign: "right", display: "inline-block" } }, fmtCost(m.total_cost)),
              React.createElement("span", { style: { opacity: 0.45, width: "3.5rem", textAlign: "right", display: "inline-block" } }, "\xB7 " + (m.runs || 0).toLocaleString())
            )
          )),
          remaining > 0 && React.createElement("div", {
            style: { textAlign: "center", fontSize: "0.65rem", opacity: 0.35, marginTop: "0.3rem", fontFamily: "var(--theme-font-mono, monospace)" }
          }, "and " + remaining + " more")
        )
      )
    );
  }

  // src/components/JobBreakdown.js
  function JobBreakdown({
    jobList,
    sortedJobs,
    sortConfig,
    expandedId,
    syncing,
    syncInfo,
    days,
    windowLabel,
    onSync,
    onSort,
    onExpandToggle,
    onSelectJob
  }) {
    return React.createElement(
      Card,
      { style: { marginBottom: "1.5rem" } },
      React.createElement(
        CardHeader,
        null,
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
            ClockIcon(16),
            React.createElement(CardTitle, null, "Jobs Breakdown")
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "0.75rem", alignItems: "center" } },
            React.createElement(
              Button,
              {
                size: "sm",
                outlined: !syncing,
                disabled: syncing,
                onClick: onSync
              },
              syncing ? React.createElement(
                "span",
                { style: { display: "inline-flex", alignItems: "center", gap: "0.35rem" } },
                RefreshCwIcon(14, { style: { animation: "cronalytics-spin 1s linear infinite" } }),
                "Syncing"
              ) : "Sync Now"
            ),
            syncInfo && syncInfo.lastSync && (() => {
              const age = fmtSyncAge(syncInfo.lastSync);
              return age ? React.createElement("span", {
                style: {
                  fontSize: "0.65rem",
                  opacity: age.color ? 1 : 0.45,
                  fontFamily: "var(--theme-font-mono, monospace)",
                  color: age.color || "inherit"
                }
              }, age.text) : null;
            })()
          )
        )
      ),
      React.createElement(
        CardContent,
        null,
        jobList.length === 0 ? React.createElement(
          "div",
          { style: { opacity: 0.6, padding: "1rem 0" } },
          syncing ? "Syncing cron sessions..." : syncInfo && syncInfo.lastSync ? "No jobs in " + windowLabel.toLowerCase() + ". Last sync: " + syncInfo.lastSync.split("T").join(" ").slice(0, 19) + " UTC" : "No cron jobs captured. Click Sync Now to backfill from state.db."
        ) : React.createElement(
          "div",
          { style: { overflow: "auto" } },
          React.createElement(
            "table",
            { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" } },
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                { style: { borderBottom: "1px solid var(--color-border)" } },
                ["Job", "Runs", "Avg Time", "Total Cost", "Avg Cost", "Nominal/mo", "Trend/mo", "Pace"].map((h) => {
                  const isActive = sortConfig.key === h;
                  return React.createElement("th", {
                    key: h,
                    onClick: () => onSort(h),
                    style: {
                      textAlign: h === "Job" ? "left" : "right",
                      padding: "0.5rem 0.35rem",
                      cursor: "pointer",
                      fontFamily: "var(--theme-font-mono, monospace)",
                      fontWeight: 600,
                      userSelect: "none",
                      borderBottom: "2px solid var(--color-border)"
                    },
                    title: h === "Pace" ? "Pace = Trend \xF7 Nominal. Under 1.0\xD7 = under budget. Over 2.0\xD7 = over budget." : void 0
                  }, h + (isActive ? sortConfig.direction === "asc" ? " \u2191" : " \u2193" : ""));
                })
              )
            ),
            React.createElement(
              "tbody",
              null,
              sortedJobs.map((j) => [
                React.createElement(
                  "tr",
                  {
                    key: j.job_id,
                    style: { borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s ease" },
                    onMouseEnter: (e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    },
                    onMouseLeave: (e) => {
                      e.currentTarget.style.background = "transparent";
                    },
                    onClick: () => onExpandToggle(j.job_id)
                  },
                  React.createElement(
                    "td",
                    { style: { padding: "0.4rem 0.35rem" } },
                    React.createElement(
                      "div",
                      { style: { fontSize: "0.78rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.4rem" } },
                      j.name || j.job_id,
                      j.job_mode === "no_agent" && React.createElement(Badge, {
                        size: "xs",
                        style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 }
                      }, "No agent")
                    )
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, (j.runs || 0).toLocaleString()),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtDuration(j.avg_duration)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.total_cost)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_cost)),
                  React.createElement(
                    "td",
                    { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
                    j.projections && j.projections.projected_cost_30d != null ? fmtCost(j.projections.projected_cost_30d) + "/mo" : "\u2014"
                  ),
                  React.createElement(
                    "td",
                    { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontWeight: 500 } },
                    j.projections && j.projections.trend_projected_cost_30d != null ? fmtCost(j.projections.trend_projected_cost_30d) + "/mo" : "\u2014"
                  ),
                  React.createElement(
                    "td",
                    { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
                    React.createElement(
                      "span",
                      {
                        style: {
                          fontWeight: 700,
                          color: paceColor(j.projections && j.projections.pace),
                          background: paceBg(j.projections && j.projections.pace),
                          borderRadius: "0.25rem",
                          padding: "0.15rem 0.4rem",
                          display: "inline-block",
                          fontFamily: "var(--theme-font-mono, monospace)"
                        }
                      },
                      j.projections && j.projections.pace != null ? j.projections.pace.toFixed(2) + "\xD7" : "\u2014"
                    )
                  )
                ),
                expandedId === j.job_id && React.createElement(
                  "tr",
                  { key: j.job_id + "_detail" },
                  React.createElement(
                    "td",
                    { colSpan: 8, style: { padding: "0.6rem 0.35rem 0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", fontSize: "0.72rem" } },
                    React.createElement(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "0.3rem" } },
                      React.createElement(
                        "div",
                        {
                          style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
                        },
                        "Tokens: " + fmtCompact(j.total_tokens) + " total (" + fmtCompact(j.total_input_tokens) + " in / " + fmtCompact(j.total_output_tokens) + " out / " + fmtCompact(j.total_cache_read_tokens) + " cached)"
                      ),
                      React.createElement(
                        "div",
                        {
                          style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
                        },
                        React.createElement("span", { style: { color: "#4ade80" } }, "\u2713 ", j.success_runs || 0),
                        " \xB7 ",
                        React.createElement("span", { style: { color: (j.failure_runs || 0) > 0 ? "#ef4444" : null } }, "\u2717 ", j.failure_runs || 0)
                      ),
                      React.createElement(
                        "div",
                        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
                        React.createElement(
                          "div",
                          {
                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", opacity: 0.7, whiteSpace: "pre", display: "flex", alignItems: "center", gap: "0.5rem" }
                          },
                          j.projections && j.projections.schedule_display ? j.projections.schedule_display : "No schedule",
                          "   Last: ",
                          fmtTime(j.last_run),
                          j.last_model ? "   using " + j.last_model : "",
                          "   Next: ",
                          j.projections && j.projections.next_run_at ? fmtRel(j.projections.next_run_at) : "\u2014",
                          j.job_mode === "no_agent" && React.createElement("span", { style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.5, marginLeft: "0.25rem" } }, "[No agent]")
                        ),
                        React.createElement("button", {
                          type: "button",
                          onClick: (e) => {
                            e.stopPropagation();
                            onSelectJob(j.job_id);
                          },
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
                            whiteSpace: "nowrap"
                          },
                          onMouseEnter: (e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                          },
                          onMouseLeave: (e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                          }
                        }, "See Runs")
                      )
                    )
                  )
                )
              ]).flat()
            )
          )
        )
      )
    );
  }

  // src/components/CronalyticsTab.js
  function CronalyticsTab() {
    const [days, setDaysRaw] = useState(() => {
      try {
        const saved = localStorage.getItem("cronalytics:days");
        if (saved !== null) return Number(saved);
      } catch {
      }
      return 30;
    });
    const setDays = (v) => {
      try {
        localStorage.setItem("cronalytics:days", String(v));
      } catch {
      }
      setDaysRaw(v);
    };
    const [outcome, setOutcomeRaw] = useState(() => {
      try {
        const saved = localStorage.getItem("cronalytics:outcome");
        if (saved) return saved;
      } catch {
      }
      return "both";
    });
    const setOutcome = (v) => {
      try {
        localStorage.setItem("cronalytics:outcome", v);
      } catch {
      }
      setOutcomeRaw(v);
    };
    const [mode, setModeRaw] = useState(() => {
      try {
        const saved = localStorage.getItem("cronalytics:mode");
        if (saved) return saved;
      } catch {
      }
      return "all";
    });
    const setMode = (v) => {
      try {
        localStorage.setItem("cronalytics:mode", v);
      } catch {
      }
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
      fetchJSON("/api/plugins/cronalytics/health").then((d) => {
        if (d && d.sync) {
          setSyncInfo({
            lastSync: d.sync.last_sync,
            rowsSynced: d.sync.rows_synced
          });
        }
      }).catch(() => {
      });
    }, []);
    const onSync = () => {
      if (syncing) return;
      setSyncing(true);
      let cancelled = false;
      let syncResult = null;
      let hasError = false;
      fetchJSON("/api/plugins/cronalytics/sync", { method: "POST" }).then((d) => {
        syncResult = d;
      }).then(() => fetchJSON("/api/plugins/cronalytics/health")).then((d2) => {
        if (!cancelled && d2 && d2.sync) {
          setSyncInfo({
            lastSync: d2.sync.last_sync,
            rowsSynced: d2.sync.rows_synced
          });
        }
      }).catch((e) => {
        if (!cancelled) {
          setSyncInfo({ error: e.message });
          hasError = true;
        }
      }).then(() => {
        if (cancelled || hasError) {
          if (!cancelled) setSyncing(false);
          return;
        }
      }).then(() => {
        if (cancelled || hasError) return;
        setSyncing(false);
        if (syncResult && syncResult.result) {
          const { inserted, elapsed_ms } = syncResult.result;
          setSyncToast({ msg: "\u2713 Synced " + inserted + " runs \xB7 " + (elapsed_ms / 1e3).toFixed(1) + "s" });
          setTimeout(() => setSyncToast(null), 5e3);
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
      return React.createElement(
        "div",
        { style: { padding: "0 0.25rem 1rem 0", color: "var(--color-destructive)" } },
        "Error: " + (summary.error || jobs.error)
      );
    }
    const s = summary.data || {};
    const jobList = jobs.data && jobs.data.jobs ? jobs.data.jobs : [];
    const windowLabel = days === 0 ? "All time" : "Last " + days + " days";
    const costPct = s.previous_period && s.previous_period.cost != null && s.previous_period.cost !== 0 ? (s.total_estimated_cost - s.previous_period.cost) / s.previous_period.cost * 100 : null;
    const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0 ? (s.total_runs - s.previous_period.runs) / s.previous_period.runs * 100 : null;
    const getSortValue = (j, key) => {
      switch (key) {
        case "Job":
          return j.name || j.job_id;
        case "Runs":
          return j.runs || 0;
        case "Avg Time":
          return j.avg_duration || 0;
        case "Total Cost":
          return j.total_cost || 0;
        case "Avg Cost":
          return j.avg_cost || 0;
        case "Nominal/mo":
          return j.projections && j.projections.projected_cost_30d != null ? j.projections.projected_cost_30d : -Infinity;
        case "Trend/mo":
          return j.projections && j.projections.trend_projected_cost_30d != null ? j.projections.trend_projected_cost_30d : -Infinity;
        case "Pace":
          return j.projections && j.projections.pace != null ? j.projections.pace : -Infinity;
        default:
          return 0;
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
    return React.createElement(
      "div",
      {
        style: {
          padding: "0 0.25rem 1rem 0",
          color: "var(--foreground-base, var(--foreground))",
          position: "relative"
        }
      },
      // Spinner animation keyframe
      React.createElement("style", {}, `@keyframes cronalytics-spin { to { transform: rotate(360deg); } }`),
      React.createElement(HeroBanner),
      // Sticky toolbar
      React.createElement(
        "div",
        {
          style: {
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem 0.75rem",
            padding: "0.5rem 0",
            marginBottom: "0.5rem",
            background: "var(--background, rgba(12,12,12,0.88))",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))"
          }
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" } },
          React.createElement(OutcomeToggle, { selected: outcome, onChange: setOutcome, label: "Outcomes" }),
          React.createElement(ModeToggle, { selected: mode, onChange: setMode, label: "Mode" })
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" } },
          React.createElement(DaySelector, { selected: days, onChange: setDays }),
          React.createElement(
            Button,
            {
              type: "button",
              size: "sm",
              outlined: true,
              disabled: summary.loading || jobs.loading,
              onClick: () => {
                summary.refetch();
                jobs.refetch();
              },
              style: { minWidth: "5.5rem" }
            },
            summary.loading || jobs.loading ? "\u2026" : React.createElement(
              "span",
              { style: { display: "flex", alignItems: "center", gap: "0.25rem" } },
              RefreshCwIcon(14),
              "Refresh"
            )
          )
        )
      ),
      // Job Detail Modal
      React.createElement(Modal, {
        isOpen: !!selectedJobId,
        onClose: () => setSelectedJobId(null),
        maxWidth: "95%"
      }, selectedJobId && React.createElement(JobDetailView, {
        key: selectedJobId,
        jobId: selectedJobId,
        jobName: (jobList.find((j) => j.job_id === selectedJobId) || {}).name,
        days,
        outcome,
        sortKey: { "Job": "run_time", "Runs": "run_time", "Avg Time": "duration_seconds", "Total Cost": "estimated_cost_usd", "Avg Cost": "estimated_cost_usd", "Nominal/mo": "run_time", "Trend/mo": "run_time", "Pace": "run_time" }[sortConfig.key] || "run_time",
        sortDir: sortConfig.direction || "desc"
      })),
      React.createElement(SummaryBoard, {
        summary: s,
        days,
        outcome,
        onRunsClick: runsModal.open,
        onCostClick: costModal.open,
        onTokensClick: tokensModal.open,
        onPaceClick: paceModal.open
      }),
      React.createElement(LeaderBoard, {
        jobList,
        onTopRunsClick: topRunsModal.open,
        onTopCostClick: topCostModal.open,
        onTopTokensClick: topTokensModal.open,
        onTopPaceClick: topPaceModal.open
      }),
      // ── Pace Modal ───────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: paceModal.isOpen, onClose: paceModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
            React.createElement(
              "span",
              { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) } },
              s.pace != null ? s.pace.toFixed(2) + "\xD7" : "\u2014"
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Pace")
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "1rem" } },
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Nominal"),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.nominal_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1) * 100) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
                ),
                React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(s.nominal_monthly_total) + "/mo")
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Trend"),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.trend_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1) * 100) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
                ),
                React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(s.trend_monthly_total) + "/mo")
              )
            )
          ),
          React.createElement(
            "div",
            { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem", textTransform: "none" } },
              "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019"
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "How it\u2019s calculated"),
            React.createElement(
              "div",
              { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6, textTransform: "none" } },
              React.createElement("div", null, "Nominal = scheduled runs \xD7 average cost per run"),
              React.createElement("div", null, "Trend     = actual runs \xD7 average cost per run"),
              React.createElement("div", null, "Pace      = Trend / Nominal"),
              React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6, textTransform: "none" } }, "All scaled to a 30\u2011day month using the selected window.")
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Color guide"),
            React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", marginBottom: "0.75rem", textTransform: "none" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#4ade80" } }),
                React.createElement("span", null, "Green (< 1.0\xD7) \u2014 Under budget. Spending less than scheduled.")
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "var(--foreground)" } }),
                React.createElement("span", null, "Neutral (1.0\u20132.0\xD7) \u2014 On track. Slight variance within normal range.")
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#ef4444" } }),
                React.createElement("span", null, "Red (\u2265 2.0\xD7) \u2014 Over budget. Actual spend is double (or more) the nominal rate.")
              )
            )
          )
        )
      ),
      // ── Runs Modal ─────────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: runsModal.isOpen, onClose: runsModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
            React.createElement(
              "span",
              { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
              (s.total_runs || 0).toLocaleString()
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Job Runs")
          ),
          runPct != null && React.createElement(
            "div",
            { style: { marginBottom: "1rem" } },
            React.createElement(
              "div",
              { style: { fontSize: "0.82rem", color: runPct > 0 ? "#ef4444" : "#4ade80" } },
              (runPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(runPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
            )
          ),
          React.createElement(
            "div",
            { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
              "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task\u2014whether it succeeds, fails, or retries."
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
            React.createElement(
              "div",
              { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
              React.createElement("div", null, "Trend % = ((current runs \u2212 prior runs) / prior runs) \xD7 100"),
              React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6 } }, "Positive = more runs than the prior window. Negative = fewer runs.")
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
              "Showing ",
              React.createElement("strong", null, windowLabel),
              ". The prior comparison window is the same duration shifted back in time."
            )
          )
        )
      ),
      // ── Cost Modal ─────────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: costModal.isOpen, onClose: costModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
            React.createElement(
              "span",
              { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
              fmtCost(s.total_estimated_cost)
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Estimated Cost")
          ),
          s.total_actual_cost != null && React.createElement(
            "div",
            { style: { marginBottom: "0.75rem", fontSize: "0.8rem", opacity: 0.85 } },
            "Actual: ",
            React.createElement("span", { style: { fontWeight: 700 } }, fmtCost(s.total_actual_cost))
          ),
          costPct != null && React.createElement(
            "div",
            { style: { marginBottom: "1rem" } },
            React.createElement(
              "div",
              { style: { fontSize: "0.82rem", color: costPct > 0 ? "#ef4444" : "#4ade80" } },
              (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
            )
          ),
          React.createElement(
            "div",
            { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
              "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity."
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
            React.createElement(
              "div",
              { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
              React.createElement("div", null, "Trend % = ((current cost \u2212 prior cost) / prior cost) \xD7 100")
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
              "Showing ",
              React.createElement("strong", null, windowLabel),
              ". The prior comparison window is the same duration shifted back in time."
            )
          )
        )
      ),
      // ── Tokens Modal ───────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: tokensModal.isOpen, onClose: tokensModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
            React.createElement(
              "span",
              { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
              fmtCompact2(s.total_tokens)
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Tokens")
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "In"),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_input_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact2(s.total_input_tokens))
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Out"),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_output_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact2(s.total_output_tokens))
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Cached"),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_cache_read_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact2(s.total_cache_read_tokens))
            )
          ),
          React.createElement(
            "div",
            { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
            React.createElement(
              "p",
              { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
              "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper)."
            ),
            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Breakdown"),
            React.createElement(
              "div",
              { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
              React.createElement("div", null, "Input:  " + fmtCompact2(s.total_input_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_input_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
              React.createElement("div", null, "Output: " + fmtCompact2(s.total_output_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_output_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
              React.createElement("div", null, "Cached: " + fmtCompact2(s.total_cache_read_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_cache_read_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)")
            )
          )
        )
      ),
      // ── Top Runs Modal ─────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: topRunsModal.isOpen, onClose: topRunsModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          (() => {
            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
            const label = j ? j.name || j.job_id : "\u2014";
            return React.createElement(
              "div",
              null,
              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
                React.createElement(
                  "span",
                  { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
                  j ? (j.runs || 0).toLocaleString() : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "runs")
              ),
              j && React.createElement(
                "div",
                { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
                React.createElement(
                  "div",
                  { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                  React.createElement("div", null, "Schedule: " + (j.schedule && j.schedule.display || "\u2014")),
                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                  React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                  React.createElement("div", null, "Avg duration: " + (j.avg_duration != null ? fmtDuration(j.avg_duration) : "\u2014")),
                  React.createElement("div", null, "Tokens: " + (j.total_tokens != null ? fmtCompact2(j.total_tokens) : "\u2014"))
                )
              )
            );
          })()
        )
      ),
      // ── Top Cost Modal ─────────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: topCostModal.isOpen, onClose: topCostModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          (() => {
            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_cost || 0) > (a.total_cost || 0) ? b : a, jobList[0]) : null;
            const label = j ? j.name || j.job_id : "\u2014";
            return React.createElement(
              "div",
              null,
              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
                React.createElement(
                  "span",
                  { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
                  j ? fmtCost(j.total_cost) : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "total cost")
              ),
              j && React.createElement(
                "div",
                { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
                React.createElement(
                  "div",
                  { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                  React.createElement("div", null, "Schedule: " + (j.schedule && j.schedule.display || "\u2014")),
                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                  React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                  React.createElement("div", null, "Avg duration: " + (j.avg_duration != null ? fmtDuration(j.avg_duration) : "\u2014")),
                  React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \xB7 Avg: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
                )
              )
            );
          })()
        )
      ),
      // ── Top Tokens Modal ───────────────────────────────────────────────
      React.createElement(
        Modal,
        { isOpen: topTokensModal.isOpen, onClose: topTokensModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          (() => {
            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_tokens || 0) > (a.total_tokens || 0) ? b : a, jobList[0]) : null;
            const label = j ? j.name || j.job_id : "\u2014";
            return React.createElement(
              "div",
              null,
              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
                React.createElement(
                  "span",
                  { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
                  j ? fmtCompact2(j.total_tokens) : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "tokens")
              ),
              j && React.createElement(
                "div",
                { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
                React.createElement(
                  "div",
                  { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                  React.createElement("div", null, "Schedule: " + (j.schedule && j.schedule.display || "\u2014")),
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
      React.createElement(
        Modal,
        { isOpen: topPaceModal.isOpen, onClose: topPaceModal.close },
        React.createElement(
          "div",
          { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)", textTransform: "none" } },
          (() => {
            const j = jobList.length > 0 ? jobList.reduce((a, b) => {
              const aPace = a.projections && a.projections.pace != null ? a.projections.pace : -Infinity;
              const bPace = b.projections && b.projections.pace != null ? b.projections.pace : -Infinity;
              return bPace > aPace ? b : a;
            }, jobList[0]) : null;
            const label = j ? j.name || j.job_id : "\u2014";
            const p = j && j.projections && j.projections.pace != null ? j.projections.pace : null;
            return React.createElement(
              "div",
              null,
              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
                React.createElement(
                  "span",
                  { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(p) } },
                  p != null ? p.toFixed(2) + "\xD7" : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "pace")
              ),
              React.createElement(
                "div",
                { style: { marginBottom: "1rem" } },
                React.createElement(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                    React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Nominal/mo"),
                    React.createElement(
                      "div",
                      { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                      React.createElement("div", { style: { width: Math.min(100, (j && j.projections && j.projections.projected_cost_30d || 1) / Math.max(j && j.projections && j.projections.projected_cost_30d || 1, j && j.projections && j.projections.trend_projected_cost_30d || 1, 1) * 100) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
                    ),
                    React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(j && j.projections ? j.projections.projected_cost_30d : null) + "/mo")
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                    React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Trend/mo"),
                    React.createElement(
                      "div",
                      { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                      React.createElement("div", { style: { width: Math.min(100, (j && j.projections && j.projections.trend_projected_cost_30d || 1) / Math.max(j && j.projections && j.projections.projected_cost_30d || 1, j && j.projections && j.projections.trend_projected_cost_30d || 1, 1) * 100) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
                    ),
                    React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(j && j.projections ? j.projections.trend_projected_cost_30d : null) + "/mo")
                  )
                )
              ),
              j && React.createElement(
                "div",
                { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
                React.createElement(
                  "div",
                  { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
                  React.createElement("div", null, "Schedule: " + (j.schedule && j.schedule.display || "\u2014")),
                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
                  React.createElement("div", null, "Model: " + (j.last_model || "\u2014")),
                  React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \xB7 Avg cost: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
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
        onSort: (h) => setSortConfig((prev) => ({ key: h, direction: prev.key === h && prev.direction === "asc" ? "desc" : "asc" })),
        onExpandToggle: (id) => setExpandedId(expandedId === id ? null : id),
        onSelectJob: setSelectedJobId
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
          zIndex: 1e4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap"
        }
      }, syncToast.msg)
    );
  }

  // src/index.js
  PLUGINS.register("cronalytics", function CronalyticsWrapped() {
    return React.createElement(
      PluginErrorBoundary,
      null,
      React.createElement(CronalyticsTab)
    );
  });
})();
