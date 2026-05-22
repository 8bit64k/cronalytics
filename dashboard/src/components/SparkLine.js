import { React, useState } from "../lib/sdk.js";
import { fmtTime, fmtCost, fmtCompact, fmtDuration } from "../lib/formatters.js";
import { useCronalyticsI18n } from "../i18n/index.js";

const SPARK_BAR_W = 4;
const SPARK_BAR_GAP = 1;
const SPARK_H = 60;

function _modelColor(m) {
  if (!m) return "var(--foreground-base, #888)";
  if (m.includes("kimi")) return "#22c55e";
  if (m.includes("gemini")) return "#f59e0b";
  if (m.includes("gpt")) return "#3b82f6";
  if (m.includes("claude")) return "#d946ef";
  return "var(--foreground-base, #888)";
}

function _shortModel(m) {
  if (!m) return "\u2014";
  return m.split("/").pop();
}

function _tokTotal(r) {
  return (r.input_tokens || 0) + (r.output_tokens || 0) + (r.cache_read_tokens || 0) + (r.cache_write_tokens || 0);
}

export function SparkLine({ runs }) {
  const t = useCronalyticsI18n();
  const [hoverIdx, setHoverIdx] = useState(-1);
  if (!runs || runs.length === 0) return null;

  const chrono = [...runs].sort((a, b) => a.run_time - b.run_time);
  const maxCost = Math.max(...chrono.map(r => r.estimated_cost || 0), 0.0001);
  const maxTok = Math.max(...chrono.map(_tokTotal), 1);
  const maxDur = Math.max(...chrono.map(r => r.duration_seconds || 0), 0.1);

  const h = SPARK_H;
  const w = SPARK_BAR_W;
  const gap = SPARK_BAR_GAP;
  const totalW = chrono.length * (w + gap);
  const cx = (i) => i * (w + gap) + w / 2;
  const cy = (v, max) => h - (v / max) * h;

  const tokPts = chrono.map((r, i) => `${cx(i)},${cy(_tokTotal(r), maxTok)}`).join(" ");
  const durPts = chrono.map((r, i) => `${cx(i)},${cy(r.duration_seconds || 0, maxDur)}`).join(" ");
  const hoverRun = hoverIdx >= 0 ? chrono[hoverIdx] : null;

  return React.createElement(
    "div",
    { style: { marginBottom: "0.5rem", position: "relative" } },
    React.createElement(
      "svg",
      {
        viewBox: `0 0 ${totalW} ${h}`,
        style: { width: "100%", height: h + "px", display: "block" },
      },
      // Token line
      React.createElement("polyline", {
        points: tokPts,
        fill: "none",
        stroke: "#60a5fa",
        strokeWidth: "1.5",
        opacity: 0.85,
      }),
      // Duration line (dashed)
      React.createElement("polyline", {
        points: durPts,
        fill: "none",
        stroke: "#fcd34d",
        strokeWidth: "1.5",
        strokeDasharray: "3,2",
        opacity: 0.85,
      }),
      // Cost bars (top layer — model color)
      chrono.map((r, i) => {
        const barH = ((r.estimated_cost || 0) / maxCost) * h;
        return React.createElement("rect", {
          key: r.session_id,
          x: i * (w + gap),
          y: h - barH,
          width: w,
          height: Math.max(barH, 1),
          fill: _modelColor(r.model),
          opacity: hoverIdx >= 0 && hoverIdx !== i ? 0.35 : 0.92,
          style: { transition: "opacity 0.15s", cursor: "pointer" },
          onMouseEnter: () => setHoverIdx(i),
          onMouseLeave: () => setHoverIdx(-1),
        });
      })
    ),
    // Legend
    React.createElement(
      "div",
      {
        style: {
          fontSize: "0.6rem",
          fontFamily: "var(--theme-font-mono, monospace)",
          opacity: 0.4,
          display: "flex",
          gap: "0.6rem",
          marginTop: "0.15rem",
          marginBottom: "0.25rem",
        },
      },
      React.createElement(
        "span",
        null,
        t("sparkline.cost_bar", "\u2014 cost (bar) \u00b7 "),
        React.createElement("span", { style: { color: "#60a5fa" } }, t("sparkline.tokens_line", "\u2014 tokens")),
        " \u00b7 ",
        React.createElement("span", { style: { color: "#fcd34d" } }, t("sparkline.duration_line", "- - duration"))
      )
    ),
    hoverRun &&
      React.createElement(
        "div",
        {
          style: {
            fontSize: "0.68rem",
            fontFamily: "var(--theme-font-mono, monospace)",
            opacity: 0.65,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        },
        fmtTime(hoverRun.run_time) +
          " \u00b7 " +
          fmtCost(hoverRun.estimated_cost) +
          " \u00b7 " +
          fmtCompact(_tokTotal(hoverRun)) + " " + t("summary.tokens", "toks") + " \u00b7 " +
          fmtDuration(hoverRun.duration_seconds) +
          " \u00b7 " +
          _shortModel(hoverRun.model)
      )
  );
}
