---
title: "Cronalytics Dashboard and CLI Tool Overview"
topic: "technical-observability"
data_type: "structural-breakdown"
complexity: "moderate"
point_count: 5
source_language: "en"
user_language: "en"
---

## Main Topic
An overview of Cronalytics, a Hermes Agent plugin for cron job observability, covering its two primary interfaces: the Web Dashboard for visual exploration and the terminal CLI for scriptable diagnostics.

## Learning Objectives
After viewing this infographic, the viewer should understand:
1. The dual-surface architecture (CLI vs Dashboard) of Cronalytics.
2. The core metrics tracked (runs, cost, tokens, pace, etc.).
3. The diagnostic workflow for optimizing cron jobs.
4. Key CLI commands and filters available.
5. How Cronalytics helps identify waste and drift in scheduled tasks.

## Target Audience
- **Knowledge Level**: Intermediate (familiar with Hermes Agent and cron jobs)
- **Context**: Users wanting to understand or optimize their automated job footprint.
- **Expectations**: A clear map of how to use the tool to save money and ensure reliability.

## Content Type Analysis
- **Data Structure**: A modular breakdown of a tool's capabilities and its separate interfaces.
- **Key Relationships**: The relationship between data ingestion (`sync`), the fact DB, and the presentation layers (CLI/Dashboard).
- **Visual Opportunities**: Side-by-side comparison of CLI and Dashboard; a process flow for diagnostics; a metric "stat sheet".

## Key Data Points (Verbatim)
- "Cronalytics is a cron observability plugin for Hermes Agent."
- "Dashboard for people, CLI for agents."
- "Tracks: runs, cost, tokens, outcomes, and schedule drift."
- "Fact DB: facts.db (SQLite secondary fact store)."
- "Commands: all, summary, jobs, models, trends, runs, health, sync."
- "Key Metric: Pace (ratio of actual cost to scheduled cost)."

## Layout × Style Signals
- Content type: structural-breakdown → suggests structural-breakdown or hub-spoke
- Tone: Technical/Observability → suggests technical-schematic or pop-laboratory
- Audience: Nick (Hermes Power User) → suggests pop-laboratory or retro-pop-grid

## Design Instructions (from user input)
- "create me an info graphic about the cronalytics dashboard and cli tool" - focusing on the duality and functionality.

## Recommended Combinations
1. **structural-breakdown + pop-laboratory** (Recommended): Matches the "technical guide" feel for a diagnostic tool. Ideal for showing components.
2. **hub-spoke + retro-pop-grid**: Good for showing the central `facts.db` with various command "spokes" and the two interfaces. High energy.
3. **bento-grid + morandi-journal**: A cleaner, broader summary for a higher-level overview.
