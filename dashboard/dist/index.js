(function () {
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) return;

  const { React } = SDK;
  const { useState, useEffect } = SDK.hooks;
  const { fetchJSON } = SDK;
  const { Card, CardHeader, CardTitle, CardContent, Badge, Button } = SDK.components;

  // ── Currency formatter: 2 decimals with smart truncation ─────────
  function fmtCost(n) {
    if (n == null) return "—";
    if (n === 0) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function fmtTime(ts) {
    if (!ts) return "\u2014";
    const d = new Date(ts * 1000);
    const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
    return new Intl.DateTimeFormat(undefined, opts).format(d);
  }

  function fmtRel(iso) {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d - now;
    if (diffMs < 0) return "Overdue";
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const d2 = Math.floor(h / 24);
    if (h < 1) return Math.floor(diffMs / (1000 * 60)) + "m";
    if (d2 > 0) return d2 + "d " + (h % 24) + "h";
    return h + "h";
  }

  function fmtCompact(n) {
    if (n == null || n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  }

  function paceColor(pace) {
    if (pace == null) return "var(--foreground-base, var(--foreground))";
    if (pace < 0.85) return "#4ecdc4";
    if (pace < 1.15) return "var(--foreground-base, var(--foreground))";
    if (pace < 1.50) return "#f0a500";
    return "#ff6b6b";
  }

  function paceBg(pace) {
    if (pace == null) return "transparent";
    if (pace < 0.85) return "rgba(78,205,196,0.08)";
    if (pace < 1.15) return "transparent";
    if (pace < 1.50) return "rgba(240,165,0,0.08)";
    return "rgba(255,107,107,0.08)";
  }

  function CpuIcon(size) {
    return React.createElement("svg", {
      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: 2,
      strokeLinecap: "round", strokeLinejoin: "round",
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
    return React.createElement("svg", {
      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: 2,
      strokeLinecap: "round", strokeLinejoin: "round",
      style: { display: "inline-block", verticalAlign: "middle" }
    },
      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
      React.createElement("path", { d: "M12 6v6l4 2" })
    );
  }
  function RefreshCwIcon(size) {
    return React.createElement("svg", {
      width: size || 14, height: size || 14, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth: 2,
      strokeLinecap: "round", strokeLinejoin: "round",
      style: { display: "inline-block", verticalAlign: "middle" }
    },
      React.createElement("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
      React.createElement("path", { d: "M21 3v5h-5" }),
      React.createElement("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
      React.createElement("path", { d: "M8 16H3v5" })
    );
  }

  function useApi(path) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      fetchJSON(path)
        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
      return () => { cancelled = true; };
    }, [path, reload]);
    return { data, loading, error, refetch: () => setReload(r => r + 1) };
  }

  // ── Day selector control (uses SDK Button to match Analytics tab) ─
  function DaySelector({ selected, onChange }) {
    const days = [
      { label: "7D", value: 7 },
      { label: "30D", value: 30 },
      { label: "90D", value: 90 },
      { label: "All", value: 0 },
    ];
    return React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.375rem",
      }
    }, days.map(d => React.createElement(Button, {
      key: d.value,
      type: "button",
      size: "sm",
      outlined: selected !== d.value,
      onClick: () => onChange(d.value),
    }, d.label)));
  }

    // ── Main /cron tab ──────────────────────────────────────────────
    function CronTab() {
      const [days, setDaysRaw] = useState(() => {
        try {
          const saved = localStorage.getItem("cronalytics:days");
          if (saved !== null) return Number(saved);
        } catch {}
        return 30;
      });
      const setDays = (v) => {
        try { localStorage.setItem("cronalytics:days", String(v)); } catch {}
        setDaysRaw(v);
      };
      const summary = useApi("/api/plugins/cronalytics/summary?days=" + days);
      const jobs = useApi("/api/plugins/cronalytics/jobs?days=" + days);
      const [syncing, setSyncing] = useState(false);
      const [syncInfo, setSyncInfo] = useState(null);

      const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
      fetchJSON("/api/plugins/cronalytics/health")
        .then(d => {
          if (d && d.sync) {
            setSyncInfo({
              lastSync: d.sync.last_sync,
              rowsSynced: d.sync.rows_synced,
            });
          }
        })
        .catch(() => {});
    }, []);

    const onSync = () => {
      if (syncing) return;
      setSyncing(true);
      let cancelled = false;
      fetchJSON("/api/plugins/cronalytics/sync", { method: "POST" })
        .then(() => {
          fetchJSON("/api/plugins/cronalytics/health")
            .then(d2 => {
              if (d2 && d2.sync) {
                setSyncInfo({
                  lastSync: d2.sync.last_sync,
                  rowsSynced: d2.sync.rows_synced,
                });
              }
            })
            .catch(() => {});
          summary.refetch();
          jobs.refetch();
        })
        .catch(e => {
          if (!cancelled) setSyncInfo({ error: e.message });
        })
        .finally(() => {
          if (!cancelled) setSyncing(false);
        });
    };

    const firstLoad = summary.loading && !summary.data && jobs.loading && !jobs.data;
    if (firstLoad) {
      return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } }, "Loading Cronalytics…");
    }

    if (summary.error || jobs.error) {
      return React.createElement("div", { style: { padding: "1rem", color: "var(--color-destructive)" } },
        "Error: " + (summary.error || jobs.error)
      );
    }

    const s = summary.data || {};
    const jobList = (jobs.data && jobs.data.jobs) ? jobs.data.jobs : [];
    const windowLabel = days === 0 ? "All time" : "Last " + days + " days";
    const prevLabel = s.previous_period && s.previous_period.cost !== undefined
      ? " (prev " + fmtCost(s.previous_period.cost) + ")"
      : "";

    return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } },
      // Inline toolbar: day selector + refresh (right-aligned, title is in page header)
      React.createElement("div", {
        style: { display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "0.5rem" }
      },
        React.createElement("div", { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
          React.createElement(DaySelector, { selected: days, onChange: setDays }),
          React.createElement(Button, {
            type: "button",
            size: "sm",
            outlined: true,
            disabled: summary.loading || jobs.loading,
            onClick: () => { summary.refetch(); jobs.refetch(); },
            style: { minWidth: "5.5rem" }
          }, summary.loading || jobs.loading
            ? "\u2026"
            : React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "0.25rem" } },
                RefreshCwIcon(14),
                "Refresh"
              )
          )
        )
      ),

      // Summary cards
      React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }
      },
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Total Runs")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } }, (s.total_runs || 0).toLocaleString()),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } }, windowLabel)
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Cost")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
              fmtCost(s.total_estimated_cost),
              React.createElement("span", { style: { fontSize: "0.65rem", fontWeight: 400, opacity: 0.5, marginLeft: "0.35rem", verticalAlign: "middle" } }, "(estimated)")
            ),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } },
              "Trend: ", s.trend || "→", prevLabel
            )
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Tokens")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
              fmtCompact(s.total_tokens)
            ),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6, display: "flex", flexDirection: "column", gap: "0.1rem" } },
              React.createElement("span", null, "In: " + fmtCompact(s.total_input_tokens)),
              React.createElement("span", null, "Out: " + fmtCompact(s.total_output_tokens)),
              React.createElement("span", null, "Cached: " + fmtCompact(s.total_cache_read_tokens))
            )
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Pace")),
          React.createElement(CardContent, null,
            React.createElement("div", {
              style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) }
            }, s.pace != null ? s.pace.toFixed(2) + "×" : "—"),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6, display: "flex", flexDirection: "column", gap: "0.1rem" } },
              React.createElement("span", null, "Nominal: " + fmtCost(s.nominal_monthly_total) + "/mo"),
              React.createElement("span", null, "Trend: " + fmtCost(s.trend_monthly_total) + "/mo")
            )
          )
        )
      ),

      // Jobs Breakdown
      React.createElement(Card, { style: { marginBottom: "1.5rem" } },
        React.createElement(CardHeader, null,
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
            ClockIcon(16),
            React.createElement(CardTitle, null, "Jobs Breakdown")
          ),
          React.createElement("div", { style: { display: "flex", gap: "0.75rem", alignItems: "center" } },
            syncInfo && syncInfo.lastSync &&
              React.createElement("span", {
                style: { fontSize: "0.65rem", opacity: 0.45, fontFamily: "var(--theme-font-mono, monospace)" }
              },
                "Synced " + fmtTime(new Date(syncInfo.lastSync).getTime() / 1000) +
                (syncInfo.rowsSynced != null ? " · " + syncInfo.rowsSynced + " rows" : "")
              ),
            React.createElement(Button, {
              size: "sm",
              outlined: true,
              disabled: syncing,
              onClick: onSync,
            }, syncing ? "Syncing..." : "Sync Now")
          )
        ),
        React.createElement(CardContent, null,
          jobList.length === 0
            ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } },
              syncing
                ? "Syncing cron sessions..."
                : (syncInfo && syncInfo.lastSync
                  ? "No jobs in " + windowLabel.toLowerCase() + ". Last sync: " + syncInfo.lastSync.split("T").join(" ").slice(0, 19) + " UTC"
                  : "No cron jobs captured. Click Sync Now to backfill from state.db.")
            )
            : React.createElement("div", { style: { overflow: "auto" } },
              React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" } },
                React.createElement("thead", null,
                  React.createElement("tr", { style: { borderBottom: "1px solid var(--color-border)" } },
                    ["Job", "Runs", "Total Cost", "Avg Cost", "Nominal/mo", "Trend/mo", "Pace"].map(h => {
                      const _tt = {
                        "Nominal/mo": "Cost if job ran exactly on schedule at current avg cost",
                        "Trend/mo": "Cost if current spending pace continues for 30 days",
                        "Pace": "How actual spend compares to scheduled expectation",
                      };
                      return React.createElement("th", {
                        key: h,
                        title: _tt[h] || "",
                        style: { textAlign: h === "Job" ? "left" : "right", padding: "0.5rem 0.35rem", cursor: _tt[h] ? "help" : "default" }
                      }, h);
                    })
                  )
                ),
                React.createElement("tbody", null,
                  jobList.map(j => [
                    React.createElement("tr", {
                      key: j.job_id,
                      style: { borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s ease" },
                      onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; },
                      onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
                      onClick: () => setExpandedId(expandedId === j.job_id ? null : j.job_id)
                    },
                      React.createElement("td", { style: { padding: "0.4rem 0.35rem" } },
                        React.createElement("div", { style: { fontSize: "0.78rem", fontWeight: 500 } }, j.name || j.job_id),
                        React.createElement("div", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.65rem", opacity: 0.5 } }, j.job_id)
                      ),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, (j.runs || 0).toLocaleString()),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.total_cost)),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_cost)),
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
                      React.createElement("td", { colSpan: 7, style: { padding: "0.6rem 0.35rem 0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", fontSize: "0.72rem" } },
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.3rem" } },
                          React.createElement("div", {
                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
                          },
                            "Tokens: " + fmtCompact(j.total_tokens) + " total "
                              + "(" + fmtCompact(j.total_input_tokens) + " in / "
                              + fmtCompact(j.total_output_tokens) + " out / "
                              + fmtCompact(j.total_cache_read_tokens) + " cached)"
                          ),
                          React.createElement("div", {
                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", opacity: 0.7, whiteSpace: "pre" }
                          },
                            (j.projections && j.projections.schedule_display ? j.projections.schedule_display : "No schedule"),
                            "   Last: ", fmtTime(j.last_run),
                            j.last_model ? "   using " + j.last_model : "",
                            "   Next: ", j.projections && j.projections.next_run_at ? fmtRel(j.projections.next_run_at) : "\u2014"
                          )
                        )
                      )
                    )
                  ]).flat()
                )
              )
            )
        )
      ),

      // Cost Per-Model Breakdown
      s.cost_by_model && s.cost_by_model.length > 0 &&
        React.createElement(Card, null,
          React.createElement(CardHeader, null,
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
              CpuIcon(16),
              React.createElement(CardTitle, null, "Cost Per-Model Breakdown")
            )
          ),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.35rem" } },
              s.cost_by_model.map(m =>
                React.createElement("div", {
                  key: m.model,
                  style: { display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }
                },
                  React.createElement("span", null, m.model),
                  React.createElement("span", null, fmtCost(m.total_cost) + " (" + (m.runs || 0).toLocaleString() + " runs)")
                )
              )
            )
          )
        )
    );
  }

  PLUGINS.register("cronalytics", CronTab);
})();
