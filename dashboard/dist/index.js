(function () {
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const PLUGINS = window.__HERMES_PLUGINS__;
  if (!SDK || !PLUGINS) return;

  const { React } = SDK;
  const { useState, useEffect } = SDK.hooks;
  const { fetchJSON } = SDK;
  const { Card, CardHeader, CardTitle, CardContent, Badge } = SDK.components;

  function fmtCost(n) {
    if (n == null) return "—";
    if (n === 0) return "$0.00";
    return "$" + parseFloat(n).toFixed(6);
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

  // ── Main /cron tab ──────────────────────────────────────────────
  function CronTab() {
    const summary = useApi("/api/plugins/cron-insights/summary?days=7");
    const jobs = useApi("/api/plugins/cron-insights/jobs?days=7");
    const [syncing, setSyncing] = useState(false);
    const [syncInfo, setSyncInfo] = useState(null);

    useEffect(() => {
      // Fetch sync status once on mount for last-sync metadata
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
        .then(d => {
          if (cancelled) return;
          // Refetch health to get authoritative watermark after sync finishes
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
      return () => { cancelled = true; };
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

    return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } },
      // Page title
      React.createElement("h2", { style: { marginBottom: "0.5rem", fontSize: "1.125rem", fontWeight: 600 } }, "Cron Insights"),

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
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } }, "Last 7 days")
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, "Est. Cost")),
          React.createElement(CardContent, null,
            React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700 } }, fmtCost(s.total_estimated_cost)),
            React.createElement("div", { style: { fontSize: "0.7rem", opacity: 0.6 } },
              "Trend: ", s.trend || "→",
              s.previous_period ? " (prev " + fmtCost(s.previous_period.cost) + ")" : ""
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
                  ? "No jobs in the last 7 days. Last sync: " + syncInfo.lastSync.split("T").join(" ").slice(0, 19) + " UTC"
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
