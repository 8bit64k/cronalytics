     1|(function () {
     2|  "use strict";
     3|  const SDK = window.__HERMES_PLUGIN_SDK__;
     4|  const PLUGINS = window.__HERMES_PLUGINS__;
     5|  if (!SDK || !PLUGINS) return;
     6|
     7|  const { React } = SDK;
     8|  const { useState, useEffect, useRef } = SDK.hooks;
     9|  const { fetchJSON } = SDK;
    10|  const { Card, CardHeader, CardTitle, CardContent, Badge, Button } = SDK.components;
    11|
    12|  // ── Currency formatter: 2 decimals with smart truncation ─────────
    13|  function fmtCost(n) {
    14|    if (n == null) return "—";
    15|    if (n === 0) return "$0.00";
    16|    return new Intl.NumberFormat("en-US", {
    17|      style: "currency",
    18|      currency: "USD",
    19|      minimumFractionDigits: 2,
    20|      maximumFractionDigits: 2,
    21|    }).format(n);
    22|  }
    23|
    24|  function fmtTime(ts) {
    25|    if (!ts) return "\u2014";
    26|    const d = new Date(ts * 1000);
    27|    const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
    28|    return new Intl.DateTimeFormat(undefined, opts).format(d);
    29|  }
    30|
    31|  function fmtRel(iso) {
    32|    if (!iso) return "\u2014";
    33|    const d = new Date(iso);
    34|    const now = new Date();
    35|    const diffMs = d - now;
    36|    if (diffMs < 0) return "Overdue";
    37|    const h = Math.floor(diffMs / (1000 * 60 * 60));
    38|    const d2 = Math.floor(h / 24);
    39|    if (h < 1) return Math.floor(diffMs / (1000 * 60)) + "m";
    40|    if (d2 > 0) return d2 + "d " + (h % 24) + "h";
    41|    return h + "h";
    42|  }
    43|
    44|  function fmtCompact(n) {
    45|    if (n == null || n === 0) return "0";
    46|    const abs = Math.abs(n);
    47|    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
    48|    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    49|    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
    50|    return n.toLocaleString();
    51|  }
    52|
    53|  function paceColor(pace) {
    54|    if (pace == null) return "var(--foreground-base, var(--foreground))";
    55|    if (pace < 1.0) return "#4ade80";   // green
    56|    if (pace < 2.0) return null;        // neutral — normal zone, inherit default text color
    57|    return "#ef4444";                   // red
    58|  }
    59|
    60|  function paceBg(pace) {
    61|    // Pace no longer uses background pills (font color only)
    62|    return "transparent";
    63|  }
    64|
    65|  function CpuIcon(size) {
    66|    return React.createElement("svg", {
    67|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    68|      fill: "none", stroke: "currentColor", strokeWidth: 2,
    69|      strokeLinecap: "round", strokeLinejoin: "round",
    70|      style: { display: "inline-block", verticalAlign: "middle" }
    71|    },
    72|      React.createElement("path", { d: "M12 20v2" }),
    73|      React.createElement("path", { d: "M12 2v2" }),
    74|      React.createElement("path", { d: "M17 20v2" }),
    75|      React.createElement("path", { d: "M17 2v2" }),
    76|      React.createElement("path", { d: "M2 12h2" }),
    77|      React.createElement("path", { d: "M2 17h2" }),
    78|      React.createElement("path", { d: "M2 7h2" }),
    79|      React.createElement("path", { d: "M20 12h2" }),
    80|      React.createElement("path", { d: "M20 17h2" }),
    81|      React.createElement("path", { d: "M20 7h2" }),
    82|      React.createElement("path", { d: "M7 20v2" }),
    83|      React.createElement("path", { d: "M7 2v2" }),
    84|      React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: 2 }),
    85|      React.createElement("rect", { x: "8", y: "8", width: "8", height: "8", rx: 1 })
    86|    );
    87|  }
    88|  function ClockIcon(size) {
    89|    return React.createElement("svg", {
    90|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    91|      fill: "none", stroke: "currentColor", strokeWidth: 2,
    92|      strokeLinecap: "round", strokeLinejoin: "round",
    93|      style: { display: "inline-block", verticalAlign: "middle" }
    94|    },
    95|      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
    96|      React.createElement("path", { d: "M12 6v6l4 2" })
    97|    );
    98|  }
    99|  function RefreshCwIcon(size) {
   100|    return React.createElement("svg", {
   101|      width: size || 14, height: size || 14, viewBox: "0 0 24 24",
   102|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   103|      strokeLinecap: "round", strokeLinejoin: "round",
   104|      style: { display: "inline-block", verticalAlign: "middle" }
   105|    },
   106|      React.createElement("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
   107|      React.createElement("path", { d: "M21 3v5h-5" }),
   108|      React.createElement("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
   109|      React.createElement("path", { d: "M8 16H3v5" })
   110|    );
   111|  }
   112|  function BanknoteIcon(size) {
   113|    return React.createElement("svg", {
   114|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
   115|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   116|      strokeLinecap: "round", strokeLinejoin: "round",
   117|      style: { display: "inline-block", verticalAlign: "middle" }
   118|    },
   119|      React.createElement("rect", { width: 20, height: 12, x: 2, y: 6, rx: 2 }),
   120|      React.createElement("circle", { cx: 12, cy: 12, r: 2 }),
   121|      React.createElement("path", { d: "M6 12h.01M18 12h.01" })
   122|    );
   123|  }
   124|  function BlocksIcon(size) {
   125|    return React.createElement("svg", {
   126|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
   127|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   128|      strokeLinecap: "round", strokeLinejoin: "round",
   129|      style: { display: "inline-block", verticalAlign: "middle" }
   130|    },
   131|      React.createElement("path", { d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" }),
   132|      React.createElement("rect", { x: 14, y: 2, width: 8, height: 8, rx: 1 })
   133|    );
   134|  }
   135|  function MetronomeIcon(size) {
   136|    return React.createElement("svg", {
   137|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
   138|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   139|      strokeLinecap: "round", strokeLinejoin: "round",
   140|      style: { display: "inline-block", verticalAlign: "middle" }
   141|    },
   142|      React.createElement("path", { d: "M12 11.4V9.1" }),
   143|      React.createElement("path", { d: "m12 17 6.59-6.59" }),
   144|      React.createElement("path", { d: "m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2" }),
   145|      React.createElement("circle", { cx: 20, cy: 9, r: 2 })
   146|    );
   147|  }
   148|  function ZapIcon(size) {
   149|    return React.createElement("svg", {
   150|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
   151|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   152|      strokeLinecap: "round", strokeLinejoin: "round",
   153|      style: { display: "inline-block", verticalAlign: "middle" }
   154|    },
   155|      React.createElement("path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" })
   156|    );
   157|  }
   158|
   159|  function InfoIcon(props) {
   160|    const { size, style } = props || {};
   161|    return React.createElement("svg", {
   162|      xmlns: "http://www.w3.org/2000/svg",
   163|      width: size || 16, height: size || 16, viewBox: "0 0 24 24",
   164|      fill: "none", stroke: "currentColor", strokeWidth: 2,
   165|      strokeLinecap: "round", strokeLinejoin: "round",
   166|      style: Object.assign({ display: "inline-block", verticalAlign: "middle", cursor: "pointer" }, style || {})
   167|    },
   168|      React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
   169|      React.createElement("path", { d: "M12 16v-4" }),
   170|      React.createElement("path", { d: "M12 8h.01" })
   171|    );
   172|  }
   173|
   174|  function useApi(path) {
   175|    const [data, setData] = useState(null);
   176|    const [loading, setLoading] = useState(true);
   177|    const [error, setError] = useState(null);
   178|    const [reload, setReload] = useState(0);
   179|    useEffect(() => {
   180|      let cancelled = false;
   181|      setLoading(true);
   182|      fetchJSON(path)
   183|        .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
   184|        .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
   185|      return () => { cancelled = true; };
   186|    }, [path, reload]);
   187|    return { data, loading, error, refetch: () => setReload(r => r + 1) };
   188|  }
   189|
   190|  function useModal() {
   191|    const [isOpen, setOpen] = useState(false);
   192|    const open = () => setOpen(true);
   193|    const close = () => setOpen(false);
   194|    return { isOpen, open, close };
   195|  }
   196|
   197|  // ── Modal overlay for card drill-down ──────────────────────────────
   198|  function Modal({ isOpen, onClose, children }) {
   199|    const backdropRef = useRef(null);
   200|    useEffect(() => {
   201|      if (!isOpen) return;
   202|      const onKey = (e) => { if (e.key === "Escape") onClose(); };
   203|      document.addEventListener("keydown", onKey);
   204|      return () => document.removeEventListener("keydown", onKey);
   205|    }, [isOpen, onClose]);
   206|    if (!isOpen) return null;
   207|    return React.createElement("div", {
   208|      ref: backdropRef,
   209|      role: "dialog",
   210|      "aria-modal": true,
   211|      onClick: (e) => { if (e.target === backdropRef.current) onClose(); },
   212|      style: {
   213|        position: "fixed", inset: 0,
   214|        background: "rgba(0,0,0,0.78)",
   215|        zIndex: 100,
   216|        display: "flex", alignItems: "center", justifyContent: "center",
   217|        padding: "1rem",
   218|      }
   219|    }, React.createElement("div", {
   220|      style: {
   221|        background: "var(--background)",
   222|        color: "var(--foreground-base, var(--foreground))",
   223|        border: "1px solid var(--color-border)",
   224|        borderRadius: "0.5rem",
   225|        width: "100%", maxWidth: "28rem",
   226|        maxHeight: "85vh",
   227|        overflow: "auto",
   228|        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
   229|        position: "relative",
   230|      }
   231|    },
   232|      React.createElement("button", {
   233|        type: "button",
   234|        "aria-label": "Close",
   235|        onClick: onClose,
   236|        style: {
   237|          position: "absolute", top: "0.6rem", right: "0.6rem",
   238|          width: "2rem", height: "2rem",
   239|          display: "flex", alignItems: "center", justifyContent: "center",
   240|          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.35rem",
   241|          color: "var(--foreground-base, var(--foreground))", fontSize: "1.25rem",
   242|          cursor: "pointer", lineHeight: 1,
   243|          transition: "background 0.15s ease",
   244|        },
   245|        onMouseEnter: (e) => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; },
   246|        onMouseLeave: (e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; },
   247|      }, "\u00d7"),
   248|      children
   249|    ));
   250|  }
   251|
   252|  // ── Day selector control (uses SDK Button to match Analytics tab) ─
   253|  function DaySelector({ selected, onChange }) {
   254|    const days = [
   255|      { label: "7D", value: 7 },
   256|      { label: "30D", value: 30 },
   257|      { label: "90D", value: 90 },
   258|      { label: "All", value: 0 },
   259|    ];
   260|    return React.createElement("div", {
   261|      style: {
   262|        display: "flex",
   263|        flexWrap: "wrap",
   264|        alignItems: "center",
   265|        gap: "0.375rem",
   266|      }
   267|    }, days.map(d => React.createElement(Button, {
   268|      key: d.value,
   269|      type: "button",
   270|      size: "sm",
   271|      outlined: selected !== d.value,
   272|      onClick: () => onChange(d.value),
   273|    }, d.label)));
   274|  }
   275|
   276|    // ── Main /cron tab ──────────────────────────────────────────────
   277|    function CronTab() {
   278|      const [days, setDaysRaw] = useState(() => {
   279|        try {
   280|          const saved = localStorage.getItem("cronalytics:days");
   281|          if (saved !== null) return Number(saved);
   282|        } catch {}
   283|        return 30;
   284|      });
   285|      const setDays = (v) => {
   286|        try { localStorage.setItem("cronalytics:days", String(v)); } catch {}
   287|        setDaysRaw(v);
   288|      };
   289|      const summary = useApi("/api/plugins/cronalytics/summary?days=" + days);
   290|      const jobs = useApi("/api/plugins/cronalytics/jobs?days=" + days);
   291|      const [syncing, setSyncing] = useState(false);
   292|      const [syncInfo, setSyncInfo] = useState(null);
   293|
   294|      const [expandedId, setExpandedId] = useState(null);
   295|      const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
   296|      const paceModal = useModal();
   297|      const runsModal = useModal();
   298|      const costModal = useModal();
   299|      const tokensModal = useModal();
   300|      const topRunsModal = useModal();
   301|      const topCostModal = useModal();
   302|      const topTokensModal = useModal();
   303|      const topPaceModal = useModal();
   304|
   305|    useEffect(() => {
   306|      fetchJSON("/api/plugins/cronalytics/health")
   307|        .then(d => {
   308|          if (d && d.sync) {
   309|            setSyncInfo({
   310|              lastSync: d.sync.last_sync,
   311|              rowsSynced: d.sync.rows_synced,
   312|            });
   313|          }
   314|        })
   315|        .catch(() => {});
   316|    }, []);
   317|
   318|    const onSync = () => {
   319|      if (syncing) return;
   320|      setSyncing(true);
   321|      let cancelled = false;
   322|      fetchJSON("/api/plugins/cronalytics/sync", { method: "POST" })
   323|        .then(() => {
   324|          fetchJSON("/api/plugins/cronalytics/health")
   325|            .then(d2 => {
   326|              if (d2 && d2.sync) {
   327|                setSyncInfo({
   328|                  lastSync: d2.sync.last_sync,
   329|                  rowsSynced: d2.sync.rows_synced,
   330|                });
   331|              }
   332|            })
   333|            .catch(() => {});
   334|          summary.refetch();
   335|          jobs.refetch();
   336|        })
   337|        .catch(e => {
   338|          if (!cancelled) setSyncInfo({ error: e.message });
   339|        })
   340|        .finally(() => {
   341|          if (!cancelled) setSyncing(false);
   342|        });
   343|    };
   344|
   345|    const firstLoad = summary.loading && !summary.data && jobs.loading && !jobs.data;
   346|    if (firstLoad) {
   347|      return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } }, "Loading Cronalytics…");
   348|    }
   349|
   350|    if (summary.error || jobs.error) {
   351|      return React.createElement("div", { style: { padding: "1rem", color: "var(--color-destructive)" } },
   352|        "Error: " + (summary.error || jobs.error)
   353|      );
   354|    }
   355|
   356|    const s = summary.data || {};
   357|    const jobList = (jobs.data && jobs.data.jobs) ? jobs.data.jobs : [];
   358|    const windowLabel = days === 0 ? "All time" : "Last " + days + " days";
   359|    const prevLabel = s.previous_period && s.previous_period.cost !== undefined
   360|      ? " (prev " + fmtCost(s.previous_period.cost) + ")"
   361|      : "";
   362|
   363|    const costPct = s.previous_period && s.previous_period.cost != null && s.previous_period.cost !== 0
   364|      ? ((s.total_estimated_cost - s.previous_period.cost) / s.previous_period.cost) * 100
   365|      : null;
   366|    const runPct = s.previous_period && s.previous_period.runs != null && s.previous_period.runs !== 0
   367|      ? ((s.total_runs - s.previous_period.runs) / s.previous_period.runs) * 100
   368|      : null;
   369|
   370|    const getSortValue = (j, key) => {
   371|      switch (key) {
   372|        case "Job": return j.name || j.job_id;
   373|        case "Runs": return j.runs || 0;
   374|        case "Total Cost": return j.total_cost || 0;
   375|        case "Avg Cost": return j.avg_cost || 0;
   376|        case "Nominal/mo": return j.projections && j.projections.projected_cost_30d != null ? j.projections.projected_cost_30d : -Infinity;
   377|        case "Trend/mo": return j.projections && j.projections.trend_projected_cost_30d != null ? j.projections.trend_projected_cost_30d : -Infinity;
   378|        case "Pace": return j.projections && j.projections.pace != null ? j.projections.pace : -Infinity;
   379|        default: return 0;
   380|      }
   381|    };
   382|
   383|    const sortedJobs = [...jobList].sort((a, b) => {
   384|      if (!sortConfig.key) return 0;
   385|      const va = getSortValue(a, sortConfig.key);
   386|      const vb = getSortValue(b, sortConfig.key);
   387|      if (typeof va === "string" && typeof vb === "string") {
   388|        return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
   389|      }
   390|      return sortConfig.direction === "asc" ? va - vb : vb - va;
   391|    });
   392|
   393|    return React.createElement("div", { style: { padding: "1rem", color: "var(--foreground-base, var(--foreground))" } },
   394|      // Inline toolbar: day selector + refresh (right-aligned, title is in page header)
   395|      React.createElement("div", {
   396|        style: { display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "0.5rem" }
   397|      },
   398|        React.createElement("div", { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
   399|          React.createElement(DaySelector, { selected: days, onChange: setDays }),
   400|          React.createElement(Button, {
   401|            type: "button",
   402|            size: "sm",
   403|            outlined: true,
   404|            disabled: summary.loading || jobs.loading,
   405|            onClick: () => { summary.refetch(); jobs.refetch(); },
   406|            style: { minWidth: "5.5rem" }
   407|          }, summary.loading || jobs.loading
   408|            ? "\u2026"
   409|            : React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "0.25rem" } },
   410|                RefreshCwIcon(14),
   411|                "Refresh"
   412|              )
   413|          )
   414|        )
   415|      ),
   416|
   417|      // Summary cards
   418|      React.createElement("div", {
   419|        style: {
   420|          display: "grid",
   421|          gridTemplateColumns: "repeat(4, 1fr)",
   422|          gap: "1rem",
   423|          marginBottom: "1.5rem",
   424|          alignItems: "stretch"
   425|        }
   426|      },
   427|        React.createElement("div", {
   428|            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   429|            onClick: runsModal.open,
   430|            onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   431|            onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   432|          },
   433|          React.createElement("div", {
   434|            style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   435|            onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   436|            onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   437|          }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   438|          React.createElement(Card, { style: { flex: 1 } },
   439|            React.createElement(CardHeader, null,
   440|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   441|                React.createElement("span", { style: { color: "silver", lineHeight: 0 } }, ZapIcon(14)),
   442|                React.createElement(CardTitle, null, "Job Runs")
   443|              )
   444|            ),
   445|            React.createElement(CardContent, null,
   446|              React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } }, (s.total_runs || 0).toLocaleString()),
   447|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
   448|                runPct != null ? (runPct > 0 ? "↑ " : "↓ ") + Math.abs(runPct).toFixed(0) + "%" : "—"
   449|              ),
   450|              React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
   451|                "vs prior ", days === 0 ? "period" : days + "d"
   452|              )
   453|            )
   454|          )
   455|        ),
   456|        React.createElement("div", {
   457|          style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   458|          onClick: costModal.open,
   459|          onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   460|          onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   461|        },
   462|          React.createElement("div", {
   463|            style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   464|            onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   465|            onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   466|          }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   467|          React.createElement(Card, { style: { flex: 1 } },
   468|            React.createElement(CardHeader, null,
   469|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   470|                React.createElement("span", { style: { color: "silver", lineHeight: 0 } }, BanknoteIcon(14)),
   471|                React.createElement(CardTitle, null, "Cost")
   472|              )
   473|            ),
   474|            React.createElement(CardContent, null,
   475|              React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
   476|                fmtCost(s.total_estimated_cost)
   477|              ),
   478|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: costPct != null ? (costPct > 0 ? "#ef4444" : "#4ade80") : null } },
   479|                costPct != null ? (costPct > 0 ? "↑ " : "↓ ") + Math.abs(costPct).toFixed(0) + "%" : "—"
   480|              ),
   481|              React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.1rem" } },
   482|                "vs prior ", days === 0 ? "period" : days + "d"
   483|              ),
   484|              React.createElement("div", { style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.3rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.25rem" } },
   485|                "Actual: ", s.total_actual_cost != null ? fmtCost(s.total_actual_cost) : "—"
   486|              )
   487|            )
   488|          )
   489|        ),
   490|        React.createElement("div", {
   491|            style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   492|            onClick: tokensModal.open,
   493|            onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   494|            onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   495|          },
   496|          React.createElement("div", {
   497|            style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   498|            onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   499|            onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   500|          }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   501|          React.createElement(Card, { style: { flex: 1 } },
   502|            React.createElement(CardHeader, null,
   503|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   504|                React.createElement("span", { style: { color: "silver", lineHeight: 0 } }, BlocksIcon(14)),
   505|                React.createElement(CardTitle, null, "Tokens")
   506|              )
   507|            ),
   508|            React.createElement(CardContent, null,
   509|              React.createElement("div", { style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
   510|                fmtCompact(s.total_tokens)
   511|              ),
   512|              React.createElement("div", { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
   513|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   514|                  React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "In"),
   515|                  React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
   516|                    React.createElement("div", { style: { width: Math.min(100, ((s.total_input_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
   517|                  ),
   518|                  React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_input_tokens))
   519|                ),
   520|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   521|                  React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Out"),
   522|                  React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
   523|                    React.createElement("div", { style: { width: Math.min(100, ((s.total_output_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
   524|                  ),
   525|                  React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_output_tokens))
   526|                ),
   527|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   528|                  React.createElement("span", { style: { width: "2.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Cached"),
   529|                  React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
   530|                    React.createElement("div", { style: { width: Math.min(100, ((s.total_cache_read_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
   531|                  ),
   532|                  React.createElement("span", { style: { width: "3.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCompact(s.total_cache_read_tokens))
   533|                )
   534|              )
   535|            )
   536|          )
   537|        ),
   538|        (function() {
   539|          const nominalPace = s.nominal_monthly_total || 0;
   540|          const trendPace = s.trend_monthly_total || 0;
   541|          const maxPace = Math.max(nominalPace, trendPace, 1);
   542|          return React.createElement("div", {
   543|              style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   544|              onClick: paceModal.open,
   545|              onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   546|              onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   547|            },
   548|            React.createElement("div", {
   549|              style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   550|              onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   551|              onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   552|            }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   553|            React.createElement(Card, { style: { flex: 1 } },
   554|              React.createElement(CardHeader, null,
   555|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   556|                  React.createElement("span", { style: { color: "silver", lineHeight: 0 } }, MetronomeIcon(14)),
   557|                  React.createElement(CardTitle, null, "Pace")
   558|                )
   559|              ),
   560|              React.createElement(CardContent, null,
   561|                React.createElement("div", {
   562|                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) }
   563|                }, s.pace != null ? s.pace.toFixed(2) + "×" : "—"),
   564|                React.createElement("div", { style: { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
   565|                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   566|                    React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Nominal"),
   567|                    React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
   568|                      React.createElement("div", { style: { width: (Math.min(100, (nominalPace / maxPace) * 100)) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
   569|                    ),
   570|                    React.createElement("span", { style: { width: "4.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(nominalPace))
   571|                  ),
   572|                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   573|                    React.createElement("span", { style: { width: "3.5rem", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, "Trend"),
   574|                    React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.3rem", overflow: "hidden" } },
   575|                      React.createElement("div", { style: { width: (Math.min(100, (trendPace / maxPace) * 100)) + "%", background: 'var(--foreground-base, var(--foreground))', height: "100%", opacity: 0.6 } })
   576|                    ),
   577|                    React.createElement("span", { style: { width: "4.5rem", textAlign: "right", fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)" } }, fmtCost(trendPace))
   578|                  )
   579|                )
   580|              )
   581|            )
   582|          );
   583|        })(),
   584|        (() => {
   585|          const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
   586|          const label = j ? (j.name || j.job_id) : "—";
   587|          return React.createElement("div", {
   588|              style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   589|              onClick: topRunsModal.open,
   590|              onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   591|              onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   592|            },
   593|            React.createElement("div", {
   594|              style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   595|              onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   596|              onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   597|            }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   598|            React.createElement(Card, { style: { flex: 1 } },
   599|              React.createElement(CardHeader, null,
   600|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   601|                  React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, ZapIcon(13)), React.createElement(CardTitle, null, "Top Runs")
   602|                )
   603|              ),
   604|              React.createElement(CardContent, null,
   605|                React.createElement("div", {
   606|                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
   607|                }, j ? (j.runs || 0).toLocaleString() : "—"),
   608|                React.createElement("div", {
   609|                  style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
   610|                  title: label
   611|                }, label),
   612|                React.createElement("div", { style: { height: "3rem" } })
   613|              )
   614|            )
   615|          );
   616|        })(),
   617|        (() => {
   618|          const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_cost || 0) > (a.total_cost || 0) ? b : a, jobList[0]) : null;
   619|          const label = j ? (j.name || j.job_id) : "—";
   620|          return React.createElement("div", {
   621|              style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   622|              onClick: topCostModal.open,
   623|              onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   624|              onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   625|            },
   626|            React.createElement("div", {
   627|              style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   628|              onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   629|              onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   630|            }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   631|            React.createElement(Card, { style: { flex: 1 } },
   632|              React.createElement(CardHeader, null,
   633|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   634|                  React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BanknoteIcon(13)), React.createElement(CardTitle, null, "Top Cost")
   635|                )
   636|              ),
   637|              React.createElement(CardContent, null,
   638|                React.createElement("div", {
   639|                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#f5a623", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
   640|                }, j ? fmtCost(j.total_cost) : "—"),
   641|                React.createElement("div", {
   642|                  style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
   643|                  title: label
   644|                }, label),
   645|                React.createElement("div", { style: { height: "3rem" } })
   646|              )
   647|            )
   648|          );
   649|        })(),
   650|        (() => {
   651|          const j = jobList.length > 0 ? jobList.reduce((a, b) => ((b.total_tokens || 0) > (a.total_tokens || 0) ? b : a), jobList[0]) : null;
   652|          const label = j ? (j.name || j.job_id) : "—";
   653|          return React.createElement("div", {
   654|              style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   655|              onClick: topTokensModal.open,
   656|              onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   657|              onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   658|            },
   659|            React.createElement("div", {
   660|              style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   661|              onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   662|              onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   663|            }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   664|            React.createElement(Card, { style: { flex: 1 } },
   665|              React.createElement(CardHeader, null,
   666|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   667|                  React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, BlocksIcon(13)), React.createElement(CardTitle, null, "Top Tokens")
   668|                )
   669|              ),
   670|              React.createElement(CardContent, null,
   671|                React.createElement("div", {
   672|                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: "#5b8def", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
   673|                }, j ? fmtCompact(j.total_tokens) : "—"),
   674|                React.createElement("div", {
   675|                  style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
   676|                  title: label
   677|                }, label),
   678|                React.createElement("div", { style: { height: "3rem" } })
   679|              )
   680|            )
   681|          );
   682|        })(),
   683|        (() => {
   684|          const j = jobList.length > 0
   685|            ? jobList.reduce((a, b) => {
   686|                const aPace = (a.projections && a.projections.pace != null) ? a.projections.pace : -Infinity;
   687|                const bPace = (b.projections && b.projections.pace != null) ? b.projections.pace : -Infinity;
   688|                return bPace > aPace ? b : a;
   689|              }, jobList[0])
   690|            : null;
   691|          const label = j ? (j.name || j.job_id) : "—";
   692|          const p = j && j.projections && j.projections.pace != null ? j.projections.pace : null;
   693|          return React.createElement("div", {
   694|              style: { position: "relative", cursor: "pointer", transition: "box-shadow 0.2s ease", height: "100%", display: "flex", flexDirection: "column" },
   695|              onClick: topPaceModal.open,
   696|              onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.18), 0 0 22px rgba(255,255,255,0.10), 0 0 6px rgba(255,255,255,0.15)"; },
   697|              onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ""; },
   698|            },
   699|            React.createElement("div", {
   700|              style: { position: "absolute", top: "0.35rem", right: "0.35rem", zIndex: 2, opacity: 0.4, transition: "opacity 0.2s ease" },
   701|              onMouseEnter: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "1"; },
   702|              onMouseLeave: (e) => { e.stopPropagation(); e.currentTarget.style.opacity = "0.4"; },
   703|            }, InfoIcon({ size: 14, style: { color: "var(--foreground-base, var(--foreground))" } })),
   704|            React.createElement(Card, { style: { flex: 1 } },
   705|              React.createElement(CardHeader, null,
   706|                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   707|                  React.createElement("span", { style: { color: "#ff5722", lineHeight: 0 } }, MetronomeIcon(13)), React.createElement(CardTitle, null, "Top Pace")
   708|                )
   709|              ),
   710|              React.createElement(CardContent, null,
   711|                React.createElement("div", {
   712|                  style: { fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", lineHeight: 1.15, color: p != null ? paceColor(p) : null, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
   713|                }, p != null ? p.toFixed(2) + "×" : "—"),
   714|                React.createElement("div", {
   715|                  style: { fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--theme-font-mono, monospace)", opacity: 0.85, marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
   716|                  title: label
   717|                }, label),
   718|                React.createElement("div", { style: { height: "3rem" } })
   719|              )
   720|            )
   721|          );
   722|        })(),
   723|      ),
   724|      // ── Pace Modal (educational drill-down) ──────────────────────────
   725|      React.createElement(Modal, { isOpen: paceModal.isOpen, onClose: paceModal.close },
   726|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   727|          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   728|            React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(s.pace) } },
   729|              s.pace != null ? s.pace.toFixed(2) + "\u00d7" : "\u2014"
   730|            ),
   731|            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Pace")
   732|          ),
   733|          React.createElement("div", { style: { marginBottom: "1rem" } },
   734|            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
   735|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   736|                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Nominal"),
   737|                React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
   738|                  React.createElement("div", { style: { width: (Math.min(100, ((s.nominal_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1)) * 100)) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
   739|                ),
   740|                React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(s.nominal_monthly_total) + "/mo")
   741|              ),
   742|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   743|                React.createElement("span", { style: { width: "4.5rem", fontSize: "0.8rem" } }, "Trend"),
   744|                React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
   745|                  React.createElement("div", { style: { width: (Math.min(100, ((s.trend_monthly_total || 1) / Math.max(s.nominal_monthly_total || 1, s.trend_monthly_total || 1, 1)) * 100)) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
   746|                ),
   747|                React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(s.trend_monthly_total) + "/mo")
   748|              )
   749|            )
   750|          ),
   751|          React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   752|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
   753|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
   754|              "Pace compares your actual spending trend against the budget you set in your cron job definitions. It answers: \u2018At this rate, am I over or under budget?\u2019"
   755|            ),
   756|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "How it\u2019s calculated"),
   757|            React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
   758|              React.createElement("div", null, "Nominal = scheduled runs \u00d7 average cost per run"),
   759|              React.createElement("div", null, "Trend     = actual runs \u00d7 average cost per run"),
   760|              React.createElement("div", null, "Pace      = Trend / Nominal"),
   761|              React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6 } }, "All scaled to a 30\u2011day month using the selected window.")
   762|            ),
   763|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Color guide"),
   764|            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.78rem", marginBottom: "0.75rem" } },
   765|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   766|                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#4ade80" } }),
   767|                React.createElement("span", null, "Green (< 1.0\u00d7) \u2014 Under budget. Spending less than scheduled.")
   768|              ),
   769|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   770|                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "var(--foreground)" } }),
   771|                React.createElement("span", null, "Neutral (1.0\u20132.0\u00d7) \u2014 On track. Slight variance within normal range.")
   772|              ),
   773|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
   774|                React.createElement("span", { style: { display: "inline-block", width: "0.6rem", height: "0.6rem", borderRadius: "50%", background: "#ef4444" } }),
   775|                React.createElement("span", null, "Red (\u2265 2.0\u00d7) \u2014 Over budget. Actual spend is double (or more) the nominal rate.")
   776|              )
            ),
   790|        )
   791|      ),
   792|      // ── Runs Modal ─────────────────────────────────────────────────────
   793|      React.createElement(Modal, { isOpen: runsModal.isOpen, onClose: runsModal.close },
   794|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   795|          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   796|            React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
   797|              (s.total_runs || 0).toLocaleString()
   798|            ),
   799|            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Job Runs")
   800|          ),
   801|          runPct != null && React.createElement("div", { style: { marginBottom: "1rem" } },
   802|            React.createElement("div", { style: { fontSize: "0.8rem", color: runPct > 0 ? "#ef4444" : "#4ade80" } },
   803|              (runPct > 0 ? "↑ " : "↓ ") + Math.abs(runPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
   804|            )
   805|          ),
   806|          React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   807|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
   808|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
   809|              "Total number of cron job executions recorded in the selected window. Each run triggers your scheduled task—whether it succeeds, fails, or retries."
   810|            ),
   811|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
   812|            React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
   813|              React.createElement("div", null, "Trend % = ((current runs \u2212 prior runs) / prior runs) \u00d7 100"),
   814|              React.createElement("div", { style: { marginTop: "0.25rem", opacity: 0.6 } }, "Positive = more runs than the prior window. Negative = fewer runs."),
   815|            ),
   816|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
   817|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
   818|              "Showing ", React.createElement("strong", null, windowLabel), ". The prior comparison window is the same duration shifted back in time."
   819|            )
   820|          )
   821|        )
   822|      ),
   823|      // ── Cost Modal ─────────────────────────────────────────────────────
   824|      React.createElement(Modal, { isOpen: costModal.isOpen, onClose: costModal.close },
   825|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   826|          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   827|            React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
   828|              fmtCost(s.total_estimated_cost)
   829|            ),
   830|            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Estimated Cost")
   831|          ),
   832|          s.total_actual_cost != null && React.createElement("div", { style: { marginBottom: "0.75rem", fontSize: "0.8rem", opacity: 0.85 } },
   833|            "Actual: ", React.createElement("span", { style: { fontWeight: 700 } }, fmtCost(s.total_actual_cost))
   834|          ),
   835|          costPct != null && React.createElement("div", { style: { marginBottom: "1rem" } },
   836|            React.createElement("div", { style: { fontSize: "0.8rem", color: costPct > 0 ? "#ef4444" : "#4ade80" } },
   837|              (costPct > 0 ? "↑ " : "↓ ") + Math.abs(costPct).toFixed(0) + "% vs prior " + (days === 0 ? "period" : days + "d")
   838|            )
   839|          ),
   840|          React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   841|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
   842|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
   843|              "Estimated cost is calculated from token usage and model pricing. Actual cost may differ slightly depending on provider billing granularity."
   844|            ),
   845|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Trend calculation"),
   846|            React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
   847|              React.createElement("div", null, "Trend % = ((current cost \u2212 prior cost) / prior cost) \u00d7 100"),
   848|            ),
   849|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Window context"),
   850|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85 } },
   851|              "Showing ", React.createElement("strong", null, windowLabel), ". The prior comparison window is the same duration shifted back in time."
   852|            )
   853|          )
   854|        )
   855|      ),
   856|      // ── Tokens Modal ───────────────────────────────────────────────────
   857|      React.createElement(Modal, { isOpen: tokensModal.isOpen, onClose: tokensModal.close },
   858|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   859|          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   860|            React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
   861|              fmtCompact(s.total_tokens)
   862|            ),
   863|            React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "Tokens")
   864|          ),
   865|          React.createElement("div", { style: { marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.2rem" } },
   866|            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   867|              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "In"),
   868|              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
   869|                React.createElement("div", { style: { width: Math.min(100, ((s.total_input_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
   870|              ),
   871|              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_input_tokens))
   872|            ),
   873|            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   874|              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Out"),
   875|              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
   876|                React.createElement("div", { style: { width: Math.min(100, ((s.total_output_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
   877|              ),
   878|              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_output_tokens))
   879|            ),
   880|            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
   881|              React.createElement("span", { style: { width: "4rem", fontSize: "0.8rem" } }, "Cached"),
   882|              React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
   883|                React.createElement("div", { style: { width: Math.min(100, ((s.total_cache_read_tokens || 0) / (s.total_tokens || 1)) * 100) + "%", background: "#5b8def", height: "100%", opacity: 0.8 } })
   884|              ),
   885|              React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem" } }, fmtCompact(s.total_cache_read_tokens))
   886|            )
   887|          ),
   888|          React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   889|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "What this means"),
   890|            React.createElement("p", { style: { fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.85, marginBottom: "0.75rem" } },
   891|              "Tokens are the currency of LLM usage. Input tokens are your prompts + context. Output tokens are the model's response. Cached tokens come from repeated prompts with identical prefixes (cheaper)."
   892|            ),
   893|            React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Breakdown"),
   894|            React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", marginBottom: "0.75rem", lineHeight: 1.6 } },
   895|              React.createElement("div", null, "Input:  " + fmtCompact(s.total_input_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_input_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
   896|              React.createElement("div", null, "Output: " + fmtCompact(s.total_output_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_output_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)"),
   897|              React.createElement("div", null, "Cached: " + fmtCompact(s.total_cache_read_tokens) + " (" + ((s.total_tokens || 1) > 0 ? ((s.total_cache_read_tokens || 0) / s.total_tokens * 100).toFixed(1) : "0") + "%)")
   898|            )
   899|          )
   900|        )
   901|      ),
   902|      // ── Top Runs Modal ─────────────────────────────────────────────────
   903|      React.createElement(Modal, { isOpen: topRunsModal.isOpen, onClose: topRunsModal.close },
   904|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   905|          (() => {
   906|            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.runs || 0) > (a.runs || 0) ? b : a, jobList[0]) : null;
   907|            const label = j ? (j.name || j.job_id) : "\u2014";
   908|            return React.createElement("div", null,
   909|              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
   910|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   911|                React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)" } },
   912|                  j ? (j.runs || 0).toLocaleString() : "\u2014"
   913|                ),
   914|                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "runs")
   915|              ),
   916|              j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   917|                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
   918|                React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
   919|                  React.createElement("div", null, "Schedule: " + (j.schedule || "\u2014")),
   920|                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
   921|                  React.createElement("div", null, "Next run: " + fmtTime(j.next_run)),
   922|                  React.createElement("div", null, "Model: " + (j.model || "\u2014")),
   923|                  React.createElement("div", null, "Tokens: " + (j.total_tokens != null ? fmtCompact(j.total_tokens) : "\u2014"))
   924|                )
   925|              )
   926|            );
   927|          })()
   928|        )
   929|      ),
   930|      // ── Top Cost Modal ─────────────────────────────────────────────────
   931|      React.createElement(Modal, { isOpen: topCostModal.isOpen, onClose: topCostModal.close },
   932|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   933|          (() => {
   934|            const j = jobList.length > 0 ? jobList.reduce((a, b) => (b.total_cost || 0) > (a.total_cost || 0) ? b : a, jobList[0]) : null;
   935|            const label = j ? (j.name || j.job_id) : "\u2014";
   936|            return React.createElement("div", null,
   937|              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
   938|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   939|                React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#f5a623" } },
   940|                  j ? fmtCost(j.total_cost) : "\u2014"
   941|                ),
   942|                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "total cost")
   943|              ),
   944|              j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   945|                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
   946|                React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
   947|                  React.createElement("div", null, "Schedule: " + (j.schedule || "\u2014")),
   948|                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
   949|                  React.createElement("div", null, "Next run: " + fmtTime(j.next_run)),
   950|                  React.createElement("div", null, "Model: " + (j.model || "\u2014")),
   951|                  React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \u00b7 Avg: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
   952|                )
   953|              )
   954|            );
   955|          })()
   956|        )
   957|      ),
   958|      // ── Top Tokens Modal ───────────────────────────────────────────────
   959|      React.createElement(Modal, { isOpen: topTokensModal.isOpen, onClose: topTokensModal.close },
   960|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   961|          (() => {
   962|            const j = jobList.length > 0 ? jobList.reduce((a, b) => ((b.total_tokens || 0) > (a.total_tokens || 0) ? b : a), jobList[0]) : null;
   963|            const label = j ? (j.name || j.job_id) : "\u2014";
   964|            return React.createElement("div", null,
   965|              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
   966|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
   967|                React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: "#5b8def" } },
   968|                  j ? fmtCompact(j.total_tokens) : "\u2014"
   969|                ),
   970|                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "tokens")
   971|              ),
   972|              j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
   973|                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
   974|                React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
   975|                  React.createElement("div", null, "Schedule: " + (j.schedule || "\u2014")),
   976|                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
   977|                  React.createElement("div", null, "Next run: " + fmtTime(j.next_run)),
   978|                  React.createElement("div", null, "Model: " + (j.model || "\u2014")),
   979|                  React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString())
   980|                )
   981|              )
   982|            );
   983|          })()
   984|        )
   985|      ),
   986|      // ── Top Pace Modal ─────────────────────────────────────────────────
   987|      React.createElement(Modal, { isOpen: topPaceModal.isOpen, onClose: topPaceModal.close },
   988|        React.createElement("div", { style: { padding: "1.5rem", fontFamily: "var(--theme-font-mono, monospace)" } },
   989|          (() => {
   990|            const j = jobList.length > 0
   991|              ? jobList.reduce((a, b) => {
   992|                  const aPace = (a.projections && a.projections.pace != null) ? a.projections.pace : -Infinity;
   993|                  const bPace = (b.projections && b.projections.pace != null) ? b.projections.pace : -Infinity;
   994|                  return bPace > aPace ? b : a;
   995|                }, jobList[0])
   996|              : null;
   997|            const label = j ? (j.name || j.job_id) : "\u2014";
   998|            const p = j && j.projections && j.projections.pace != null ? j.projections.pace : null;
   999|            return React.createElement("div", null,
  1000|              React.createElement("div", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
  1001|              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" } },
  1002|                React.createElement("span", { style: { fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--theme-font-mono, monospace)", color: paceColor(p) } },
  1003|                  p != null ? p.toFixed(2) + "\u00d7" : "\u2014"
  1004|                ),
  1005|                React.createElement("span", { style: { fontSize: "0.9rem", opacity: 0.8, fontWeight: 900 } }, "pace")
  1006|              ),
  1007|              React.createElement("div", { style: { marginBottom: "1rem" } },
  1008|                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.2rem" } },
  1009|                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
  1010|                    React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Nominal/mo"),
  1011|                    React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
  1012|                      React.createElement("div", { style: { width: Math.min(100, ((j && j.projections && j.projections.projected_cost_30d || 1) / Math.max((j && j.projections && j.projections.projected_cost_30d) || 1, (j && j.projections && j.projections.trend_projected_cost_30d) || 1, 1)) * 100) + "%", background: "#4ade80", height: "100%", opacity: 0.8 } })
  1013|                    ),
  1014|                    React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#4ade80" } }, fmtCost(j && j.projections ? j.projections.projected_cost_30d : null) + "/mo")
  1015|                  ),
  1016|                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } },
  1017|                    React.createElement("span", { style: { width: "5rem", fontSize: "0.8rem" } }, "Trend/mo"),
  1018|                    React.createElement("div", { style: { flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "0.15rem", height: "0.35rem", overflow: "hidden" } },
  1019|                      React.createElement("div", { style: { width: Math.min(100, ((j && j.projections && j.projections.trend_projected_cost_30d || 1) / Math.max((j && j.projections && j.projections.projected_cost_30d) || 1, (j && j.projections && j.projections.trend_projected_cost_30d) || 1, 1)) * 100) + "%", background: "#ef4444", height: "100%", opacity: 0.8 } })
  1020|                    ),
  1021|                    React.createElement("span", { style: { width: "5.5rem", textAlign: "right", fontSize: "0.8rem", color: "#ef4444" } }, fmtCost(j && j.projections ? j.projections.trend_projected_cost_30d : null) + "/mo")
  1022|                  )
  1023|                )
  1024|              ),
  1025|              j && React.createElement("div", { style: { borderTop: "1px solid var(--color-border)", paddingTop: "1rem" } },
  1026|                React.createElement("h3", { style: { fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 } }, "Job details"),
  1027|                React.createElement("div", { style: { fontSize: "0.78rem", background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.75rem", borderRadius: "0.35rem", lineHeight: 1.6 } },
  1028|                  React.createElement("div", null, "Schedule: " + (j.schedule || "\u2014")),
  1029|                  React.createElement("div", null, "Last run: " + fmtTime(j.last_run)),
  1030|                  React.createElement("div", null, "Next run: " + fmtTime(j.next_run)),
  1031|                  React.createElement("div", null, "Model: " + (j.model || "\u2014")),
  1032|                  React.createElement("div", null, "Runs: " + (j.runs || 0).toLocaleString() + " \u00b7 Avg cost: " + (j.avg_cost != null ? fmtCost(j.avg_cost) : "\u2014"))
  1033|                )
  1034|              )
  1035|            );
  1036|          })()
  1037|        )
  1038|      ),
  1039|      s.cost_by_model && s.cost_by_model.length > 0 && (() => {
  1040|        const topModels = s.cost_by_model.slice(0, 5);
  1041|        const remaining = s.cost_by_model.length - 5;
  1042|        const maxCost = (topModels[0] && topModels[0].total_cost) || 1;
  1043|        return React.createElement(Card, { style: { marginBottom: "1.5rem" } },
  1044|          React.createElement(CardHeader, null,
  1045|            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
  1046|              CpuIcon(16),
  1047|              React.createElement(CardTitle, null, "Per-Model Breakdown")
  1048|            )
  1049|          ),
  1050|          React.createElement(CardContent, null,
  1051|            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.15rem" } },
  1052|              topModels.map(m => React.createElement("div", {
  1053|                key: m.model,
  1054|                style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0", borderRadius: "0.25rem", cursor: "default", transition: "background 0.15s ease" },
  1055|                onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; },
  1056|                onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
  1057|              },
  1058|                React.createElement("span", {
  1059|                  style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, width: "38%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
  1060|                }, m.model),
  1061|                React.createElement("div", {
  1062|                  style: { flex: 1, background: "rgba(255,255,255,0.04)", height: "0.4rem", borderRadius: "0.2rem", overflow: "hidden" }
  1063|                },
  1064|                  React.createElement("div", {
  1065|                    style: { width: (Math.min(100, ((m.total_cost || 0) / maxCost) * 100)) + "%", background: "#f5a623", height: "100%", borderRadius: "0.2rem", transition: "width 0.5s ease" }
  1066|                  })
  1067|                ),
  1068|                React.createElement("span", {
  1069|                  style: { fontSize: "0.75rem", fontFamily: "var(--theme-font-mono, monospace)", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }
  1070|                },
  1071|                  React.createElement("span", { style: { color: "#f5a623" } }, fmtCost(m.total_cost)),
  1072|                  React.createElement("span", { style: { opacity: 0.45, marginLeft: "0.35rem" } }, "· ", (m.runs || 0).toLocaleString())
  1073|                )
  1074|              )),
  1075|              remaining > 0 && React.createElement("div", {
  1076|                style: { textAlign: "center", fontSize: "0.65rem", opacity: 0.35, marginTop: "0.3rem", fontFamily: "var(--theme-font-mono, monospace)" }
  1077|              }, "and " + remaining + " more")
  1078|            )
  1079|          )
  1080|        );
  1081|      })(),
  1082|      // Jobs Breakdown
  1083|      React.createElement(Card, { style: { marginBottom: "1.5rem" } },
  1084|        React.createElement(CardHeader, null,
  1085|          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } },
  1086|            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
  1087|              ClockIcon(16),
  1088|              React.createElement(CardTitle, null, "Jobs Breakdown")
  1089|            ),
  1090|            React.createElement("div", { style: { display: "flex", gap: "0.75rem", alignItems: "center" } },
  1091|              syncInfo && syncInfo.lastSync &&
  1092|                React.createElement("span", {
  1093|                  style: { fontSize: "0.65rem", opacity: 0.45, fontFamily: "var(--theme-font-mono, monospace)" }
  1094|                },
  1095|                  "Synced " + fmtTime(new Date(syncInfo.lastSync).getTime() / 1000) +
  1096|                  (syncInfo.rowsSynced != null ? " · " + syncInfo.rowsSynced + " jobs" : "")
  1097|                ),
  1098|              React.createElement(Button, {
  1099|                size: "sm",
  1100|                outlined: true,
  1101|                disabled: syncing,
  1102|                onClick: onSync,
  1103|              }, syncing ? "Syncing..." : "Sync Now")
  1104|            )
  1105|          )
  1106|        ),
  1107|        React.createElement(CardContent, null,
  1108|          jobList.length === 0
  1109|            ? React.createElement("div", { style: { opacity: 0.6, padding: "1rem 0" } },
  1110|              syncing
  1111|                ? "Syncing cron sessions..."
  1112|                : (syncInfo && syncInfo.lastSync
  1113|                  ? "No jobs in " + windowLabel.toLowerCase() + ". Last sync: " + syncInfo.lastSync.split("T").join(" ").slice(0, 19) + " UTC"
  1114|                  : "No cron jobs captured. Click Sync Now to backfill from state.db.")
  1115|            )
  1116|            : React.createElement("div", { style: { overflow: "auto" } },
  1117|              React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" } },
  1118|                React.createElement("thead", null,
  1119|                  React.createElement("tr", { style: { borderBottom: "1px solid var(--color-border)" } },
  1120|                    ["Job", "Runs", "Total Cost", "Avg Cost", "Nominal/mo", "Trend/mo", "Pace"].map(h => {
  1121|                      const isActive = sortConfig.key === h;
  1122|                      return React.createElement("th", {
  1123|                        key: h,
  1124|                        onClick: () => setSortConfig(prev => ({
  1125|                          key: h,
  1126|                          direction: prev.key === h && prev.direction === "asc" ? "desc" : "asc"
  1127|                        })),
  1128|                        style: {
  1129|                          textAlign: h === "Job" ? "left" : "right",
  1130|                          padding: "0.5rem 0.35rem",
  1131|                          cursor: "pointer",
  1132|                          fontFamily: "var(--theme-font-mono, monospace)",
  1133|                          fontWeight: 600,
  1134|                          userSelect: "none",
  1135|                          borderBottom: "2px solid var(--color-border)",
  1136|                        }
  1137|                      }, h + (isActive ? (sortConfig.direction === "asc" ? " \u2191" : " \u2193") : ""));
  1138|                    })
  1139|                  )
  1140|                ),
  1141|                React.createElement("tbody", null,
  1142|                  sortedJobs.map(j => [
  1143|                    React.createElement("tr", {
  1144|                      key: j.job_id,
  1145|                      style: { borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s ease" },
  1146|                      onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; },
  1147|                      onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
  1148|                      onClick: () => setExpandedId(expandedId === j.job_id ? null : j.job_id)
  1149|                    },
  1150|                      React.createElement("td", { style: { padding: "0.4rem 0.35rem" } },
  1151|                        React.createElement("div", { style: { fontSize: "0.78rem", fontWeight: 500 } }, j.name || j.job_id)
  1152|                      ),
  1153|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontFamily: "var(--theme-font-mono, monospace)" } }, (j.runs || 0).toLocaleString()),
  1154|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.total_cost)),
  1155|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } }, fmtCost(j.avg_cost)),
  1156|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
  1157|                        j.projections && j.projections.projected_cost_30d != null
  1158|                          ? fmtCost(j.projections.projected_cost_30d) + "/mo"
  1159|                          : "\u2014"
  1160|                      ),
  1161|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem", fontWeight: 500 } },
  1162|                        j.projections && j.projections.trend_projected_cost_30d != null
  1163|                          ? fmtCost(j.projections.trend_projected_cost_30d) + "/mo"
  1164|                          : "\u2014"
  1165|                      ),
  1166|                      React.createElement("td", { style: { textAlign: "right", padding: "0.4rem 0.35rem" } },
  1167|                        React.createElement("span", {
  1168|                          style: {
  1169|                            fontWeight: 700,
  1170|                            color: paceColor(j.projections && j.projections.pace),
  1171|                            background: paceBg(j.projections && j.projections.pace),
  1172|                            borderRadius: "0.25rem",
  1173|                            padding: "0.15rem 0.4rem",
  1174|                            display: "inline-block",
  1175|                            fontFamily: "var(--theme-font-mono, monospace)",
  1176|                          }
  1177|                        },
  1178|                          j.projections && j.projections.pace != null
  1179|                            ? j.projections.pace.toFixed(2) + "\u00d7"
  1180|                            : "\u2014"
  1181|                        )
  1182|                      )
  1183|                    ),
  1184|                    expandedId === j.job_id && React.createElement("tr", { key: j.job_id + "_detail" },
  1185|                      React.createElement("td", { colSpan: 7, style: { padding: "0.6rem 0.35rem 0.6rem 0.75rem", background: "rgba(255,255,255,0.02)", fontSize: "0.72rem" } },
  1186|                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.3rem" } },
  1187|                          React.createElement("div", {
  1188|                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.72rem" }
  1189|                          },
  1190|                            "Tokens: " + fmtCompact(j.total_tokens) + " total "
  1191|                              + "(" + fmtCompact(j.total_input_tokens) + " in / "
  1192|                              + fmtCompact(j.total_output_tokens) + " out / "
  1193|                              + fmtCompact(j.total_cache_read_tokens) + " cached)"
  1194|                          ),
  1195|                          React.createElement("div", {
  1196|                            style: { fontFamily: "var(--theme-font-mono, monospace)", fontSize: "0.7rem", opacity: 0.7, whiteSpace: "pre" }
  1197|                          },
  1198|                            (j.projections && j.projections.schedule_display ? j.projections.schedule_display : "No schedule"),
  1199|                            "   Last: ", fmtTime(j.last_run),
  1200|                            j.last_model ? "   using " + j.last_model : "",
  1201|                            "   Next: ", j.projections && j.projections.next_run_at ? fmtRel(j.projections.next_run_at) : "\u2014"
  1202|                          )
  1203|                        )
  1204|                      )
  1205|                    )
  1206|                  ]).flat()
  1207|                )
  1208|              )
  1209|            )
  1210|        )
  1211|      ),
  1212|    );
  1213|  }
  1214|
  1215|  PLUGINS.register("cronalytics", CronTab);
  1216|})();