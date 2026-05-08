# Project Context: Cron-Insights

This is a custom Hermes Agent plugin/dashboard-plugin.

## Important Notes

- Load skill "project-delivery-lifestyle"

- This project includes frequent Hermes Gateway restarts for testing, please load the skill "checkpoint-resume-pattern"

## ## Background Brief

Review the product brief for context as needed: ./BRIEF.md

## Architecture

Review the architecture and design as needed located here: ./DESIGN.md

## Conventions

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
