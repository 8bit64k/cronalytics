/**
 * Cronalytics Dashboard Plugin
 *
 * Entry point. Bundled by build.js into dist/index.js as an IIFE.
 */
import { React, PLUGINS } from "./lib/sdk.js";
import { PluginErrorBoundary } from "./components/ErrorBoundary.js";
import { CronalyticsTab } from "./components/CronalyticsTab.js";

// Register i18n catalogs (en + es) before component renders
import "./i18n/index.js";
import "./i18n/en.js";
import "./i18n/es.js";
import "./i18n/zh.js";

PLUGINS.register("cronalytics", function CronalyticsWrapped() {
  return React.createElement(
    PluginErrorBoundary,
    null,
    React.createElement(CronalyticsTab)
  );
});
