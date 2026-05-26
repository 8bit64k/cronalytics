# Documentation Contract — Cronalytics

This file defines what each document in this repository is **for**. No document may duplicate the content of another. If content appears in more than one doc, the non-canonical copy is a liability, not a convenience.

## The Rules

1. **Each document has exactly one role.** Read the contracts below before writing.
2. **Content lives in one place.** If you need it in another place, link — don't copy.
3. **When a feature changes, update exactly one doc** — the canonical one. Not two. Not three.
4. **When in doubt, put it in the most specialized doc first.** General docs (README) link out; never absorb.

---

## Document Contracts

### README.md
**Role:** 90-second pitch. Why it exists, what it does at a glance, how to start.
**Audience:** New users seeing the repo for the first time.
**Contains:** Tagline, one-paragraph description, install jump links, mini-tour, "A Closer Look" feature overview, documentation index, license.
**Does NOT contain:** Full feature walkthroughs, architecture details, API reference tables, data model schemas, changelog entries, CLI command references.

### docs/USAGE.md
**Role:** How a human reads the dashboard and runs CLI commands.
**Audience:** Users who have installed Cronalytics.
**Contains:** Dashboard layout walkthrough, toolbar controls, metric interpretation, CLI commands, agent skill usage, common workflows.
**Does NOT contain:** Architecture decisions, design rationale, feature catalog, release history.

### dev/FEATURES.md
**Role:** Canonical feature catalog — what exists, what it does.
**Audience:** Release reviewers, contributors evaluating scope.
**Contains:** Exhaustive list of implemented features organized by subsystem, formulas, data sources.
**Does NOT contain:** Usage instructions, architecture rationale, design decisions.

### dev/DESIGN.md
**Role:** Technical architecture, data flow, design decisions, positioning.
**Audience:** Maintainers, contributors who need to understand why decisions were made.
**Contains:** Problem/solution, architecture diagrams, technical decisions with rationale, data flow, boundaries, CLI design philosophy, file layout.
**Does NOT contain:** Feature catalog, user guides, install instructions.

### CHANGELOG.md
**Role:** Version history — what changed, when.
**Audience:** Anyone who wants to know what's new in a release.
**Contains:** Per-version entries organized as Added/Changed/Fixed.
**Does NOT contain:** Marketing release notes, usage details, architecture.

### docs/RELEASE_NOTES.md
**Role:** Release highlights — "what's new and why you should upgrade."
**Audience:** Existing users deciding whether to upgrade.
**Contains:** Per-release narrative, key features, upgrade guidance.
**Does NOT contain:** Exhaustive changelog (links to CHANGELOG.md), architecture details.

### docs/INSTALL.md
**Role:** Installation instructions for new users.
**Audience:** First-time installers.
**Contains:** Setup steps, verification.
**Does NOT contain:** Upgrade instructions (see UPGRADE.md), uninstall (see UNINSTALL.md).

### docs/UPGRADE.md
**Role:** Migration guide for existing users upgrading between versions.
**Audience:** Users on an older version.
**Contains:** Breaking changes, migration steps, verification.
**Does NOT contain:** Fresh install instructions (see INSTALL.md).

### docs/TROUBLESHOOTING.md
**Role:** Common issues and fixes.
**Audience:** Anyone encountering problems.
**Contains:** Symptoms, causes, fixes. Link to relevant install/upgrade docs.

### docs/UNINSTALL.md
**Role:** Removal instructions.
**Audience:** Users removing Cronalytics.

### dev/BRIEF.md
**Role:** Product opportunity and market positioning.
**Audience:** Contributors and stakeholders evaluating the product's reason for existing.

### dev/DEV_SETUP.md
**Role:** Development environment setup for contributors.
**Audience:** Developers who want to work on Cronalytics itself.

### docs/GLOSSARY.md
**Role:** Canonical technical terminology — prevents translation drift.
**Audience:** Agents and translators.

### docs/I18N_PROTOCOL.md
**Role:** Multi-model translation consensus process.
**Audience:** Agents and contributors adding new locales.

### AGENTS.md
**Role:** Rules for AI agents working on this repo.
**Audience:** AI agents (not humans, not users).
**Note:** Not tracked in git — local development only.

### CHECKPOINT.md
**Role:** Session log for multi-session development.
**Audience:** The next agent that picks up where you left off.
**Note:** Not tracked in git — local development only.

---

## Anti-Patterns

These are the failure modes this contract exists to prevent:

1. **"README should be self-contained"** — No. README is the front door, not the house. It points inward.
2. **"I'll update both docs to be safe"** — This guarantees divergence. Update the canonical doc only.
3. **"I'm not sure which doc, so I'll add it to all of them"** — Defer to the most specialized doc. If unsure, ask.
4. **"A user might not click through, so I'll repeat it here"** — Trust the reader. Repetition breeds inconsistency.