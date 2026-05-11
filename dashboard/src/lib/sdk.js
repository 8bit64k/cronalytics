/* ── SDK bridge ──
 * Hermes injects these globals at runtime.
 */
const SDK = window.__HERMES_PLUGIN_SDK__;
const PLUGINS = window.__HERMES_PLUGINS__;
if (!SDK || !PLUGINS) {
  throw new Error("Cronalytics: Hermes SDK not available");
}

export const React = SDK.React;
export const { useState, useEffect, useRef, useMemo } = SDK.hooks;
export const fetchJSON = SDK.fetchJSON;
export const { Card, CardHeader, CardTitle, CardContent, Badge, Button } = SDK.components;
export { PLUGINS };
