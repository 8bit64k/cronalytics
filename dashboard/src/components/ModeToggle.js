import { React } from "../lib/sdk.js";
import { Button } from "../lib/sdk.js";
import { useCronalyticsI18n } from "../i18n/index.js";

export function ModeToggle({ selected, onChange, label }) {
  const t = useCronalyticsI18n();
  const OPTIONS = [
    { label: t("mode_toggle.all", "All"), value: "all" },
    { label: t("mode_toggle.agent", "Agent"), value: "agent" },
    { label: t("mode_toggle.no_agent", "No Agent"), value: "no_agent" },
  ];

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
