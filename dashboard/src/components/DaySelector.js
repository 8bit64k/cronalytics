import { React, useState } from "../lib/sdk.js";
import { Button } from "../lib/sdk.js";
import { useCronalyticsI18n } from "../i18n/index.js";

const PRESETS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const MAX_DAYS = 365;

export function DaySelector({ selected, onChange, label = null }) {
  const t = useCronalyticsI18n();
  const [custom, setCustom] = useState("");

  const applyCustom = () => {
    const v = parseInt(custom, 10);
    onChange(isNaN(v) || v < 0 ? 0 : Math.min(v, MAX_DAYS));
  };

  const elements = [
    // Preset buttons group
    React.createElement(
      "span",
      {
        key: "presets",
        style: { display: "inline-flex", gap: "0.375rem", alignItems: "center" },
      },
      ...PRESETS.map((d) =>
        React.createElement(
          Button,
          {
            key: d.value,
            type: "button",
            size: "sm",
            outlined: selected !== d.value,
            onClick: () => {
              setCustom("");
              onChange(d.value);
            },
          },
          d.label
        )
      )
    ),
    // Custom input + Go group
    React.createElement(
      "span",
      {
        key: "custom",
        style: { display: "inline-flex", gap: "0.375rem", alignItems: "center" },
      },
      React.createElement("input", {
        type: "number",
        min: 0,
        step: 1,
        max: MAX_DAYS,
        placeholder: "days",
        value: custom,
        onChange: (e) => setCustom(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") applyCustom();
        },
        style: {
          width: "3.5rem",
          fontSize: "0.7rem",
          fontFamily: "var(--theme-font-mono, monospace)",
          background: "var(--background, rgba(12,12,12,0.5))",
          color: "var(--foreground-base, var(--foreground))",
          border: "1px solid var(--border, rgba(255,255,255,0.1))",
          borderRadius: "0.25rem",
          padding: "0.25rem 0.35rem",
          outline: "none",
        },
      }),
      React.createElement(
        Button,
        {
          type: "button",
          size: "sm",
          outlined: true,
          onClick: applyCustom,
          title: t("day_selector.apply_custom", "Apply custom days"),
        },
        t("day_selector.go", "Go")
      )
    ),
  ];

  if (label) {
    elements.unshift(
      React.createElement(
        "span",
        {
          key: "label",
          style: {
            fontFamily: "var(--theme-font-mono, monospace)",
            fontSize: "0.65rem",
            fontWeight: 700,
            opacity: 0.7,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginRight: "0.25rem",
          },
        },
        label
      )
    );
  }

  return elements;
}
