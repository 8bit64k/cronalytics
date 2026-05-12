import { React } from "../lib/sdk.js";
import { Button } from "../lib/sdk.js";

const OPTIONS = [
  { label: "All", value: "all" },
  { label: "Agent", value: "agent" },
  { label: "No Agent", value: "no_agent" },
];

export function ModeToggle({ selected, onChange, label }) {
  return React.createElement(
    "div",
    { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
    label
      ? React.createElement(
          "span",
          {
            style: {
              fontFamily: "var(--theme-font-mono, monospace)",
              fontSize: "0.65rem",
              fontWeight: 700,
              opacity: 0.7,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            },
          },
          label
        )
      : null,
    ...OPTIONS.map((o) =>
      React.createElement(
        Button,
        {
          key: o.value,
          type: "button",
          size: "sm",
          outlined: selected !== o.value,
          onClick: () => onChange(o.value),
        },
        o.label
      )
    )
  );
}
