# I18N Protocol — Cronalytics

This document defines the mandatory process for implementing, translating, and validating new locales in Cronalytics. Adherence to this protocol provides a verifiable audit trail to justify technical decisions and prevent "dipshit monkey" scenarios.

## 1. Implementation (The "Wrapper" Phase)
- **Zero Hardcoded Strings:** No user-facing text is permitted in JSX files.
- **Hook-based Resolution:** Use the `useCronalyticsI18n()` hook.
- **Fallback Policy:** Every `t()` call must include an English fallback: `t("key.path", "English Default")`.
- **Placeholder Integrity:** Variable placeholders (e.g., `{n}`, `{col}`) must be preserved in all translations to prevent runtime crashes.

## 2. Extraction & Map Generation
- The English catalog (`en.js`) serves as the **Source of Truth**.
- A flat mapping of dot-notated keys to strings is extracted using the internal parser.
- A side-by-side mapping doc (`TRANSLATION.md`) is auto-generated for human spot-checks.

## 3. The Multi-Model Consensus Protocol
To ensure professional, technically accurate localization without relying on a single AI's hallucinations or regional biases, all new strings must undergo the **2/4 Consensus Gate**:

### The Participants
1. **Model #1 (Kimi K2.6):** Balanced, strong in technical Simplified Chinese.
2. **Model #2 (DeepSeek V4 Pro):** High rigor, conservative technical phrasing.
3. **Model #3 (Gemini 3.1 Pro):** Creative outlier (provides linguistic diversity/edge cases).
4. **Model #4 (Claude Sonnet 4.6):** Primary authority for professional/Developer-facing flow.

### The Logic
- **Automatic Pass:** If 2 or more models produce an identical string, it is accepted.
- **Weighted Tiebreak:** In cases of a 2-vs-2 tie or no clear majority, the **Sonnet + DeepSeek** consensus is the tiebreaker.
- **Outlier Rejection:** Phrasing from outliers (statistically dissimilar to the group) is discarded.

## 4. Platform Harmonization
- **Core Parity:** AI consensus is overridden by **Hermes Core Dashboard** conventions where they conflict.
- **Current Overrides:**
    - "Token" remains "Token" (English) in all languages.
    - Technical identifiers (Job ID, cron, duration_seconds) are preserved as-is.

## 5. Deployment & Release Note
- All AI-generated catalogs must be clearly labeled in the file header as "AI-validated first pass."
- **Note to Community:** "Locales are AI-validated community contributions. Native speaker PRs are welcome and encouraged."

---
*Documented: 2026-05-22*
*Reasoning: Automated rigor over manual guesswork.*
