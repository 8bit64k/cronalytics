# Opportunity Brief: Cron Cost Analytics for Hermes

## Overview

Hermes makes scheduled automation easy to create and run, with cron jobs executing automatically as fresh isolated agent sessions under the gateway. Hermes also provides usage and cost visibility through built-in dashboards and insights views, including overall estimated cost and per-model aggregates. What appears to be missing is a cron-specific cost lens that shows how much unattended automation is contributing to spend over time.hermes-agent.nousresearch+2

## Problem

Users can create recurring cron jobs for monitoring, reports, analysis, and other background workflows, then forget about them once they are running reliably. Because these jobs execute repeatedly and independently, a user may understand total Hermes usage without realizing that scheduled background work is responsible for a large share of token and model spend. The result is a visibility gap: automation is easy to start, but ongoing cron cost is hard to attribute and manage.hermes-agent.nousresearch+3

## Why It Matters

Cron is one of Hermes’ most powerful features because it turns the agent into an always-on automation system rather than a purely interactive assistant. That same strength creates financial risk, since unattended jobs can compound usage quietly through frequency, model choice, and long-lived schedules. A cron-specific cost view would help users identify expensive jobs early, tune schedules, change models, or disable low-value automations before they become surprising monthly costs.hermes-agent.nousresearch+3

## Product Thesis

The product thesis is simple: Hermes users need **cost accountability for unattended AI work**. The goal is not to replace Hermes Insights, but to extend it with a focused layer that attributes spend specifically to cron-originated sessions and recurring jobs. This creates a practical answer to a high-value question: which scheduled automations are costing money, how often do they run, and which models are driving that spend?hermes-agent.nousresearch+2

## Proposed Solution

Build an analytics layer that listens for session-boundary signals, identifies cron-originated sessions, and snapshots the final session record into a durable analytics store keyed by session ID. Because cron executions run as fresh isolated sessions, each completed run can be treated as a clean analytical fact for cost, duration, model, and token usage. This design avoids over-reliance on the operational database as a long-term warehouse and creates reproducible historical reporting even if session retention changes later.hermes-agent.nousresearch+3

## MVP Scope

The MVP should answer four questions clearly: how many cron runs occurred, how much they cost in total, which models they used, and which jobs are driving the most spend. A strong first release would include cron session count over time, total estimated cron cost, cost by model for cron sessions, and top jobs by cumulative cost and run frequency. Tool-level costing can wait, because session-level attribution is already enough to expose the hidden-spend problem this product is meant to solve.hermes-agent.nousresearch+2

## User Value

This product helps users move from raw activity to actionable budget awareness. Instead of asking, “Why is Hermes costing more this month?” they can ask, “Which cron jobs caused the increase, and should they still be running at this frequency and model tier?” That makes automation safer to adopt at scale because users can balance convenience against recurring cost with evidence rather than guesswork.hermes-agent.nousresearch+2

## Success Metrics

Early success metrics should focus on visibility and actionability rather than exhaustiveness. Useful indicators include the share of total spend attributable to cron, the number of expensive jobs identified, the number of jobs tuned or disabled after visibility, and reductions in unnecessary cron spend after users review the dashboard. Over time, the product can expand into budget thresholds, alerts, and recommendations once the core attribution layer proves reliable.hermes-agent.nousresearch+1

## Positioning

A concise positioning line for the product is: **Turn hidden automation into visible spend**. Another strong framing is: **See what your cron jobs are costing before background automation becomes background waste**. Both versions emphasize that the problem is not cron itself, but the lack of cost visibility around unattended execution.nousresearch-hermes-agent.mintlify+2

## Suggested Names

Potential names for the initiative or feature include:

- ~~**Cron Cost Analytics**~~

- ~~**Cron Spend Visibility**~~

- ~~**Background Automation Cost Tracking**~~

- ~~**Unattended AI Cost Insights**~~

- **Cronalytics** — the dashboard for agentic automations in Hermes

## Short Executive Pitch

Hermes already makes background automation powerful and accessible through cron, but users still lack a clear way to see what those scheduled jobs are costing them. By attributing session-level usage and estimated cost to cron-originated runs, this product would give users a dedicated view of recurring automation spend, helping them catch expensive schedules, optimize model choices, and control unattended cost before it becomes a surprise.hermes-agent.nousresearch+4
