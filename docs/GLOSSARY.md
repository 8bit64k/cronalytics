# Cronalytics Product Glossary

This document serves as the conceptual source of truth for technical terms before they are translated. All agents and translators must adhere to these definitions.

| Term | Technical Definition | Usage in Dashboard | Approved Phrasing (en) |
| :--- | :--- | :--- | :--- |
| **Pace** | The ratio of (Actual Cost-Weighted Runs / Scheduled Cost-Weighted Runs) normalized to 30 days. Measures "Execution Rate vs Plan." | Pace Modal, Leader Card | Execution Rate / Pace |
| **Job** | A recurring automated task defined in `jobs.json`. | Table rows, detail view | Job |
| **Run** | A single execution of a Job, regardless of outcome (success/fail/retry). | Counter badges, sparklines | Run |
| **Token** | The unit of LLM compute consumption. | Token card, model breakdown | Token |
| **Wasted** | Estimated cost associated with failed (success=0) runs. | Cost card, Modal | Wasted |
| **Nominal** | The target cost/usage if a job ran exactly according to its schedule. | Pace Card, tooltips | Nominal |
| **Trend** | The projected 30-day cost/usage if current activity levels continue. | Pace Card, tooltips | Trend |
| **Agent** | An autonomous LLM-driven session (requires `agent: true` in definition). | Mode toggle, detail view | Agent |

## Localization Overrides
When translating, if a model proposes a literal synonym (e.g. Pace -> Rhythm), the agent must override using the "Technical Context" from this table.
