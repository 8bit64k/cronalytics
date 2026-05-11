import { React } from "../lib/sdk.js";
import { Button } from "../lib/sdk.js";

const OPTIONS = [
  { label: "All", value: "both" },
  { label: "Success", value: "success" },
  { label: "Failure", value: "failure" },
];

export function OutcomeToggle({ selected, onChange, label }) {
  return React.createElement(
    "div",
    { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
    label
      ? React.createElement(
          "span",
          {
            style: {
              fontSize: "0.75rem",
              textTransform: "uppercase",
              opacity: 0.55,
              fontWeight: 500,
              letterSpacing: "0.03em",
              lineHeight: 1,
              userSelect: "none",
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
