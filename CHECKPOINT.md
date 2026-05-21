# Project Checkpoints — Cronalytics

## v1.1.0 Certification & Documentation Finalization (2026-05-20)
**Context:** Final release preparation and destructive testing for the v1.1.0 upgrade path. Documentation architecture was refined for maximum clarity and minimal landing-page density.

### Technical Achievements:
- **Upgrade Path Certified**: Verified a complete v1.0 -> v1.1.0 simulation starting with the 8bit64k-uat (master) baseline, restoring the 38k-run demo DB, and performing `hermes plugins update`.
- **Namespace Verification**: Confirmed that the Dashboard correctly loads the new package-based restructure (`cronalytics/` namespace) after a process restart.
- **Documentation Decoupling**: Extracted the dense técnico background into `docs/UPGRADE.md`, keeping `README.md` as a high-level funnel with a "Getting Started" table pointing to Usage, Installation, and Upgrades.
- **Robust Restart Protocol**: Documented the mandatory `hermes dashboard --stop && sleep 2 && hermes dashboard` sequence to remediate 422 pattern mismatches and clear old memory.
- **Identity Correction**: Applied repository-local git config to ensure all release commits are attributed to `8bit64k <8bit64k@pm.me>`.

### Metadata:
- **Major Branch**: `feat/cli-terminal-access` (Local & UAT)
- **Latest Commit**: `2671963` — "docs: prioritize Usage & Workflows in README pathways"
- **Author Identity**: `8bit64k`
- **Release Status**: **GOLD CERTIFIED** — Ready for PR to main repo master.

### Decisions Made:
1. **Repository Hygiene**: Standardized the Arch Linux "btw" footnote for `--break-system-packages` across all docs, removing the mandatory flags from default examples.
2. **Simplified Funnel**: Prioritized `docs/USAGE.md` over the technical Feature Catalog in the README pathways for better user engagement.
3. **Data Safety**: Verified that `facts.db` survives the directory restructure and remains authoritative for both CLI and Dashboard.

### Instructions for Next Session:
1. In the build repo, simply `git push origin feat/cli-terminal-access` to stage the public PR.
2. Open the PR on GitHub focusing on the v1.1.0 namespace and CLI features.
3. Once merged, delete the `-uat` testing remote.
