#!/usr/bin/env node
/**
 * Cronalytics Dashboard Build Script
 *
 * Bundles src/index.js → dist/index.js as a single IIFE
 * Hermes plugins expect an IIFE that registers itself via window.__HERMES_PLUGINS__
 */

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

async function main() {
  const srcDir = path.join(__dirname, "src");
  const outFile = path.join(__dirname, "dist", "index.js");

  if (!fs.existsSync(srcDir)) {
    console.error("❌ src/ directory not found. Run from dashboard/ root.");
    process.exit(1);
  }

  const result = await esbuild.build({
    entryPoints: [path.join(srcDir, "index.js")],
    outfile: outFile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    // Preserve readability for debugging; Hermes will serve this as-is
    minify: false,
    sourcemap: false,
    // External: React and SDK are injected by Hermes host, not bundled
    external: [],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  if (result.errors.length > 0) {
    console.error("Build failed:", result.errors);
    process.exit(1);
  }

  const stat = fs.statSync(outFile);
  console.log(`✅ Built ${outFile} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
