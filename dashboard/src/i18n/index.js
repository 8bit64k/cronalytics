/**
 * Cronalytics i18n — aligns with Hermes dashboard SDK pattern.
 *
 * Hermes exposes `useI18n` on the plugin SDK. We read `locale` from it
 * and resolve our own catalog. If the host language changes, the component
 * re-renders automatically via React context.
 *
 * Usage:
 *   import { useCronalyticsI18n } from "../i18n";
 *   const t = useCronalyticsI18n();
 *   return <span>{t("summary.job_runs", "Job Runs")}</span>;
 *
 * Catalog shape mirrors Hermes: namespaced keys with dot separators.
 * Example: "summary.job_runs", "leaderboard.top_cost", etc.
 *
 * Supports simple interpolation: t("key", "fallback", { n: 5 })
 * or t("key", { n: 5 }) — fallback defaults to key if omitted.
 */

const CATALOGS = {};

export function registerCatalog(lang, messages) {
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
    } catch {}
  } else {
    code = navigator.language || "en";
  }
  
  // Try full match first (e.g. zh, zh-hant, es)
  if (CATALOGS[code]) return code;
  
  // Fallback to base language (e.g. zh-hant -> zh, en-GB -> en)
  const base = code.split("-")[0];
  if (CATALOGS[base]) return base;

  return "en";
}

function resolve(key, catalog) {
  const parts = key.split(".");
  let node = catalog;
  for (const p of parts) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[p];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template, vars) {
  if (!vars || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_match, name) => {
    return vars[name] !== undefined ? String(vars[name]) : _match;
  });
}

export function useCronalyticsI18n() {
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
