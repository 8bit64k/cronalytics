/**
 * Currency formatter: 2 decimals with smart truncation
 */
export function fmtCost(n) {
  if (n == null) return "—";
  if (n === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtTime(ts) {
  if (!ts) return "\u2014";
  const d = new Date(ts * 1000);
  const opts = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

export function fmtRel(iso) {
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

export function fmtCompact(n) {
  if (n == null || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function fmtDuration(s) {
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

export function fmtSyncAge(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return { text: diffSec + "s ago", color: "#4ade80" };
  if (diffSec < 3600) return { text: Math.floor(diffSec / 60) + "m ago", color: "#4ade80" };
  if (diffSec < 86400) return { text: Math.floor(diffSec / 3600) + "h ago", color: null };
  if (diffSec < 604800) return { text: Math.floor(diffSec / 86400) + "d ago", color: "#f59e0b" };
  return { text: Math.floor(diffSec / 86400) + "d ago", color: "#ef4444" };
}

export function paceColor(pace) {
  if (pace == null) return "var(--foreground-base, var(--foreground))";
  if (pace < 1.0) return "#4ade80";   // green
  if (pace < 2.0) return null;        // neutral — normal zone, inherit default text color
  return "#ef4444";                   // red
}

export function paceBg(pace) {
  // Pace no longer uses background pills (font color only)
  return "transparent";
}
