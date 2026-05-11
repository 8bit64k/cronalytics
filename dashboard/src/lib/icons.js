import { React } from "./sdk.js";

export function CpuIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("path", { d: "M12 20v2" }),
    React.createElement("path", { d: "M12 2v2" }),
    React.createElement("path", { d: "M17 20v2" }),
    React.createElement("path", { d: "M17 2v2" }),
    React.createElement("path", { d: "M2 12h2" }),
    React.createElement("path", { d: "M2 17h2" }),
    React.createElement("path", { d: "M2 7h2" }),
    React.createElement("path", { d: "M20 12h2" }),
    React.createElement("path", { d: "M20 17h2" }),
    React.createElement("path", { d: "M20 7h2" }),
    React.createElement("path", { d: "M7 20v2" }),
    React.createElement("path", { d: "M7 2v2" }),
    React.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: 2 }),
    React.createElement("rect", { x: "8", y: "8", width: "8", height: "8", rx: 1 })
  );
}

export function ClockIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
    React.createElement("path", { d: "M12 6v6l4 2" })
  );
}

export function RefreshCwIcon(size, opts) {
  opts = opts || {};
  return React.createElement("svg", {
    width: size || 14, height: size || 14, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: Object.assign({ display: "inline-block", verticalAlign: "middle" }, opts.style || {})
  },
    React.createElement("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
    React.createElement("path", { d: "M21 3v5h-5" }),
    React.createElement("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
    React.createElement("path", { d: "M8 16H3v5" })
  );
}

export function BanknoteIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("rect", { width: 20, height: 12, x: 2, y: 6, rx: 2 }),
    React.createElement("circle", { cx: 12, cy: 12, r: 2 }),
    React.createElement("path", { d: "M6 12h.01M18 12h.01" })
  );
}

export function BlocksIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("path", { d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2" }),
    React.createElement("rect", { x: "14", y: "2", width: "8", height: "8", rx: 1 })
  );
}

export function MetronomeIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("path", { d: "M12 11.4V9.1" }),
    React.createElement("path", { d: "m12 17 6.59-6.59" }),
    React.createElement("path", { d: "m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2" }),
    React.createElement("circle", { cx: 20, cy: 9, r: 2 })
  );
}

export function ZapIcon(size) {
  return React.createElement("svg", {
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" })
  );
}

export function InfoIcon(props) {
  const { size, style } = props || {};
  return React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: Object.assign({ display: "inline-block", verticalAlign: "middle", cursor: "pointer" }, style || {})
  },
    React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
    React.createElement("path", { d: "M12 16v-4" }),
    React.createElement("path", { d: "M12 8h.01" })
  );
}

export function HelpCircleIcon(props) {
  const { size, style } = props || {};
  return React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: Object.assign({ display: "inline-block", verticalAlign: "middle" }, style || {})
  },
    React.createElement("circle", { cx: 12, cy: 12, r: 10 }),
    React.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
    React.createElement("path", { d: "M12 17h.01" })
  );
}

export function ArrowLeftIcon(size) {
  return React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size || 16, height: size || 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" }
  },
    React.createElement("path", { d: "M19 12H5" }),
    React.createElement("path", { d: "M12 19l-7-7 7-7" })
  );
}
