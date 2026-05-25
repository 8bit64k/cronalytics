(() => {
  // dashboard/src/lib/sdk.js
  var SDK = window.__HERMES_PLUGIN_SDK__;
  var PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) {
    throw new Error("Cronalytics: Hermes SDK not available");
  }
  var React = SDK.React;
  var { useState, useEffect, useRef, useMemo } = SDK.hooks;
  var fetchJSON = SDK.fetchJSON;
  var { Card, CardHeader, CardTitle, CardContent, Badge, Button } = SDK.components;

  // dashboard/src/components/ErrorBoundary.js
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
              textAlign: "center",
              fontFamily: "var(--theme-font-mono, monospace)",
              color: "var(--foreground)"
            }
          },
          React.createElement("h3", { style: { marginBottom: "0.5rem" } }, "Cronalytics Error"),
          React.createElement("p", { style: { opacity: 0.7 } }, "Something went wrong. Please refresh or contact support.")
        );
      }
      return this.props.children;
    }
  };

  // dashboard/src/lib/validate.js
  var IS_DEV = (() => {
    try {
      return typeof process !== "undefined" && process.env && false;
    } catch {
      return false;
    }
  })();
  function assertType(endpoint, value, expected, path = "root") {
    if (!IS_DEV) return;
    const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    let ok;
    if (expected === Array) ok = Array.isArray(value);
    else if (expected === Object) ok = value !== null && typeof value === "object" && !Array.isArray(value);
    else if (expected === "null") ok = value === null;
    else ok = actual === expected;
    if (!ok) {
      console.error(
        `[Cronalytics API] ${endpoint}: expected ${path} to be ${expected.name || expected}, got ${actual}`
      );
    }
  }
  function validateHealth(d) {
    assertType("/health", d, Object);
    assertType("/health", d.plugin, "string", "plugin");
    assertType("/health", d.status, "string", "status");
    assertType("/health", d.fact_db, Object, "fact_db");
    assertType("/health", d.sync, Object, "sync");
    assertType("/health", d.version, "string", "version");
  }
  function validateSync(d) {
    assertType("/sync", d, Object);
    assertType("/sync", d.synced, "boolean", "synced");
    assertType("/sync", d.result, Object, "result");
  }
  function validateSummary(d) {
    assertType("/summary", d, Object);
    assertType("/summary", d.total_runs, "number", "total_runs");
    assertType("/summary", d.tot_estimated_cost, "number", "tot_estimated_cost");
    assertType("/summary", d.total_tokens, "number", "total_tokens");
    assertType("/summary", d.success_runs, "number", "success_runs");
    assertType("/summary", d.failure_runs, "number", "failure_runs");
    assertType("/summary", d.previous_period, "object", "previous_period");
  }
  function validateJobs(d) {
    assertType("/jobs", d, Object);
    assertType("/jobs", d.days, "number", "days");
    assertType("/jobs", d.jobs, Array, "jobs");
    if (IS_DEV && Array.isArray(d.jobs)) {
      d.jobs.forEach((j, i) => {
        assertType("/jobs", j.job_id, "string", `jobs[${i}].job_id`);
        assertType("/jobs", j.runs, "number", `jobs[${i}].runs`);
        assertType("/jobs", j.tot_estimated_cost, "number", `jobs[${i}].tot_estimated_cost`);
        assertType("/jobs", j.projections, "object", `jobs[${i}].projections`);
      });
    }
  }
  function validateJobRuns(d) {
    assertType("/jobs/:id/runs", d, Object);
    assertType("/jobs/:id/runs", d.job_id, "string", "job_id");
    assertType("/jobs/:id/runs", d.limit, "number", "limit");
    assertType("/jobs/:id/runs", d.runs, Array, "runs");
    if (d.total_runs != null) {
      assertType("/jobs/:id/runs", d.total_runs, "number", "total_runs");
    }
    if (d.more_available != null) {
      assertType("/jobs/:id/runs", d.more_available, "boolean", "more_available");
    }
    if (IS_DEV && Array.isArray(d.runs)) {
      d.runs.forEach((r, i) => {
        assertType("/jobs/:id/runs", r.session_id, "string", `runs[${i}].session_id`);
        assertType("/jobs/:id/runs", r.run_time, "number", `runs[${i}].run_time`);
        assertType("/jobs/:id/runs", r.estimated_cost, "number", `runs[${i}].estimated_cost`);
      });
    }
  }
  function validateModels(d) {
    assertType("/models", d, Object);
    assertType("/models", d.models, Array, "models");
    if (IS_DEV && Array.isArray(d.models)) {
      d.models.forEach((m, i) => {
        assertType("/models", m.model, "string", `models[${i}].model`);
        assertType("/models", m.runs, "number", `models[${i}].runs`);
        assertType("/models", m.tot_estimated_cost, "number", `models[${i}].tot_estimated_cost`);
      });
    }
  }
  function validateTrends(d) {
    assertType("/trends", d, Object);
    assertType("/trends", d.trend, Array, "trend");
    if (IS_DEV && Array.isArray(d.trend)) {
      d.trend.forEach((t, i) => {
        assertType("/trends", t.day, "string", `trend[${i}].day`);
        assertType("/trends", t.estimated_cost, "number", `trend[${i}].estimated_cost`);
        assertType("/trends", t.runs, "number", `trend[${i}].runs`);
      });
    }
  }
  function validatorForPath(path) {
    if (path.includes("/health")) return validateHealth;
    if (path.includes("/sync")) return validateSync;
    if (path.includes("/summary")) return validateSummary;
    if (path.includes("/jobs/") && path.includes("/runs")) return validateJobRuns;
    if (path.includes("/jobs")) return validateJobs;
    if (path.includes("/models")) return validateModels;
    if (path.includes("/trends")) return validateTrends;
    return void 0;
  }

  // dashboard/src/hooks/useApi.js
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
          const validate = validatorForPath(path);
          if (validate) {
            try {
              validate(d);
            } catch (e) {
            }
          }
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

  // dashboard/src/i18n/index.js
  var CATALOGS = {};
  function registerCatalog(lang, messages) {
    CATALOGS[lang] = messages;
  }
  function getSDK() {
    return window.__HERMES_PLUGIN_SDK__ || {};
  }
  function getLocale() {
    const sdk = getSDK();
    let code = "en";
    if (sdk.useI18n) {
      try {
        code = sdk.useI18n().locale || "en";
      } catch {
      }
    } else {
      code = navigator.language || "en";
    }
    if (CATALOGS[code]) return code;
    const base = code.split("-")[0];
    if (CATALOGS[base]) return base;
    return "en";
  }
  function resolve(key, catalog) {
    const parts = key.split(".");
    let node = catalog;
    for (const p of parts) {
      if (node == null || typeof node !== "object") return void 0;
      node = node[p];
    }
    return typeof node === "string" ? node : void 0;
  }
  function interpolate(template, vars) {
    if (!vars || typeof template !== "string") return template;
    return template.replace(/\{(\w+)\}/g, (_match, name) => {
      return vars[name] !== void 0 ? String(vars[name]) : _match;
    });
  }
  function useCronalyticsI18n() {
    const locale = getLocale();
    const catalog = CATALOGS[locale] || CATALOGS["en"] || {};
    return function t(key, fallbackOrVars, maybeVars) {
      let fallback;
      let vars;
      if (typeof fallbackOrVars === "string") {
        fallback = fallbackOrVars;
        vars = maybeVars;
      } else {
        fallback = key;
        vars = fallbackOrVars;
      }
      return interpolate(resolve(key, catalog) ?? fallback, vars);
    };
  }

  // dashboard/src/components/Modal.js
  function Modal({ isOpen, onClose, children, maxWidth }) {
    const t = useCronalyticsI18n();
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
            "aria-label": t("modal.close", "Close"),
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

  // dashboard/src/components/DaySelector.js
  var PRESETS = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "90D", value: 90 }
  ];
  var MAX_DAYS = 365;
  function DaySelector({ selected, onChange, label = null }) {
    const t = useCronalyticsI18n();
    const [custom, setCustom] = useState("");
    const applyCustom = () => {
      const v = parseInt(custom, 10);
      onChange(isNaN(v) || v < 0 ? 0 : Math.min(v, MAX_DAYS));
    };
    const elements = [
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
            title: t("day_selector.apply_custom", "Apply custom days")
          },
          t("day_selector.go", "Go")
        )
      )
    ];
    if (label) {
      elements.unshift(
        React.createElement(
          "span",
          {
            key: "label",
            style: {
              fontFamily: "var(--theme-font-mono, monospace)",
              fontSize: "0.65rem",
              fontWeight: 700,
              opacity: 0.7,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginRight: "0.25rem"
            }
          },
          label
        )
      );
    }
    return elements;
  }

  // dashboard/src/components/OutcomeToggle.js
  function OutcomeToggle({ selected, onChange, label }) {
    const t = useCronalyticsI18n();
    const OPTIONS = [
      { label: t("outcome_toggle.all", "All"), value: "all" },
      { label: t("outcome_toggle.success", "Success"), value: "success" },
      { label: t("outcome_toggle.failure", "Failure"), value: "failure" }
    ];
    return React.createElement(
      "div",
      { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
      label ? React.createElement(
        "span",
        {
          style: {
            fontFamily: "var(--theme-font-mono, monospace)",
            fontSize: "0.65rem",
            fontWeight: 700,
            opacity: 0.7,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
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

  // dashboard/src/components/ModeToggle.js
  function ModeToggle({ selected, onChange, label }) {
    const t = useCronalyticsI18n();
    const OPTIONS = [
      { label: t("mode_toggle.all", "All"), value: "all" },
      { label: t("mode_toggle.agent", "Agent"), value: "agent" },
      { label: t("mode_toggle.no_agent", "No Agent"), value: "no_agent" }
    ];
    return React.createElement(
      "div",
      { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
      label ? React.createElement(
        "span",
        {
          style: {
            fontFamily: "var(--theme-font-mono, monospace)",
            fontSize: "0.65rem",
            fontWeight: 700,
            opacity: 0.7,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
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

  // dashboard/src/lib/formatters.js
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
  function fmtCompact(n) {
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

  // dashboard/src/components/JobDetailView.js
  function JobDetailView({ jobId, jobName, days, outcome, sortKey, sortDir }) {
    const t = useCronalyticsI18n();
    const [sKey, setSKey] = useState(sortKey);
    const [sDir, setSDir] = useState(sortDir);
    const COLUMNS = [
      { label: t("job_detail.time", "Time"), key: "run_time", align: "left", width: "10rem" },
      { label: t("job_detail.est_cost", "Est Cost"), key: "estimated_cost", align: "right", width: "6rem" },
      { label: t("job_detail.duration", "Duration"), key: "duration_seconds", align: "right", width: "5rem" },
      { label: t("summary.tokens", "Tokens"), key: "input_tokens", align: "right", width: "6rem" },
      { label: t("model_breakdown.model", "Model"), key: "model", align: "left", width: "auto" },
      { label: t("job_detail.mode", "Mode"), key: "job_mode", align: "center", width: "4rem" },
      { label: t("job_detail.result", "Result"), key: "success", align: "center", width: "3.5rem" }
    ];
    function tokTotal(r) {
      return (r.input_tokens || 0) + (r.output_tokens || 0) + (r.cache_read_tokens || 0) + (r.cache_write_tokens || 0);
    }
    const path = `/api/plugins/cronalytics/jobs/${encodeURIComponent(jobId)}/runs?days=${days}&outcome=${outcome}&sort_key=${sKey}&sort_dir=${sDir}&limit=250`;
    const runs = useApi(path);
    const sortedRuns = runs.data && runs.data.runs ? [...runs.data.runs].sort((a, b) => {
      const dir = sDir === "desc" ? -1 : 1;
      const av = a[sKey], bv = b[sKey];
      if (sKey === "input_tokens") return dir * (tokTotal(a) - tokTotal(b));
      if (sKey === "run_time" || sKey === "estimated_cost" || sKey === "duration_seconds") return dir * (av - bv);
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
            runs.data && runs.data.runs ? runs.data.runs.length + " " + t("job_detail.run", "run") + (runs.data.runs.length === 1 ? "" : "s") : ""
          )
        )
      ),
      runs.loading ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, t("job_detail.loading", "Loading runs...")) : runs.error ? React.createElement("div", { style: { color: "#ef4444", padding: "1rem 0" } }, t("job_detail.error_prefix", "Error: ") + runs.error) : !sortedRuns.length ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } }, t("job_detail.no_runs", "No runs captured for this job.")) : React.createElement(
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
                      whiteSpace: "nowrap",
                      width: col.width || "auto"
                    }
                  },
                  [
                    col.label,
                    React.createElement("span", {
                      key: "arrow",
                      style: { display: "inline-block", width: "1em", marginLeft: "0.15rem", textAlign: "center" }
                    }, isActive ? sDir === "desc" ? "\u2193" : "\u2191" : "")
                  ]
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
                  React.createElement("td", { style: { padding: "0.4rem 0.35rem", whiteSpace: "nowrap", width: "10rem" } }, fmtTime(r.run_time)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 1.85rem 0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)", width: "6rem" } }, fmtCost(r.estimated_cost)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 1.35rem 0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)", width: "5rem" } }, fmtDuration(r.duration_seconds)),
                  React.createElement(
                    "td",
                    { style: { textAlign: "right", padding: "0.4rem 1.35rem 0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)", whiteSpace: "nowrap", width: "6rem" } },
                    (() => {
                      const total = tokTotal(r);
                      if (total === 0) return "\u2014";
                      return fmtCompact(total);
                    })()
                  ),
                  React.createElement("td", { style: { padding: "0.4rem 0.35rem", overflow: "hidden", textOverflow: "ellipsis", width: "auto" } }, r.model || "\u2014"),
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", padding: "0.4rem 0.35rem", width: "4rem" } },
                    r.job_mode === "no_agent" ? React.createElement(Badge, { size: "xs", style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.7 } }, t("job_breakdown.mode_no_agent", "No agent")) : React.createElement("span", { style: { fontSize: "0.65rem", opacity: 0.45 } }, t("mode_toggle.agent", "Agent"))
                  ),
                  React.createElement(
                    "td",
                    { style: { textAlign: "center", padding: "0.4rem 0.35rem", width: "3.5rem" } },
                    r.success ? React.createElement("span", { style: { color: "#22c55e" } }, "\u2713") : React.createElement("span", { style: { color: "#ef4444" } }, "\u2717")
                  )
                )
              )
            )
          )
        ),
        runs.data && runs.data.more_available && React.createElement(
          "div",
          {
            style: {
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              fontSize: "0.72rem",
              opacity: 0.7,
              background: "rgba(255,255,255,0.03)",
              borderRadius: "0.35rem",
              lineHeight: 1.5
            }
          },
          t("job_detail.showing", "Showing "),
          runs.data.runs.length,
          t("job_detail.of", " of "),
          runs.data.total_runs.toLocaleString(),
          " ",
          t("job_detail.runs_plural", "runs"),
          ". ",
          t("job_detail.use_cli", "Use "),
          React.createElement(
            "code",
            { style: { fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.9 } },
            "cronalytics runs --job " + jobId + " --days " + (days === 0 ? "0" : days)
          ),
          t("job_detail.for_full_history", " for full history.")
        )
      )
    );
  }

  // dashboard/src/components/HeroBanner.js
  function HeroBanner() {
    const t = useCronalyticsI18n();
    const [collapsed, setCollapsed] = useState(() => {
      try {
        return localStorage.getItem("cronalytics:hero:collapsed") === "1";
      } catch {
        return false;
      }
    });
    const toggle = () => {
      const next = !collapsed;
      try {
        localStorage.setItem("cronalytics:hero:collapsed", next ? "1" : "0");
      } catch {
      }
      setCollapsed(next);
    };
    if (collapsed) {
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.3rem 0.5rem 0.3rem 0.75rem",
            marginBottom: "0.5rem",
            borderLeft: "3px solid var(--color-accent)",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
            cursor: "pointer"
          },
          onClick: toggle,
          title: t("hero.expand_tooltip", "Expand hero banner")
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "baseline", gap: "0.5rem" } },
          React.createElement("span", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" } }, t("hero.title", "CRONALYTICS")),
          React.createElement("span", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.65rem", opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase" } }, t("hero.tagline", "Observe. Measure. Optimize."))
        ),
        React.createElement("span", { style: { fontSize: "0.7rem", opacity: 0.5 } }, "\u25BC")
      );
    }
    return React.createElement(
      "div",
      {
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
          borderRadius: "0.2rem"
        }
      }, "\u25B2"),
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
        t("hero.pronunciation", "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/"),
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

  // dashboard/src/lib/icons.js
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

  // dashboard/src/components/SummaryBoard.js
  function SummaryBoard({ summary, days, outcome, onRunsClick, onCostClick, onTokensClick, onPaceClick }) {
    const t = useCronalyticsI18n();
    const s = summary || {};
    const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0 ? (s.total_runs - s.previous_period.runs) / s.previous_period.runs * 100 : null;
    const costPct = s.previous_period && s.previous_period.estimated_cost != null && s.previous_period.estimated_cost !== 0 ? (s.tot_estimated_cost - s.previous_period.estimated_cost) / s.previous_period.estimated_cost * 100 : null;
    const cardHover = {
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "";
      }
    };
    const cardProps = (onClick, label, extraStyle) => ({
      style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column", ...extraStyle || {} },
      tabIndex: 0,
      role: "button",
      "aria-label": label,
      onClick,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      },
      onMouseEnter: cardHover.onMouseEnter,
      onMouseLeave: cardHover.onMouseLeave
    });
    return React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
          alignItems: "stretch"
        }
      },
      // Job Runs
      React.createElement(
        "div",
        cardProps(onRunsClick, t("summary.job_runs", "Job Runs") + " details", { minWidth: 0, overflow: "hidden" }),
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
              React.createElement(CardTitle, null, t("summary.job_runs", "Job Runs")),
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
              t("summary.vs_prior", "vs prior") + " ",
              days === 0 ? t("summary.period", "period") : days + "d"
            )
          )
        )
      ),
      // Cost
      React.createElement(
        "div",
        cardProps(onCostClick, outcome === "failure" ? t("summary.estimated", "Est") + " " + t("summary.wasted", "Wasted") + " cost details" : t("summary.estimated", "Est") + " cost details", { minWidth: 0, overflow: "hidden" }),
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
              React.createElement(CardTitle, null, outcome === "failure" ? t("summary.wasted", "Wasted") : t("summary.cost", "Cost")),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(
            CardContent,
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
              React.createElement(
                "div",
                { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: outcome === "failure" ? "#ef4444" : "#f5a623" } },
                fmtCost(s.tot_estimated_cost)
              ),
              React.createElement("span", { style: { fontSize: "0.7rem", opacity: 0.95, fontFamily: "var(--theme-font-mono, monospace)", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: "0.25rem", padding: "0.05rem 0.4rem" } }, t("summary.estimated", "Estimated"))
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: costPct != null ? (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "%" : "\u2014" } },
              costPct != null ? (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "%" : "\u2014"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
              t("summary.vs_prior", "vs prior") + " ",
              days === 0 ? t("summary.period", "period") : days + "d"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.3rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.25rem" } },
              t("summary.actual", "Actual") + ": ",
              s.tot_actual_cost != null ? fmtCost(s.tot_actual_cost) : "\u2014"
            ),
            React.createElement(
              "div",
              { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem" } },
              React.createElement("span", { style: { color: "#4ade80" } }, "\u2713 ", s.success_runs || 0),
              " \xB7 ",
              React.createElement("span", { style: { color: (s.failure_runs || 0) > 0 ? "#ef4444" : null } }, "\u2717 ", s.failure_runs || 0),
              s.failure_estimated_cost != null && s.failure_estimated_cost > 0 ? " (" + fmtCost(s.failure_estimated_cost) + " " + t("summary.wasted", "wasted") + ")" : ""
            )
          )
        )
      ),
      // Tokens
      React.createElement(
        "div",
        cardProps(onTokensClick, t("summary.tokens", "Tokens") + " details", { minWidth: 0, overflow: "hidden" }),
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
              React.createElement(CardTitle, null, t("summary.tokens", "Tokens")),
              React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, HelpCircleIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
            )
          ),
          React.createElement(
            CardContent,
            null,
            React.createElement(
              "div",
              { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
              fmtCompact(s.total_tokens)
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
                React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_input_tokens))
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
                React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_output_tokens))
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
                React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, t("summary.cached", "Cached")),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.total_cache_read_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "var(--foreground-base, var(--foreground))", height: "100%", opacity: 0.6 } })
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
        return React.createElement(
          "div",
          cardProps(onPaceClick, t("summary.pace", "Pace") + " details", { minWidth: 0, overflow: "hidden" }),
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
                React.createElement(CardTitle, null, t("summary.pace", "Pace")),
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
                  React.createElement("span", { style: { width: "4.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, t("summary.nominal", "Nominal")),
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
                  React.createElement("span", { style: { width: "4.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, t("summary.trend", "Trend")),
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

  // dashboard/src/components/LeaderBoard.js
  function LeaderBoard({ jobList, onTopRunsClick, onTopCostClick, onTopTokensClick, onTopPaceClick }) {
    const t = useCronalyticsI18n();
    const totalRuns = jobList.reduce((sum, j) => sum + (j.runs || 0), 0);
    const totalCost = jobList.reduce((sum, j) => sum + (j.tot_estimated_cost || 0), 0);
    const totalTokens = jobList.reduce((sum, j) => sum + (j.total_tokens || 0), 0);
    const cardHover = {
      onMouseEnter: (e) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.boxShadow = "";
      }
    };
    const cardProps = (onClick, label, extraStyle) => ({
      style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column", ...extraStyle || {} },
      tabIndex: 0,
      role: "button",
      "aria-label": label,
      onClick,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      },
      onMouseEnter: cardHover.onMouseEnter,
      onMouseLeave: cardHover.onMouseLeave
    });
    return React.createElement(
      "div",
      {
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
        const label = j ? j.name || j.job_id : "\u2014";
        return React.createElement(
          "div",
          cardProps(onTopRunsClick, t("leaderboard.top_runs", "Top Runs") + " details", { minWidth: 0, overflow: "hidden" }),
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
                React.createElement(CardTitle, null, t("leaderboard.top_runs", "Top Runs")),
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
              React.createElement(
                "div",
                { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
                totalRuns > 0 ? Math.round((j.runs || 0) / totalRuns * 100) + "% " + t("leaderboard.of_total_runs", "% of total runs") : ""
              )
            )
          )
        );
      })(),
      // Top Cost
      (() => {
        const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.tot_estimated_cost || 0) > (a.tot_estimated_cost || 0) ? b : a, jobList[0]) : null;
        const label = j ? j.name || j.job_id : "\u2014";
        return React.createElement(
          "div",
          cardProps(onTopCostClick, t("leaderboard.top_est_cost", "Top Cost") + " details", { minWidth: 0, overflow: "hidden" }),
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
                React.createElement(CardTitle, null, t("leaderboard.top_est_cost", "Top Cost")),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
                React.createElement("div", {
                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" }
                }, j ? fmtCost(j.tot_estimated_cost) : "\u2014"),
                j && React.createElement("span", { style: { fontSize: "0.7rem", opacity: 0.95, fontFamily: "var(--theme-font-mono, monospace)", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: "0.25rem", padding: "0.05rem 0.4rem" } }, t("summary.estimated", "Estimated"))
              ),
              React.createElement("div", {
                style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: label
              }, label),
              React.createElement(
                "div",
                { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
                totalCost > 0 ? Math.round((j.tot_estimated_cost || 0) / totalCost * 100) + "% " + t("leaderboard.of_total_est_cost", "% of total est cost") : ""
              )
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
          cardProps(onTopTokensClick, t("leaderboard.top_tokens", "Top Tokens") + " details", { minWidth: 0, overflow: "hidden" }),
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
                React.createElement(CardTitle, null, t("leaderboard.top_tokens", "Top Tokens")),
                React.createElement("span", { style: { marginLeft: "auto", lineHeight: 0, opacity: 0.4 } }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } }))
              )
            ),
            React.createElement(
              CardContent,
              null,
              React.createElement("div", {
                style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#5b8def", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, j ? fmtCompact(j.total_tokens) : "\u2014"),
              React.createElement("div", {
                style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: label
              }, label),
              React.createElement(
                "div",
                { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.6, marginTop: "0.15rem" } },
                totalTokens > 0 ? Math.round((j.total_tokens || 0) / totalTokens * 100) + "% " + t("leaderboard.of_total_tokens", "% of total tokens") : ""
              )
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
          cardProps(onTopPaceClick, t("leaderboard.most_efficient", "Top Pace") + " details", { minWidth: 0, overflow: "hidden" }),
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
                React.createElement(CardTitle, null, t("leaderboard.most_efficient", "Top Pace")),
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

  // dashboard/src/components/ModelBreakdown.js
  function ModelBreakdown({ costByModel }) {
    const t = useCronalyticsI18n();
    if (!costByModel || costByModel.length === 0) return null;
    const topModels = costByModel.slice(0, 5);
    const remaining = costByModel.length - 5;
    const maxCost = topModels[0] && topModels[0].tot_estimated_cost || 1;
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
          React.createElement(CardTitle, null, t("model_breakdown.title", "Per-Model Breakdown"))
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
              style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, minWidth: 0, flex: "0 0 38%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, m.model),
            React.createElement(
              "div",
              {
                style: { flex: 1, background: "rgba(255,255,255,0.04)", height: "0.4rem", borderRadius: "0.2rem", overflow: "hidden" }
              },
              React.createElement("div", {
                style: { width: Math.min(100, (m.tot_estimated_cost || 0) / maxCost * 100) + "%", background: "#f5a623", height: "100%", borderRadius: "0.2rem", transition: "width 0.5s ease" }
              })
            ),
            React.createElement(
              "span",
              {
                style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0, flex: "0 0 9rem", justifyContent: "flex-end" }
              },
              React.createElement("span", { style: { color: "#f5a623", width: "4.5rem", textAlign: "right", display: "inline-block" } }, fmtCost(m.tot_estimated_cost)),
              React.createElement("span", { style: { opacity: 0.45, width: "3.5rem", textAlign: "right", display: "inline-block" } }, "\xB7 " + (m.runs || 0).toLocaleString())
            )
          )),
          remaining > 0 && React.createElement("div", {
            style: { textAlign: "center", fontSize: "0.65rem", opacity: 0.35, marginTop: "0.3rem", fontFamily: "var(--theme-font-mono, monospace)" }
          }, t("model_breakdown.and_more", "and {n} more", { n: remaining }))
        )
      )
    );
  }

  // dashboard/src/components/JobBreakdown.js
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
    const t = useCronalyticsI18n();
    const HEADERS = [
      t("job_breakdown.job", "Job"),
      t("job_breakdown.runs", "Runs"),
      t("job_breakdown.avg_time", "Avg Duration"),
      t("job_breakdown.est_cost", "Est Cost"),
      t("job_breakdown.avg_est_cost", "Avg Est Cost"),
      t("job_breakdown.nominal_mo", "Nominal/mo"),
      t("job_breakdown.trend_mo", "Trend/mo"),
      t("job_breakdown.pace", "Pace")
    ];
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
            React.createElement(CardTitle, null, t("job_breakdown.title", "Jobs Breakdown"))
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
                t("shared.loading", "Syncing")
              ) : t("shared.sync_now", "Sync Now")
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
          syncing ? t("shared.loading", "Syncing cron sessions...") : syncInfo && syncInfo.lastSync ? t("job_breakdown.no_jobs_window", "No jobs in {window}. Last sync: {time} UTC", { window: windowLabel.toLowerCase(), time: syncInfo.lastSync.split("T").join(" ").slice(0, 19) }) : t("job_breakdown.no_jobs_sync", "No cron jobs captured. Click Sync Now to backfill from state.db.")
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
                HEADERS.map((h) => {
                  const isActive = sortConfig.key === h;
                  return React.createElement("th", {
                    key: h,
                    tabIndex: 0,
                    role: "button",
                    "aria-label": isActive ? t("job_breakdown.sorted_by", "Sorted by {col}, {dir}", { col: h, dir: sortConfig.direction === "asc" ? t("job_breakdown.ascending", "ascending") : t("job_breakdown.descending", "descending") }) : t("job_breakdown.sort_by", "Sort by {col}", { col: h }),
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
                      borderBottom: "2px solid var(--color-border)"
                    },
                    title: h === t("job_breakdown.pace", "Pace") ? "Pace = Trend \xF7 Nominal. Under 1.0\xD7 = under budget. Over 2.0\xD7 = over budget." : void 0
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
                      }, t("job_breakdown.mode_no_agent", "No agent"))
                    )
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, (j.runs || 0).toLocaleString()),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtDuration(j.avg_duration)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.tot_estimated_cost)),
                  React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_estimated_cost)),
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
                        t("summary.tokens", "Tokens") + ": " + fmtCompact(j.total_tokens) + " total (" + fmtCompact(j.total_input_tokens) + " " + t("summary.in", "in") + " / " + fmtCompact(j.total_output_tokens) + " " + t("summary.out", "out") + " / " + fmtCompact(j.total_cache_read_tokens) + " " + t("summary.cached", "cached") + ")"
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
                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "0.5rem" }
                          },
                          j.projections && j.projections.schedule_display ? j.projections.schedule_display : t("job_breakdown.no_schedule", "No schedule"),
                          "   " + t("job_breakdown.last", "Last") + ": ",
                          fmtTime(j.last_run),
                          j.last_model ? "   " + t("job_breakdown.using", "using") + " " + j.last_model : "",
                          "   " + t("job_breakdown.next", "Next") + ": ",
                          j.projections && j.projections.next_run_at ? fmtRel(j.projections.next_run_at) : "\u2014",
                          j.job_mode === "no_agent" && React.createElement("span", { style: { fontSize: "0.6rem", textTransform: "uppercase", opacity: 0.5, marginLeft: "0.25rem" } }, "[" + t("job_breakdown.mode_no_agent", "No agent") + "]")
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
                        }, t("job_breakdown.see_runs", "See Runs"))
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

  // dashboard/src/components/CronalyticsTab.js
  function CronalyticsTab() {
    const t = useCronalyticsI18n();
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
        if (saved) {
          if (saved === "both") {
            localStorage.setItem("cronalytics:outcome", "all");
            return "all";
          }
          return saved;
        }
      } catch {
      }
      return "all";
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
          setSyncToast({ msg: "\u2713 " + t("shared.synced_n_runs", "Synced {n} runs") + " \xB7 " + (elapsed_ms / 1e3).toFixed(1) + "s", n: inserted });
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
        t("job_detail.error_prefix", "Error: ") + (summary.error || jobs.error)
      );
    }
    const s = summary.data || {};
    const jobList = jobs.data && jobs.data.jobs ? jobs.data.jobs : [];
    const windowLabel = days === 0 ? t("summary.all_time", "All time") : t("summary.last_n_days", "Last {n} days", { n: days });
    const costPct = s.previous_period && s.previous_period.estimated_cost != null && s.previous_period.estimated_cost !== 0 ? (s.tot_estimated_cost - s.previous_period.estimated_cost) / s.previous_period.estimated_cost * 100 : null;
    const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0 ? (s.total_runs - s.previous_period.runs) / s.previous_period.runs * 100 : null;
    const getSortValue = (j, key) => {
      switch (key) {
        case t("job_breakdown.job", "Job"):
          return j.name || j.job_id;
        case t("job_breakdown.runs", "Runs"):
          return j.runs || 0;
        case t("job_breakdown.avg_time", "Avg Duration"):
          return j.avg_duration || 0;
        case t("job_breakdown.est_cost", "Est Cost"):
          return j.tot_estimated_cost || 0;
        case t("job_breakdown.avg_est_cost", "Avg Est Cost"):
          return j.avg_estimated_cost || 0;
        case t("job_breakdown.nominal_mo", "Nominal/mo"):
          return j.projections && j.projections.projected_cost_30d != null ? j.projections.projected_cost_30d : -Infinity;
        case t("job_breakdown.trend_mo", "Trend/mo"):
          return j.projections && j.projections.trend_projected_cost_30d != null ? j.projections.trend_projected_cost_30d : -Infinity;
        case t("job_breakdown.pace", "Pace"):
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
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "nowrap", gap: "0.75rem", alignItems: "center" } },
          React.createElement(OutcomeToggle, { selected: outcome, onChange: setOutcome, label: t("outcome_toggle.label", "Outcomes") }),
          React.createElement(ModeToggle, { selected: mode, onChange: setMode, label: t("mode_toggle.label", "Mode") })
        ),
        // Spacer pushes DaySelector + Refresh to the right edge.
        React.createElement("div", { style: { flex: "1 1 0%", minWidth: "0.25rem" } }),
        // DaySelector returns [label, presets, custom] — flattened as direct flex children
        // of the toolbar so presets, custom input, and Refresh wrap progressively.
        React.createElement(DaySelector, { selected: days, onChange: setDays, label: null }),
        // Refresh — its own flex item so it breaks away first at 110%.
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
            title: "Refresh",
            style: { minHeight: "28px", display: "flex", alignItems: "center", justifyContent: "center" }
          },
          summary.loading || jobs.loading ? RefreshCwIcon(14, { style: { animation: "cronalytics-spin 1s linear infinite" } }) : RefreshCwIcon(14)
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
        sortKey: { [t("job_breakdown.job", "Job")]: "run_time", [t("job_breakdown.runs", "Runs")]: "run_time", [t("job_breakdown.avg_time", "Avg Duration")]: "duration_seconds", [t("job_breakdown.est_cost", "Est Cost")]: "estimated_cost", [t("job_breakdown.avg_est_cost", "Avg Est Cost")]: "estimated_cost", [t("job_breakdown.nominal_mo", "Nominal/mo")]: "run_time", [t("job_breakdown.trend_mo", "Trend/mo")]: "run_time", [t("job_breakdown.pace", "Pace")]: "run_time" }[sortConfig.key] || "run_time",
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
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.pace", "Pace"))
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
                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, t("summary.nominal", "Nominal")),
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
                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, t("summary.trend", "Trend")),
                React.createElement(
                  "div",
                  { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                  React.createElement("div", { style: { width: Math.min(100, (s.trend_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1) * 100) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
                ),
                React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(s.trend_monthly_total) + "/mo")
              )
            )
          ),
          React.createElement(PaceExplainer, { s, windowLabel, t })
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
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.job_runs", "Job Runs"))
          ),
          runPct != null && React.createElement(
            "div",
            { style: { marginBottom: "1rem" } },
            React.createElement(
              "div",
              { style: { fontSize: "0.82rem", color: runPct > 0 ? "#ef4444" : "#4ade80" } },
              (runPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(runPct).toFixed(0) + "% " + t("summary.vs_prior", "vs prior") + " " + (days === 0 ? t("summary.period", "period") : days + "d")
            )
          ),
          React.createElement(RunsExplainer, { windowLabel, t })
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
              fmtCost(s.tot_estimated_cost)
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.estimated", "Estimated") + " " + t("summary.cost", "Cost"))
          ),
          s.tot_actual_cost != null && React.createElement(
            "div",
            { style: { marginBottom: "0.75rem", fontSize: "0.8rem", opacity: 0.85 } },
            t("summary.actual", "Actual") + ": ",
            React.createElement("span", { style: { fontWeight: 700 } }, fmtCost(s.tot_actual_cost))
          ),
          costPct != null && React.createElement(
            "div",
            { style: { marginBottom: "1rem" } },
            React.createElement(
              "div",
              { style: { fontSize: "0.82rem", color: costPct > 0 ? "#ef4444" : "#4ade80" } },
              (costPct > 0 ? "\u2191 " : "\u2193 ") + Math.abs(costPct).toFixed(0) + "% " + t("summary.vs_prior", "vs prior") + " " + (days === 0 ? t("summary.period", "period") : days + "d")
            )
          ),
          React.createElement(CostExplainer, { windowLabel, t })
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
              fmtCompact(s.total_tokens)
            ),
            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.tokens", "Tokens"))
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, t("summary.in", "In")),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_input_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_input_tokens))
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, t("summary.out", "Out")),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_output_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_output_tokens))
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, t("summary.cached", "Cached")),
              React.createElement(
                "div",
                { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
                React.createElement("div", { style: { width: Math.min(100, (s.total_cache_read_tokens || 0) / (s.total_tokens || 1) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
              ),
              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_cache_read_tokens))
            )
          ),
          React.createElement(TokensExplainer, { s, t })
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
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.job_runs", "Job Runs"))
              ),
              j && React.createElement(JobDetailsBlock, { j, t })
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
            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.tot_estimated_cost || 0) > (a.tot_estimated_cost || 0) ? b : a, jobList[0]) : null;
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
                  j ? fmtCost(j.tot_estimated_cost) : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.estimated", "Estimated") + " " + t("summary.cost", "Cost"))
              ),
              j && React.createElement(JobDetailsBlock, { j, t })
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
                  j ? fmtCompact(j.total_tokens) : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.tokens", "Tokens"))
              ),
              j && React.createElement(JobDetailsBlock, { j, t })
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
                  { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: p != null ? paceColor(p) : null } },
                  p != null ? p.toFixed(2) + "\xD7" : "\u2014"
                ),
                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, t("summary.pace", "Pace"))
              ),
              j && React.createElement(JobDetailsBlock, { j, t })
            );
          })()
        )
      ),
      // ModelBreakdown — full width
      React.createElement(ModelBreakdown, { costByModel: s.cost_by_model }),
      // Toast
      syncToast && React.createElement("div", {
        style: {
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2e3,
          fontSize: "0.72rem",
          fontFamily: "var(--theme-font-mono, monospace)",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.35rem",
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "#4ade80",
          animation: "cronalytics-fadein 0.3s ease"
        }
      }, syncToast.msg),
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
        onSort: (key) => {
          if (sortConfig.key === key) {
            setSortConfig({ key, direction: sortConfig.direction === "asc" ? "desc" : "asc" });
          } else {
            setSortConfig({ key, direction: "asc" });
          }
        },
        onExpandToggle: (id) => setExpandedId(expandedId === id ? null : id),
        onSelectJob: setSelectedJobId
      })
    );
  }
  function PaceExplainer({ s, windowLabel, t }) {
    return React.createElement(
      "div",
      { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.what_this_means", "What this means")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem", textTransform: "none" } },
        t("pace.what_this_means", "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019")
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.how_its_calculated", "How it's calculated")),
      React.createElement(
        "div",
        { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6, textTransform: "none" } },
        React.createElement("div", null, t("pace.nominal_formula", "Nominal = scheduled runs \xD7 average cost per run")),
        React.createElement("div", null, t("pace.trend_formula", "Trend     = actual runs \xD7 average cost per run")),
        React.createElement("div", null, t("pace.pace_formula", "Pace      = Trend / Nominal")),
        React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6, textTransform: "none" } }, t("shared.all_scaled_30d", "All scaled to a 30\u2011day month using the selected window."))
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.color_guide", "Color guide")),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", marginBottom: "0.75rem", textTransform: "none" } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
          React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#4ade80" } }),
          React.createElement("span", null, t("shared.green_under_budget", "Green (< 1.0\xD7) \u2014 Under budget. Spending less than scheduled."))
        ),
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
          React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "var(--foreground)" } }),
          React.createElement("span", null, t("shared.neutral_budget", "Neutral (1.0\u20132.0\xD7) \u2014 On track. Slight variance within normal range."))
        ),
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
          React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#ef4444" } }),
          React.createElement("span", null, t("shared.red_over_budget", "Red (\u2265 2.0\xD7) \u2014 Over budget. Actual spend is double (or more) the nominal rate."))
        )
      )
    );
  }
  function RunsExplainer({ windowLabel, t }) {
    return React.createElement(
      "div",
      { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.what_this_means", "What this means")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
        t("runs.what_this_means", "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task\u2014whether it succeeds, fails, or retries.")
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.trend_calculation", "Trend calculation")),
      React.createElement(
        "div",
        { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
        React.createElement("div", null, t("runs.trend_formula", "Trend % = ((current runs \u2212 prior runs) / prior runs) \xD7 100")),
        React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6 } }, t("runs.trend_note", "Positive = more runs than the prior window. Negative = fewer runs."))
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.window_context", "Window context")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
        t("shared.showing_window", "Showing "),
        React.createElement("strong", null, windowLabel),
        ". " + t("shared.prior_window_note", "The prior comparison window is the same duration shifted back in time.")
      )
    );
  }
  function CostExplainer({ windowLabel, t }) {
    return React.createElement(
      "div",
      { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.what_this_means", "What this means")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
        t("cost.what_this_means", "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity.")
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.trend_calculation", "Trend calculation")),
      React.createElement(
        "div",
        { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
        React.createElement("div", null, t("cost.trend_formula", "Trend % = ((current cost \u2212 prior cost) / prior cost) \xD7 100"))
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.window_context", "Window context")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
        t("shared.showing_window", "Showing "),
        React.createElement("strong", null, windowLabel),
        ". " + t("shared.prior_window_note", "The prior comparison window is the same duration shifted back in time.")
      )
    );
  }
  function TokensExplainer({ s, t }) {
    return React.createElement(
      "div",
      { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.what_this_means", "What this means")),
      React.createElement(
        "p",
        { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
        t("tokens.what_this_means", "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper).")
      ),
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.breakdown", "Breakdown")),
      React.createElement(
        "div",
        { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
        React.createElement("div", null, t("summary.in", "Input") + ":  " + fmtCompact(s.total_input_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_input_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
        React.createElement("div", null, t("summary.out", "Output") + ": " + fmtCompact(s.total_output_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_output_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
        React.createElement("div", null, t("summary.cached", "Cached") + ": " + fmtCompact(s.total_cache_read_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_cache_read_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)")
      )
    );
  }
  function JobDetailsBlock({ j, t }) {
    return React.createElement(
      "div",
      { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
      React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, t("shared.job_details", "Job details")),
      React.createElement(
        "div",
        { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
        React.createElement("div", null, t("job_breakdown.schedule", "Schedule") + ": " + (j.schedule && j.schedule.display || "\u2014")),
        React.createElement("div", null, t("job_breakdown.last_run", "Last run") + ": " + fmtTime(j.last_run)),
        React.createElement("div", null, t("model_breakdown.model", "Model") + ": " + (j.last_model || "\u2014")),
        React.createElement("div", null, t("job_breakdown.avg_duration", "Avg duration") + ": " + (j.avg_duration != null ? fmtDuration(j.avg_duration) : "\u2014"))
      )
    );
  }

  // dashboard/src/i18n/en.js
  registerCatalog("en", {
    // HeroBanner — the greeting
    hero: {
      title: "CRONALYTICS",
      tagline: "Observe. Measure. Optimize.",
      pronunciation: "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/",
      noun: "(noun)",
      definition_1: "1. Cron analytics and observability.",
      definition_2: "2. The dashboard for agentic automations in Hermes.",
      expand_tooltip: "Expand hero banner",
      collapse_tooltip: "Collapse hero banner"
    },
    // SummaryBoard — headline stats
    summary: {
      job_runs: "Job Runs",
      cost: "Cost",
      wasted: "Wasted",
      tokens: "Tokens",
      cached: "Cached",
      pace: "Pace",
      trend: "Trend",
      estimated: "Estimated",
      actual: "Actual",
      all_time: "All time",
      last_n_days: "Last {n} days",
      vs_prior: "vs prior",
      period: "period",
      nominal: "Nominal",
      in: "In",
      out: "Out",
      no_schedule: "No schedule"
    },
    // LeaderBoard — top performers
    leaderboard: {
      title: "Leaderboard",
      top_est_cost: "Top Cost",
      top_runs: "Top Runs",
      top_tokens: "Top Tokens",
      top_duration: "Top Time",
      most_efficient: "Top Pace",
      of_total_est_cost: "% of total est cost",
      of_total_runs: "% of total runs",
      of_total_tokens: "% of total tokens"
    },
    // JobBreakdown — per-job table
    job_breakdown: {
      title: "Jobs Breakdown",
      job: "Job",
      runs: "Runs",
      avg_time: "Avg Duration",
      est_cost: "Est Cost",
      avg_est_cost: "Avg Est Cost",
      nominal_mo: "Nominal/mo",
      trend_mo: "Trend/mo",
      pace: "Pace",
      mode_agent: "Agent",
      mode_no_agent: "No agent",
      no_schedule: "No schedule",
      last: "Last",
      using: "using",
      next: "Next",
      see_runs: "See Runs",
      schedule: "Schedule",
      last_run: "Last run",
      no_jobs_window: "No jobs in {window}. Last sync: {time} UTC",
      no_jobs_sync: "No cron jobs captured. Click Sync Now to backfill from state.db.",
      sorted_by: "Sorted by {col}, {dir}",
      sort_by: "Sort by {col}",
      ascending: "ascending",
      descending: "descending"
    },
    // JobDetailView — individual run history
    job_detail: {
      title_runs: "Runs",
      mode: "Mode",
      mode_agent: "Agent",
      duration: "Duration",
      est_cost: "Est Cost",
      loading: "Loading runs...",
      error_prefix: "Error: ",
      for_full_history: " for full history.",
      no_runs: "No runs found.",
      showing: "Showing ",
      of: " of ",
      runs_plural: "runs",
      use_cli: "Use ",
      run: "run"
    },
    // ModelBreakdown — per-model stats
    model_breakdown: {
      title: "Per-Model Breakdown",
      model: "Model",
      runs: "Runs",
      est_cost: "Est Cost",
      and_more: "and {n} more"
    },
    // SparkLine — daily trends
    sparkline: {
      daily_cost: "Daily Est Cost",
      daily_runs: "Daily Runs",
      cost_bar: "\u2014 cost (bar) \xB7 ",
      tokens_line: "\u2014 tokens",
      duration_line: "- - duration"
    },
    // DaySelector — time window picker
    day_selector: {
      label: "Days",
      apply_custom: "Apply custom days",
      go: "Go"
    },
    // ModeToggle — agent/no_agent/all filter
    mode_toggle: {
      label: "Mode",
      all: "All",
      agent: "Agent",
      no_agent: "No Agent"
    },
    // OutcomeToggle — success/failure/all filter
    outcome_toggle: {
      label: "Outcomes",
      all: "All",
      success: "Success",
      failure: "Failure"
    },
    // ErrorBoundary — crash handler
    error: {
      title: "Cronalytics Error",
      message: "Something went wrong. Please refresh or contact support."
    },
    // Modal — popup dialog
    modal: {
      close: "Close"
    },
    // Pace modal explainer
    pace: {
      what_this_means: "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019",
      nominal_formula: "Nominal = scheduled runs \xD7 average cost per run",
      trend_formula: "Trend     = actual runs \xD7 average cost per run",
      pace_formula: "Pace      = Trend / Nominal"
    },
    // Runs modal explainer
    runs: {
      what_this_means: "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task\u2014whether it succeeds, fails, or retries.",
      trend_formula: "Trend % = ((current runs \u2212 prior runs) / prior runs) \xD7 100",
      trend_note: "Positive = more runs than the prior window. Negative = fewer runs."
    },
    // Cost modal explainer
    cost: {
      what_this_means: "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity.",
      trend_formula: "Trend % = ((current cost \u2212 prior cost) / prior cost) \xD7 100"
    },
    // Tokens modal explainer
    tokens: {
      what_this_means: "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper)."
    },
    // Shared / generic
    shared: {
      loading: "Loading\u2026",
      retry: "Retry",
      show: "Show",
      hide: "Hide",
      refresh: "Refresh",
      sync_now: "Sync Now",
      synced_n_runs: "Synced {n} runs",
      what_this_means: "What this means",
      how_its_calculated: "How it's calculated",
      trend_calculation: "Trend calculation",
      window_context: "Window context",
      showing_window: "Showing ",
      prior_window_note: "The prior comparison window is the same duration shifted back in time.",
      job_details: "Job details",
      color_guide: "Color guide",
      neutral_budget: "Neutral (1.0\u20132.0\xD7) \u2014 On track. Slight variance within normal range.",
      green_under_budget: "Green (< 1.0\xD7) \u2014 Under budget. Spending less than scheduled.",
      red_over_budget: "Red (> 2.0\xD7) \u2014 Over budget. Spending more than scheduled.",
      all_scaled_30d: "All scaled to a 30\u2011day month using the selected window.",
      breakdown: "Breakdown"
    }
  });

  // dashboard/src/i18n/es.js
  registerCatalog("es", {
    // cost
    cost: {
      trend_formula: "Tendencia % = ((costo actual \u2212 costo anterior) / costo anterior) \xD7 100",
      what_this_means: "El costo estimado se calcula a partir del uso de tokens y el precio del modelo. El costo real puede diferir ligeramente seg\xFAn la granularidad de facturaci\xF3n del proveedor."
    },
    // day_selector
    day_selector: {
      apply_custom: "Aplicar d\xEDas personalizados",
      go: "Ir",
      label: "D\xEDas"
    },
    // error
    error: {
      message: "Algo sali\xF3 mal. Por favor recarga o contacta soporte.",
      title: "Error de Cronalytics"
    },
    // hero
    hero: {
      collapse_tooltip: "Contraer banner principal",
      definition_1: "1. An\xE1lisis y observabilidad de cron jobs.",
      definition_2: "2. El panel de control para automatizaciones agentivas en Hermes.",
      expand_tooltip: "Expandir banner principal",
      noun: "(sustantivo)",
      pronunciation: "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/",
      tagline: "Observar. Medir. Optimizar.",
      title: "CRONALYTICS"
    },
    // job_breakdown
    job_breakdown: {
      ascending: "ascendente",
      avg_est_cost: "Costo est. prom.",
      avg_time: "Dur. promedio",
      descending: "descendente",
      est_cost: "Costo Est.",
      job: "Trabajo",
      last: "\xDAltimo",
      last_run: "\xDAltima ejecuci\xF3n",
      mode_agent: "Agente",
      mode_no_agent: "Sin agente",
      next: "Siguiente",
      no_jobs_sync: "No se capturaron cron jobs. Haz clic en Sincronizar ahora para rellenar desde state.db.",
      no_jobs_window: "Sin trabajos en {window}. \xDAltima sincronizaci\xF3n: {time} UTC",
      no_schedule: "Sin prog.",
      nominal_mo: "Nominal/mes",
      pace: "Ritmo",
      runs: "Ejec.",
      schedule: "Programaci\xF3n",
      see_runs: "Ver ejecuciones",
      sort_by: "Ordenar por {col}",
      sorted_by: "Ordenado por {col}, {dir}",
      title: "Desglose de trabajos",
      trend_mo: "Tendencia/mes",
      using: "usando"
    },
    // job_detail
    job_detail: {
      duration: "Duraci\xF3n",
      error_prefix: "Error: ",
      est_cost: "Costo Est.",
      for_full_history: " para historial completo.",
      loading: "Cargando ejecuciones...",
      mode: "Modo",
      mode_agent: "Agente",
      no_runs: "No se encontraron ejecuciones.",
      of: " de ",
      run: "ejecuci\xF3n",
      runs_plural: "ejecuciones",
      showing: "Mostrando ",
      title_runs: "Ejecuciones",
      use_cli: "Usar "
    },
    // leaderboard
    leaderboard: {
      most_efficient: "Mejor ritmo",
      of_total_est_cost: "% del costo total est.",
      of_total_runs: "% del total de ejec.",
      of_total_tokens: "% del total de tokens",
      title: "Tabla de l\xEDderes",
      top_duration: "Mayor duraci\xF3n",
      top_est_cost: "Mayor Costo",
      top_runs: "M\xE1s ejecuciones",
      top_tokens: "M\xE1s tokens"
    },
    // modal
    modal: {
      close: "Cerrar"
    },
    // mode_toggle
    mode_toggle: {
      agent: "Agente",
      all: "Todos",
      label: "Modo",
      no_agent: "Sin agente"
    },
    // model_breakdown
    model_breakdown: {
      and_more: "y {n} m\xE1s",
      est_cost: "Costo Est.",
      model: "Modelo",
      runs: "Ejec.",
      title: "Desglose por modelo"
    },
    // outcome_toggle
    outcome_toggle: {
      all: "Todos",
      failure: "Fallo",
      label: "Resultados",
      success: "\xC9xito"
    },
    // pace
    pace: {
      nominal_formula: "Nominal = ejecuciones programadas \xD7 costo promedio por ejecuci\xF3n",
      pace_formula: "Ritmo = Tendencia / Nominal",
      trend_formula: "Tendencia = ejecuciones reales \xD7 costo promedio por ejecuci\xF3n",
      what_this_means: "El ritmo compara tu tendencia de gasto real contra el presupuesto que configuraste en tus cron jobs. Responde: \u2018A este ritmo, \xBFestoy por encima o por debajo del presupuesto?\u2019"
    },
    // runs
    runs: {
      trend_formula: "Tendencia % = ((ejec. actuales \u2212 ejec. anteriores) / ejec. anteriores) \xD7 100",
      trend_note: "Positivo = m\xE1s ejecuciones que la ventana anterior. Negativo = menos ejecuciones.",
      what_this_means: "N\xFAmero total de ejecuciones de cron jobs registradas en la ventana seleccionada. Cada ejecuci\xF3n activa tu tarea programada, ya sea exitosa, fallida o reintentada."
    },
    // shared
    shared: {
      all_scaled_30d: "Todo escalado a un mes de 30 d\xEDas usando la ventana seleccionada.",
      breakdown: "Desglose",
      color_guide: "Gu\xEDa de colores",
      green_under_budget: "Verde (< 1.0\xD7) \u2014 Por debajo del presupuesto. Gasto menor al programado.",
      hide: "Ocultar",
      how_its_calculated: "C\xF3mo se calcula",
      job_details: "Detalles del trabajo",
      loading: "Cargando\u2026",
      neutral_budget: "Neutral (1.0\u20132.0\xD7) \u2014 En camino. Variaci\xF3n leve dentro del rango normal.",
      prior_window_note: "La ventana de comparaci\xF3n anterior tiene la misma duraci\xF3n desplazada en el tiempo.",
      red_over_budget: "Rojo (> 2.0\xD7) \u2014 Sobre presupuesto. Gasto mayor al programado.",
      refresh: "Actualizar",
      retry: "Reintentar",
      show: "Mostrar",
      showing_window: "Mostrando ",
      sync_now: "Sincronizar ahora",
      synced_n_runs: "Sincronizadas {n} ejecuciones",
      trend_calculation: "C\xE1lculo de tendencia",
      what_this_means: "Qu\xE9 significa esto",
      window_context: "Contexto de ventana"
    },
    // sparkline
    sparkline: {
      cost_bar: "\u2014 costo (barra) \xB7 ",
      daily_cost: "Costo Est. Diario",
      daily_runs: "Ejecuciones diarias",
      duration_line: "- - duraci\xF3n",
      tokens_line: "\u2014 tokens"
    },
    // summary
    summary: {
      actual: "Real",
      all_time: "Todo el tiempo",
      cached: "En cach\xE9",
      cost: "Costo",
      estimated: "Estimado",
      in: "Entrada",
      job_runs: "Ejecuciones",
      last_n_days: "\xDAltimos {n} d\xEDas",
      no_schedule: "Sin programaci\xF3n",
      nominal: "Nominal",
      out: "Salida",
      pace: "Ritmo",
      period: "per\xEDodo",
      tokens: "Tokens",
      trend: "Tendencia",
      vs_prior: "vs anterior",
      wasted: "Desperdiciado"
    },
    // tokens
    tokens: {
      what_this_means: "Los tokens son la unidad de uso de los LLMs. Los tokens de entrada son tus prompts + contexto. Los tokens de salida son la respuesta del modelo. Los tokens en cach\xE9 provienen de prompts repetidos con prefijos id\xE9nticos (m\xE1s econ\xF3micos)."
    }
  });

  // dashboard/src/i18n/zh-CN.js
  registerCatalog("zh", {
    // cost
    cost: {
      trend_formula: "\u8D8B\u52BF % = ((\u5F53\u524D\u6210\u672C \u2212 \u4E0A\u671F\u6210\u672C) / \u4E0A\u671F\u6210\u672C) \xD7 100",
      what_this_means: "\u9884\u4F30\u6210\u672C\u6839\u636E\u4EE4\u724C\u4F7F\u7528\u91CF\u548C\u6A21\u578B\u5B9A\u4EF7\u8BA1\u7B97\u3002\u5B9E\u9645\u6210\u672C\u53EF\u80FD\u56E0\u670D\u52A1\u5546\u8BA1\u8D39\u7C92\u5EA6\u800C\u7565\u6709\u5DEE\u5F02\u3002"
    },
    // day_selector
    day_selector: {
      apply_custom: "\u5E94\u7528\u81EA\u5B9A\u4E49\u5929\u6570",
      go: "\u786E\u5B9A",
      label: "\u5929\u6570"
    },
    // error
    error: {
      message: "\u51FA\u73B0\u95EE\u9898\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u6216\u8054\u7CFB\u652F\u6301\u3002",
      title: "Cronalytics \u9519\u8BEF"
    },
    // hero
    hero: {
      collapse_tooltip: "\u6536\u8D77\u6A2A\u5E45",
      definition_1: "1. Cron \u5206\u6790\u4E0E\u53EF\u89C2\u6D4B\u6027\u3002",
      definition_2: "2. Hermes \u4E2D\u667A\u80FD\u4EE3\u7406\u81EA\u52A8\u5316\u7684\u4EEA\u8868\u677F\u3002",
      expand_tooltip: "\u5C55\u5F00\u6A2A\u5E45",
      noun: "(\u540D\u8BCD)",
      pronunciation: "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/",
      tagline: "\u89C2\u5BDF\u3002\u8861\u91CF\u3002\u4F18\u5316\u3002",
      title: "CRONALYTICS"
    },
    // job_breakdown
    job_breakdown: {
      ascending: "\u5347\u5E8F",
      avg_est_cost: "\u5E73\u5747\u9884\u4F30\u6210\u672C",
      avg_time: "\u5E73\u5747\u8017\u65F6",
      descending: "\u964D\u5E8F",
      est_cost: "\u9884\u4F30\u6210\u672C",
      job: "\u4EFB\u52A1",
      last: "\u4E0A\u6B21",
      last_run: "\u4E0A\u6B21\u8FD0\u884C",
      mode_agent: "\u667A\u80FD\u4F53",
      mode_no_agent: "\u65E0\u667A\u80FD\u4F53",
      next: "\u4E0B\u6B21",
      no_jobs_sync: "\u672A\u6355\u83B7\u5230\u5B9A\u65F6\u4EFB\u52A1\u3002\u70B9\u51FB\u7ACB\u5373\u540C\u6B65\u4ECE state.db \u56DE\u586B\u3002",
      no_jobs_window: "{window} \u5185\u65E0\u4EFB\u52A1\u3002\u4E0A\u6B21\u540C\u6B65\uFF1A{time} UTC",
      no_schedule: "\u65E0\u8BA1\u5212",
      nominal_mo: "\u6807\u79F0/\u6708",
      pace: "\u6267\u884C\u7387",
      runs: "\u8FD0\u884C",
      schedule: "\u8BA1\u5212",
      see_runs: "\u67E5\u770B\u8FD0\u884C",
      sort_by: "\u6309 {col} \u6392\u5E8F",
      sorted_by: "\u6309 {col} {dir} \u6392\u5E8F",
      title: "\u4EFB\u52A1\u660E\u7EC6",
      trend_mo: "\u8D8B\u52BF/\u6708",
      using: "\u4F7F\u7528"
    },
    // job_detail
    job_detail: {
      duration: "\u8017\u65F6",
      error_prefix: "\u9519\u8BEF\uFF1A",
      est_cost: "\u9884\u4F30\u6210\u672C",
      for_full_history: " \u67E5\u770B\u5B8C\u6574\u5386\u53F2\u3002",
      loading: "\u52A0\u8F7D\u8FD0\u884C\u8BB0\u5F55...",
      mode: "\u6A21\u5F0F",
      mode_agent: "\u667A\u80FD\u4F53",
      no_runs: "\u672A\u627E\u5230\u8FD0\u884C\u8BB0\u5F55\u3002",
      of: " / ",
      run: "\u6B21\u8FD0\u884C",
      runs_plural: "\u6B21\u8FD0\u884C",
      showing: "\u663E\u793A ",
      title_runs: "\u8FD0\u884C\u8BB0\u5F55",
      use_cli: "\u4F7F\u7528 "
    },
    // leaderboard
    leaderboard: {
      most_efficient: "\u6700\u4F73\u6267\u884C\u7387",
      of_total_est_cost: "\u5360\u9884\u4F30\u603B\u6210\u672C %",
      of_total_runs: "\u5360\u603B\u8FD0\u884C\u6570 %",
      of_total_tokens: "\u5360\u603B\u4EE4\u724C\u6570 %",
      title: "\u6392\u884C\u699C",
      top_duration: "\u6700\u957F\u65F6\u957F",
      top_est_cost: "\u6700\u9AD8\u6210\u672C",
      top_runs: "\u6700\u591A\u8FD0\u884C",
      top_tokens: "Token \u6700\u591A"
    },
    // modal
    modal: {
      close: "\u5173\u95ED"
    },
    // mode_toggle
    mode_toggle: {
      agent: "\u667A\u80FD\u4F53",
      all: "\u5168\u90E8",
      label: "\u6A21\u5F0F",
      no_agent: "\u65E0\u667A\u80FD\u4F53"
    },
    // model_breakdown
    model_breakdown: {
      and_more: "\u8FD8\u6709 {n} \u4E2A",
      est_cost: "\u9884\u4F30\u6210\u672C",
      model: "\u6A21\u578B",
      runs: "\u8FD0\u884C",
      title: "\u6A21\u578B\u5206\u5E03"
    },
    // outcome_toggle
    outcome_toggle: {
      all: "\u5168\u90E8",
      failure: "\u5931\u8D25",
      label: "\u7ED3\u679C",
      success: "\u6210\u529F"
    },
    // pace
    pace: {
      nominal_formula: "\u6807\u79F0 = \u8BA1\u5212\u8FD0\u884C\u6B21\u6570 \xD7 \u6BCF\u6B21\u5E73\u5747\u6210\u672C",
      pace_formula: "\u6267\u884C\u7387     = \u8D8B\u52BF / \u6807\u79F0",
      trend_formula: "\u8D8B\u52BF = \u5B9E\u9645\u8FD0\u884C\u6B21\u6570 \xD7 \u6BCF\u6B21\u5E73\u5747\u6210\u672C",
      what_this_means: "\u6267\u884C\u7387\u5C06\u4F60\u7684\u5B9E\u9645\u652F\u51FA\u8D8B\u52BF\u4E0E\u4F60\u5728\u5B9A\u65F6\u4EFB\u52A1\u5B9A\u4E49\u4E2D\u8BBE\u5B9A\u7684\u9884\u7B97\u8FDB\u884C\u6BD4\u8F83\u3002\u5B83\u56DE\u7B54\uFF1A\u2018\u6309\u7167\u8FD9\u4E2A\u901F\u5EA6\uFF0C\u6211\u662F\u8D85\u652F\u8FD8\u662F\u8282\u7EA6\uFF1F\u2019"
    },
    // runs
    runs: {
      trend_formula: "\u8D8B\u52BF % = ((\u5F53\u524D\u8FD0\u884C\u6570 \u2212 \u4E0A\u671F\u8FD0\u884C\u6570) / \u4E0A\u671F\u8FD0\u884C\u6570) \xD7 100",
      trend_note: "\u6B63\u503C = \u6BD4\u4E0A\u671F\u8FD0\u884C\u66F4\u591A\u3002\u8D1F\u503C = \u6BD4\u4E0A\u671F\u8FD0\u884C\u66F4\u5C11\u3002",
      what_this_means: "\u6240\u9009\u7A97\u53E3\u5185\u8BB0\u5F55\u7684\u5B9A\u65F6\u4EFB\u52A1\u6267\u884C\u603B\u6B21\u6570\u3002\u6BCF\u6B21\u8FD0\u884C\u90FD\u4F1A\u89E6\u53D1\u4F60\u7684\u8BA1\u5212\u4EFB\u52A1\u2014\u2014\u65E0\u8BBA\u6210\u529F\u3001\u5931\u8D25\u8FD8\u662F\u91CD\u8BD5\u3002"
    },
    // shared
    shared: {
      all_scaled_30d: "\u4F7F\u7528\u6240\u9009\u7A97\u53E3\u6298\u7B97\u4E3A 30 \u5929\u3002",
      breakdown: "\u660E\u7EC6",
      color_guide: "\u989C\u8272\u8BF4\u660E",
      green_under_budget: "\u7EFF\u8272 (< 1.0\xD7) \u2014 \u4F4E\u4E8E\u9884\u7B97\uFF0C\u652F\u51FA\u5C11\u4E8E\u8BA1\u5212\u3002",
      hide: "\u9690\u85CF",
      how_its_calculated: "\u5982\u4F55\u8BA1\u7B97",
      job_details: "\u4EFB\u52A1\u8BE6\u60C5",
      loading: "\u52A0\u8F7D\u4E2D\u2026",
      neutral_budget: "\u4E2D\u6027 (1.0\u20132.0\xD7) \u2014 \u6B63\u5E38\u8303\u56F4\u5185\uFF0C\u8F7B\u5FAE\u6CE2\u52A8\u3002",
      prior_window_note: "\u4E0A\u671F\u5BF9\u6BD4\u7A97\u53E3\u662F\u5C06\u76F8\u540C\u65F6\u957F\u5411\u540E\u5E73\u79FB\u6240\u5F97\u3002",
      red_over_budget: "\u7EA2\u8272 (> 2.0\xD7) \u2014 \u8D85\u51FA\u9884\u7B97\uFF0C\u652F\u51FA\u591A\u4E8E\u8BA1\u5212\u3002",
      refresh: "\u5237\u65B0",
      retry: "\u91CD\u8BD5",
      show: "\u663E\u793A",
      showing_window: "\u663E\u793A ",
      sync_now: "\u7ACB\u5373\u540C\u6B65",
      synced_n_runs: "\u5DF2\u540C\u6B65 {n} \u6B21\u8FD0\u884C",
      trend_calculation: "\u8D8B\u52BF\u8BA1\u7B97",
      what_this_means: "\u8FD9\u662F\u4EC0\u4E48\u610F\u601D",
      window_context: "\u7A97\u53E3\u4E0A\u4E0B\u6587"
    },
    // sparkline
    sparkline: {
      cost_bar: "\u2014 \u6210\u672C\uFF08\u67F1\u72B6\uFF09\xB7 ",
      daily_cost: "\u6BCF\u65E5\u9884\u4F30\u6210\u672C",
      daily_runs: "\u6BCF\u65E5\u8FD0\u884C",
      duration_line: "- - \u65F6\u957F",
      tokens_line: "\u2014 Token"
    },
    // summary
    summary: {
      actual: "\u5B9E\u9645",
      all_time: "\u5168\u90E8\u65F6\u95F4",
      cached: "\u7F13\u5B58",
      cost: "\u6210\u672C",
      estimated: "\u9884\u4F30",
      in: "\u8F93\u5165",
      job_runs: "\u4EFB\u52A1\u8FD0\u884C",
      last_n_days: "\u6700\u8FD1 {n} \u5929",
      no_schedule: "\u65E0\u8BA1\u5212",
      nominal: "\u6807\u79F0",
      out: "\u8F93\u51FA",
      pace: "\u6267\u884C\u7387",
      period: "\u5468\u671F",
      tokens: "Token",
      trend: "\u8D8B\u52BF",
      vs_prior: "\u5BF9\u6BD4\u4E0A\u671F",
      wasted: "\u6D6A\u8D39"
    },
    // tokens
    tokens: {
      what_this_means: "\u4EE4\u724C\u662F LLM \u4F7F\u7528\u7684\u8BA1\u91CF\u5355\u4F4D\u3002\u8F93\u5165\u4EE4\u724C\u662F\u4F60\u7684\u63D0\u793A\u8BCD + \u4E0A\u4E0B\u6587\u3002\u8F93\u51FA\u4EE4\u724C\u662F\u6A21\u578B\u7684\u54CD\u5E94\u3002\u7F13\u5B58\u4EE4\u724C\u6765\u81EA\u5177\u6709\u76F8\u540C\u524D\u7F00\u7684\u91CD\u590D\u63D0\u793A\u8BCD\uFF08\u66F4\u4FBF\u5B9C\uFF09\u3002"
    }
  });

  // dashboard/src/i18n/zh-TW.js
  registerCatalog("zh-TW", {
    // cost
    cost: {
      trend_formula: "\u8DA8\u52E2 % = ((\u76EE\u524D\u6210\u672C \u2212 \u4E0A\u671F\u6210\u672C) / \u4E0A\u671F\u6210\u672C) \xD7 100",
      what_this_means: "\u9810\u4F30\u6210\u672C\u6839\u64DA\u4EE4\u724C\u4F7F\u7528\u91CF\u548C\u6A21\u578B\u5B9A\u50F9\u8A08\u7B97\u3002\u5BE6\u969B\u6210\u672C\u53EF\u80FD\u56E0\u670D\u52D9\u5546\u8A08\u8CBB\u7C92\u5EA6\u800C\u7565\u6709\u5DEE\u7570\u3002"
    },
    // day_selector
    day_selector: {
      apply_custom: "\u5957\u7528\u81EA\u8A02\u5929\u6578",
      go: "\u78BA\u5B9A",
      label: "\u5929\u6578"
    },
    // error
    error: {
      message: "\u767C\u751F\u554F\u984C\uFF0C\u8ACB\u91CD\u65B0\u6574\u7406\u9801\u9762\u6216\u806F\u7D61\u652F\u63F4\u3002",
      title: "Cronalytics \u932F\u8AA4"
    },
    // hero
    hero: {
      collapse_tooltip: "\u6536\u5408\u6A6B\u5E45",
      definition_1: "1. Cron \u5206\u6790\u8207\u53EF\u89C0\u6E2C\u6027\u3002",
      definition_2: "2. Hermes \u4E2D\u667A\u80FD\u4EE3\u7406\u81EA\u52D5\u5316\u7684\u5100\u8868\u677F\u3002",
      expand_tooltip: "\u5C55\u958B\u6A6B\u5E45",
      noun: "(\u540D\u8A5E)",
      pronunciation: "/\u02C8kr\u0252n.\u0259\u02CCl\u026At.\u026Aks/",
      tagline: "\u89C0\u5BDF\u3002\u8861\u91CF\u3002\u6700\u4F73\u5316\u3002",
      title: "CRONALYTICS"
    },
    // job_breakdown
    job_breakdown: {
      ascending: "\u905E\u589E",
      avg_est_cost: "\u5E73\u5747\u9810\u4F30\u6210\u672C",
      avg_time: "\u5E73\u5747\u8017\u6642",
      descending: "\u905E\u6E1B",
      est_cost: "\u9810\u4F30\u6210\u672C",
      job: "\u4EFB\u52D9",
      last: "\u4E0A\u6B21",
      last_run: "\u4E0A\u6B21\u57F7\u884C",
      mode_agent: "\u667A\u6167\u9AD4",
      mode_no_agent: "\u7121\u667A\u80FD\u4EE3\u7406",
      next: "\u4E0B\u6B21",
      no_jobs_sync: "\u672A\u64F7\u53D6\u5230\u5B9A\u6642\u4EFB\u52D9\u3002\u9EDE\u64CA\u7ACB\u5373\u540C\u6B65\u5F9E state.db \u56DE\u586B\u3002",
      no_jobs_window: "{window} \u5167\u7121\u4EFB\u52D9\u3002\u4E0A\u6B21\u540C\u6B65\uFF1A{time} UTC",
      no_schedule: "\u7121\u6392\u7A0B",
      nominal_mo: "\u6A19\u7A31/\u6708",
      pace: "\u57F7\u884C\u7387",
      runs: "\u57F7\u884C",
      schedule: "\u6392\u7A0B",
      see_runs: "\u67E5\u770B\u57F7\u884C",
      sort_by: "\u6309 {col} \u6392\u5E8F",
      sorted_by: "\u6309 {col} {dir} \u6392\u5E8F",
      title: "\u4EFB\u52D9\u660E\u7D30",
      trend_mo: "\u8DA8\u52E2/\u6708",
      using: "\u4F7F\u7528"
    },
    // job_detail
    job_detail: {
      duration: "\u8017\u6642",
      error_prefix: "\u932F\u8AA4\uFF1A",
      est_cost: "\u9810\u4F30\u6210\u672C",
      for_full_history: " \u67E5\u770B\u5B8C\u6574\u6B77\u7A0B\u3002",
      loading: "\u8F09\u5165\u57F7\u884C\u8A18\u9304...",
      mode: "\u6A21\u5F0F",
      mode_agent: "\u667A\u6167\u9AD4",
      no_runs: "\u672A\u627E\u5230\u57F7\u884C\u8A18\u9304\u3002",
      of: " / ",
      run: "\u6B21\u57F7\u884C",
      runs_plural: "\u6B21\u57F7\u884C",
      showing: "\u986F\u793A ",
      title_runs: "\u57F7\u884C\u8A18\u9304",
      use_cli: "\u4F7F\u7528 "
    },
    // leaderboard
    leaderboard: {
      most_efficient: "\u6700\u4F73\u57F7\u884C\u7387",
      of_total_est_cost: "\u4F54\u9810\u4F30\u7E3D\u6210\u672C %",
      of_total_runs: "\u4F54\u7E3D\u57F7\u884C\u6578 %",
      of_total_tokens: "\u4F54\u7E3D\u4EE4\u724C\u6578 %",
      title: "\u6392\u884C\u699C",
      top_duration: "\u6700\u9577\u6642\u9577",
      top_est_cost: "\u6700\u9AD8\u6210\u672C",
      top_runs: "\u6700\u591A\u57F7\u884C",
      top_tokens: "Token \u6700\u591A"
    },
    // modal
    modal: {
      close: "\u95DC\u9589"
    },
    // mode_toggle
    mode_toggle: {
      agent: "\u667A\u80FD\u4EE3\u7406",
      all: "\u5168\u90E8",
      label: "\u6A21\u5F0F",
      no_agent: "\u7121\u667A\u80FD\u4EE3\u7406"
    },
    // model_breakdown
    model_breakdown: {
      and_more: "\u9084\u6709 {n} \u500B",
      est_cost: "\u9810\u4F30\u6210\u672C",
      model: "\u6A21\u578B",
      runs: "\u57F7\u884C",
      title: "\u6A21\u578B\u5206\u5E03"
    },
    // outcome_toggle
    outcome_toggle: {
      all: "\u5168\u90E8",
      failure: "\u5931\u6557",
      label: "\u7D50\u679C",
      success: "\u6210\u529F"
    },
    // pace
    pace: {
      nominal_formula: "\u6A19\u7A31 = \u8A08\u756B\u57F7\u884C\u6B21\u6578 \xD7 \u6BCF\u6B21\u5E73\u5747\u6210\u672C",
      pace_formula: "\u57F7\u884C\u7387     = \u8DA8\u52E2 / \u6A19\u7A31",
      trend_formula: "\u8DA8\u52E2 = \u5BE6\u969B\u57F7\u884C\u6B21\u6578 \xD7 \u6BCF\u6B21\u5E73\u5747\u6210\u672C",
      what_this_means: "\u57F7\u884C\u7387\u5C07\u4F60\u7684\u5BE6\u969B\u652F\u51FA\u8DA8\u52E2\u8207\u4F60\u5728\u5B9A\u6642\u4EFB\u52D9\u5B9A\u7FA9\u4E2D\u8A2D\u5B9A\u7684\u9810\u7B97\u9032\u884C\u6BD4\u8F03\u3002\u5B83\u56DE\u7B54\uFF1A\u2018\u6309\u7167\u9019\u500B\u901F\u5EA6\uFF0C\u6211\u662F\u8D85\u652F\u9084\u662F\u7BC0\u7D04\uFF1F\u2019"
    },
    // runs
    runs: {
      trend_formula: "\u8DA8\u52E2 % = ((\u76EE\u524D\u57F7\u884C\u6578 \u2212 \u4E0A\u671F\u57F7\u884C\u6578) / \u4E0A\u671F\u57F7\u884C\u6578) \xD7 100",
      trend_note: "\u6B63\u503C = \u6BD4\u4E0A\u671F\u57F7\u884C\u66F4\u591A\u3002\u8CA0\u503C = \u6BD4\u4E0A\u671F\u57F7\u884C\u66F4\u5C11\u3002",
      what_this_means: "\u6240\u9078\u8996\u7A97\u5167\u8A18\u9304\u7684\u5B9A\u6642\u4EFB\u52D9\u57F7\u884C\u7E3D\u6B21\u6578\u3002\u6BCF\u6B21\u57F7\u884C\u90FD\u6703\u89F8\u767C\u4F60\u7684\u8A08\u756B\u4EFB\u52D9\u2014\u2014\u7121\u8AD6\u6210\u529F\u3001\u5931\u6557\u9084\u662F\u91CD\u8A66\u3002"
    },
    // shared
    shared: {
      all_scaled_30d: "\u4F7F\u7528\u6240\u9078\u8996\u7A97\u6298\u7B97\u70BA 30 \u5929\u3002",
      breakdown: "\u660E\u7D30",
      color_guide: "\u984F\u8272\u8AAA\u660E",
      green_under_budget: "\u7DA0\u8272 (< 1.0\xD7) \u2014 \u4F4E\u65BC\u9810\u7B97\uFF0C\u652F\u51FA\u5C11\u65BC\u8A08\u756B\u3002",
      hide: "\u96B1\u85CF",
      how_its_calculated: "\u5982\u4F55\u8A08\u7B97",
      job_details: "\u4EFB\u52D9\u8A73\u60C5",
      loading: "\u8F09\u5165\u4E2D\u2026",
      neutral_budget: "\u4E2D\u6027 (1.0\u20132.0\xD7) \u2014 \u6B63\u5E38\u7BC4\u570D\u5167\uFF0C\u8F15\u5FAE\u6CE2\u52D5\u3002",
      prior_window_note: "\u4E0A\u671F\u5C0D\u6BD4\u8996\u7A97\u662F\u5C07\u76F8\u540C\u6642\u9577\u5411\u5F8C\u5E73\u79FB\u6240\u5F97\u3002",
      red_over_budget: "\u7D05\u8272 (> 2.0\xD7) \u2014 \u8D85\u51FA\u9810\u7B97\uFF0C\u652F\u51FA\u591A\u65BC\u8A08\u756B\u3002",
      refresh: "\u91CD\u65B0\u6574\u7406",
      retry: "\u91CD\u8A66",
      show: "\u986F\u793A",
      showing_window: "\u986F\u793A ",
      sync_now: "\u7ACB\u5373\u540C\u6B65",
      synced_n_runs: "\u5DF2\u540C\u6B65 {n} \u6B21\u57F7\u884C",
      trend_calculation: "\u8DA8\u52E2\u8A08\u7B97",
      what_this_means: "\u9019\u662F\u4EC0\u9EBC\u610F\u601D",
      window_context: "\u8996\u7A97\u4E0A\u4E0B\u6587"
    },
    // sparkline
    sparkline: {
      cost_bar: "\u2014 \u6210\u672C\uFF08\u67F1\u72C0\uFF09\xB7 ",
      daily_cost: "\u6BCF\u65E5\u9810\u4F30\u6210\u672C",
      daily_runs: "\u6BCF\u65E5\u57F7\u884C",
      duration_line: "- - \u6642\u9577",
      tokens_line: "\u2014 Token"
    },
    // summary
    summary: {
      actual: "\u5BE6\u969B",
      all_time: "\u5168\u90E8\u6642\u9593",
      cached: "\u5FEB\u53D6",
      cost: "\u6210\u672C",
      estimated: "\u9810\u4F30",
      in: "\u8F38\u5165",
      job_runs: "\u4EFB\u52D9\u57F7\u884C",
      last_n_days: "\u6700\u8FD1 {n} \u5929",
      no_schedule: "\u7121\u6392\u7A0B",
      nominal: "\u6A19\u7A31",
      out: "\u8F38\u51FA",
      pace: "\u57F7\u884C\u7387",
      period: "\u9031\u671F",
      tokens: "Token",
      trend: "\u8DA8\u52E2",
      vs_prior: "\u5C0D\u6BD4\u4E0A\u671F",
      wasted: "\u6D6A\u8CBB"
    },
    // tokens
    tokens: {
      what_this_means: "\u4EE4\u724C\u662F LLM \u4F7F\u7528\u7684\u8A08\u91CF\u55AE\u4F4D\u3002\u8F38\u5165\u4EE4\u724C\u662F\u4F60\u7684\u63D0\u793A\u8A5E + \u4E0A\u4E0B\u6587\u3002\u8F38\u51FA\u4EE4\u724C\u662F\u6A21\u578B\u7684\u56DE\u61C9\u3002\u5FEB\u53D6\u4EE4\u724C\u4F86\u81EA\u5177\u6709\u76F8\u540C\u524D\u7DB4\u7684\u91CD\u8907\u63D0\u793A\u8A5E\uFF08\u66F4\u4FBF\u5B9C\uFF09\u3002"
    }
  });

  // dashboard/src/index.js
  PLUGINS.register("cronalytics", function CronalyticsWrapped() {
    return React.createElement(
      PluginErrorBoundary,
      null,
      React.createElement(CronalyticsTab)
    );
  });
})();
