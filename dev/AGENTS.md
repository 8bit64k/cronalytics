# Project Context: Cronalytics

This is a custom Hermes Agent plugin/dashboard-plugin.

## Important Notes

- Load skill "project-delivery-lifestyle"

- This project includes frequent Hermes Gateway restarts for testing, please load the skill "checkpoint-resume-pattern"

## ## Background Brief

Review the product brief for context as needed: ./BRIEF.md

## Architecture

Review the architecture and design as needed located here: ./DESIGN.md

## Conventions

### Phosphor Session Start Protocol (Mandatory)

1. **Read `dev/AGENTS.md`** — every session, no exceptions. It is 62 lines.
2. **Read `CHECKPOINT.md`** — before any file operation. Know where we left off.
3. **Load referenced skills** — `checkpoint-resume-pattern` is explicitly required.

### Skill Document Integrity

- **Never declare a document "good to go" without reading every section**, including appendixes, reference lists, and example blocks. The `both` → `all` bug and the `--json` on `all` bug both survived because I reviewed the body and ignored the periphery.
- **Verify reference files exist in the repo before claiming they exist.** The installed `~/.hermes/skills/` tree is not source of truth. If it's not in `builds/cronalytics/`, it's not canonical.
- **Never write working notes into the skill directory.** Skill directory = committed, canonical, repo-synced. Working notes = `scratchpad/` only. This boundary is absolute.

### Integration Testing > Unit Testing

- **Unit tests passing does not mean the feature works.** The dashboard sending stale `"both"` to the API was an integration bug. pytest was green the entire time.
- After any change that touches CLI → API → frontend surfaces, verify the actual end-to-end path: dashboard request with cached old value, CLI smoke test with real args, API regex acceptance.

### No False Coverage Claims

- **"I reviewed it" means I opened every file, read every line, and can justify its presence.** Not "I skimmed the body and assumed the appendix was fine."
- **"All tests pass" means integration verified, not just `pytest -q`.**

## Plan

Reference the build plan ./PLAN.md

---

# Cronalytics — Build Session Protocol

## Joint Build Sessions (Live, in-session with Nick)

When building Cronalytics together in real-time:

- **Frontend rendering is Nick's domain.** After I make a change, I commit it, explain what changed, and stop. Nick verifies the UI manually.
- **Do not automate visual verification** via browser screenshots, DOM clicking, or vision analysis during joint sessions. It's slower, less reliable, and redundant when Nick is present.
- Exception: backend data flow verification (curl, API responses) is still mine.

This rule applies specifically to Cronalytics during live joint build sessions. Solo overnight or delegated build/test cycles may use full browser automation where appropriate.

---

## Release Gate Policy (Effective Immediately)

Cronalytics has reached **mature pre-release stability**. The core feature set is complete, the architecture is proven, and the codebase is now in a pre-launch testing and hardening phase.

### Branch Discipline

- **All changes must land on a feature branch first.** Never commit directly to `master`.
- Branch naming: `feat/<description>` or `fix/<description>` or `ui/<description>`.
- Each branch must be tied to a specific issue, assessment item, or launch-plan task.

### Certification Requirement

Before any branch is merged into `master`, it must be **certified by both Phosphor and Nick**:

1. **Phosphor certifies technical correctness:** tests pass, lint is green, no regressions in existing functionality, assessment recommendations are addressed or explicitly deferred.
2. **Nick certifies product readiness:** UI/UX is verified manually across devices, copy and behavior match intent, and the change does not destabilize the pre-release build.

Neither party can override the other. If Phosphor rejects a branch, it does not merge. If Nick rejects a branch, it does not merge.

### Rationale

We are past the experimentation phase. The `master` branch must remain a known-good, launch-candidate state at all times. Disposable experimentation belongs in branches. Merge is a deliberate, dual-signature act.
