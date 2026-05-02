(function () {
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) return;

  const { React } = SDK;
  const { useState, useEffect, useLayoutEffect } = SDK.hooks;
  const { fetchJSON } = SDK;
  const { Card, CardHeader, CardTitle, CardContent, Badge } = SDK.components;

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
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
    return new Intl.DateTimeFormat(undefined, opts).format(d);
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

  // ── Day selector control ─────────────────────────────────────────
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
        gap: "0.25rem",
        background: "rgba(255,255,255,0.03)",
        padding: "0.2rem",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
        fontSize: "0.72rem",
        fontWeight: 500,
      }
    }, days.map(d => React.createElement("button", {
      key: d.value,
      onClick: () => onChange(d.value),
      style: {
        padding: "0.2rem 0.6rem",
        borderRadius: "0.2rem",
        border: "none",
        background: selected === d.value ? "var(--foreground-base, var(--foreground))" : "transparent",
        color: selected === d.value ? "var(--background-base, var(--background, #111))" : "var(--foreground-base, var(--foreground))",
        cursor: "pointer",
        fontWeight: selected === d.value ? 600 : 500,
        fontSize: "0.72rem",
      }
    }, d.label)));
  }

  // ── Main /cron tab ──────────────────────────────────────────────
  function CronTab() {
    const [days, setDaysRaw] = useState(() => {
      try {
        const saved = localStorage.getItem("cron-insights:days");
        if (saved !== null) return Number(saved);
      } catch {}
      return 30;
    });
    const setDays = (v) => {
      try { localStorage.setItem("cron-insights:days", String(v)); } catch {}
      setDaysRaw(v);
    };
    const summary = useApi("/api/plugins/cron-insights/summary?days=" + days);
    const jobs = useApi("/api/plugins/cron-insights/jobs?days=" + days);
    const [syncing, setSyncing] = useState(false);
    const [syncInfo, setSyncInfo] = useState(null);

    const pageHeader = SDK.usePageHeader ? SDK.usePageHeader() : null;

    useLayoutEffect(() => {
      if (!pageHeader) return;
      const windowLabel = days === 0 ? "All time" : "Last " + days + " days";
      pageHeader.setAfterTitle(
        React.createElement("span", {
          style: {
            fontSize: "0.7rem",
            opacity: 0.6,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }
        }, windowLabel)
      );
      pageHeader.setEnd(
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: "0.5rem" }
        },
          React.createElement(DaySelector, { selected: days, onChange: setDays })
        )
      );
      return () => {
        pageHeader.setAfterTitle(null);
        pageHeader.setEnd(null);
      };
    }, [days, pageHeader]);

    useEffect(() => {
      fetchJSON("/api/plugins/cron-insights/health")
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
      fetchJSON("/api/plugins/cron-insights/sync", { method: "POST" })
        .then(() => {
          fetchJSON("/api/plugins/cron-insights/health")
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

    if (summary.loading || jobs.loading) {
      return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } }, "Loading cron insights...");
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
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700 } }, s.total_runs || 0),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } }, windowLabel)
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Est. Cost")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700 } }, fmtCost(s.total_estimated_cost)),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } },
              "Trend: ", s.trend || "→", prevLabel
            )
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Tokens")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "0.8rem" } }, "In: " + (s.total_input_tokens || 0).toLocaleString()),
            React.createElement("div", { style: { fontSize: "0.8rem" } }, "Out: " + (s.total_output_tokens || 0).toLocaleString())
          )
        )
      ),

      // Cost by model
      s.cost_by_model && s.cost_by_model.length > 0 &&
        React.createElement(Card, { style: { marginBottom: "1.5rem" } },
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Cost by Model")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.35rem" } },
              s.cost_by_model.map(m =>
                React.createElement("div", {
                  key: m.model,
                  style: { display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }
                },
                  React.createElement("span", null, m.model),
                  React.createElement("span", null, fmtCost(m.total_cost) + " (" + m.runs + " runs)")
                )
              )
            )
          )
        ),

      // Jobs table
      React.createElement(Card, null,
        React.createElement(CardHeader, null,
          React.createElement(CardTitle, null, "Jobs"),
          React.createElement("div", { style: { display: "flex", gap: "0.75rem", alignItems: "center" } },
            syncInfo && syncInfo.lastSync &&
              React.createElement("span", {
                style: { fontSize: "0.65rem", opacity: 0.45, fontFamily: "var(--theme-font-mono, monospace)" }
              },
                "Synced " + fmtTime(new Date(syncInfo.lastSync).getTime() / 1000) +
                (syncInfo.rowsSynced != null ? " · " + syncInfo.rowsSynced + " rows" : "")
              ),
            React.createElement("button", {
              onClick: onSync,
              disabled: syncing,
              style: {
                fontSize: "0.68rem",
                padding: "0.25rem 0.55rem",
                border: "1px solid var(--foreground-base, var(--foreground))",
                borderRadius: "0.25rem",
                background: syncing ? "transparent" : "var(--foreground-base, var(--foreground))",
                color: syncing ? "var(--foreground-base, var(--foreground))" : "var(--background-base, var(--background, #111))",
                cursor: syncing ? "not-allowed" : "pointer",
                opacity: syncing ? 0.5 : 1,
                fontWeight: 600,
              }
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
                    ["Job", "Runs", "Total Cost", "Avg Cost", "Last Run", "Model"].map(h =>
                      React.createElement("th", {
                        key: h,
                        style: { textAlign: h === "Job ID" || h === "Model" || h === "Last Run" ? "left" : "right", padding: "0.5rem 0.35rem" }
                      }, h)
                    )
                  )
                ),
                React.createElement("tbody", null,
                  jobList.map(j =>
                    React.createElement("tr", {
                      key: j.job_id,
                      style: { borderBottom: "1px solid rgba(255,255,255,0.04)" }
                    },
                      React.createElement("td", { style: { padding: "0.4rem 0.35rem" } },
                        React.createElement("div", { style: { fontSize: "0.78rem", fontWeight: 500 } }, j.name || j.job_id),
                        React.createElement("div", { style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.65rem", opacity: 0.5 } }, j.job_id)
                      ),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, j.runs),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.total_cost)),
                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_cost)),
                      React.createElement("td", { style: { padding: "0.4rem 0.35rem", fontSize: "0.7rem" } }, fmtTime(j.last_run)),
                      React.createElement("td", { style: { padding: "0.4rem 0.35rem" } }, j.last_model)
                    )
                  )
                )
              )
            )
        )
      )
    );
  }

  // ── Header-right badge (sidebar) ────────────────────────────────
  function HeaderBadge() {
    const [status, setStatus] = React.useState(null);

    React.useEffect(() => {
      let cancelled = false;
      fetchJSON("/api/plugins/cron-insights/health")
        .then(d => { if (!cancelled) setStatus(d); })
        .catch(() => {});
      const id = setInterval(() => {
        fetchJSON("/api/plugins/cron-insights/health")
          .then(d => { if (!cancelled) setStatus(d); })
          .catch(() => {});
      }, 30000);
      return () => { cancelled = true; clearInterval(id); };
    }, []);

    if (!status || !status.fact_db) return null;

    const total = status.fact_db.total_runs || 0;
    const label = total > 0 ? total + " cron runs" : "Cron Insights";

    return React.createElement(Badge, { variant: "outline" }, label);
  }

  PLUGINS.register("cron-insights", CronTab);
  PLUGINS.registerSlot("cron-insights", "header-right", HeaderBadge);
})();
