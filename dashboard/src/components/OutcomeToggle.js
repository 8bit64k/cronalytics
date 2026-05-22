import { React } from "../lib/sdk.js";
import { Button } from "../lib/sdk.js";
import { useCronalyticsI18n } from "../i18n/index.js";

export function OutcomeToggle({ selected, onChange }) {
  const t = useCronalyticsI18n();
  const OPTIONS = [
    { label: t("outcome_toggle.all", "All"), value: "all" },
    { label: t("outcome_toggle.success", "Success"), value: "success" },
    { label: t("outcome_toggle.failure", "Failure"), value: "failure" },
  ];

  return React.createElement(
    "div",
    { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
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
