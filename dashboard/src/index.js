/**
 * Cronalytics Dashboard Plugin
 *
 * Entry point. Bundled by build.js into dist/index.js as an IIFE.
 */
import { React, PLUGINS } from "./lib/sdk.js";
import { PluginErrorBoundary } from "./components/ErrorBoundary.js";
import { CronalyticsTab } from "./components/CronalyticsTab.js";

PLUGINS.register("cronalytics", function CronalyticsWrapped() {
  return React.createElement(
    PluginErrorBoundary,
    null,
    React.createElement(CronalyticsTab)
  );
});
