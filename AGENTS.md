# Cronalytics Agent Instructions

All agents working on this repository MUST adhere to the following technical and architectural standards.

## 1. Mandatory I18N / Localization
- **Zero Hardcoded Strings:** NO user-facing text is permitted in JSX components or JavaScript files.
- **Implementation:** Every string must be wrapped in the `t()` function provided by the `useCronalyticsI18n()` hook.
- **Pattern:** `t("key.path", "English Default String")`
- **Fallback Policy:** The second argument (English default) is mandatory and must match the current `en.js` catalog state exactly.
- **Protocol:** Refer to `docs/I18N_PROTOCOL.md` for the multi-model consensus process (2/4 gate) required when adding new locales. **NO SHORTCUTS.** Every new UI element read by a human must have locale support built-in from day one.

## 2. Technical Quality Gates
- **Accuracy Over Speed:** Do not prioritize fast responses over complete, correct implementation. Nick: "not going to give you an award for being fast."
- **Full-Stack Sync:** Ensure 100% consistency across DB schema -> Python queries -> API response -> Frontend UI -> Documentation.
- **Tests:** Always run the test suite (`.venv/bin/pytest tests/`) after any backend or integration changes.

## 3. UI/UX Consistency
- **Branding:** Tagline is "Observe. Measure. Optimize."
- **Nomenclature:** The word "cost" MUST be qualified as "Estimated Cost" (or "actual cost" where applicable). Bare "cost" is prohibited in human-visible UI and technical documentation to avoid misleading users regarding provider billing.
- **Cost Badge:** Use the amber pill badge for Estimated costs. Format as "Est Cost" (with space).
- **Consensus Phrasing:** Use agreed-upon technical terms (e.g., "Token" remains "Token" in English across all languages).

## 4. Documentation
- Keep `CHECKPOINT.md` updated with technical decisions and branch state.
- Major features must be documented in `dev/FEATURES.md` and `docs/USAGE.md`.
- Side-by-side translation maps should be maintained in `TRANSLATION.md`.
