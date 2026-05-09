# Cronalytics V1.0 Launch Plan

> **Launch Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
> **Days Remaining: 11 (from May 9)**

## Philosophy

Code can iterate. First impressions are permanent.

**Technical features freeze May 14.** Everything after that is polish, docs, and demo.
If an idea shows up May 15, it goes in V1.1. No exceptions.

---

## Phase 1: Technical Lock (Days 1–6, May 9–14)

Goal: Merge remaining V1.0 features. No new features after May 14 end-of-day.

| Day | Date | Focus |
|-----|------|-------|
| 1 | Sat May 9 | H5 Per-run expansion in Jobs Breakdown — clicking a job name opens detail row with last N individual runs (time, duration, cost, tokens, model). UI pattern already exists (expandable rows). |
| 2 | Sun May 10 | H7 Suspect/orphaned/hung job detection — `ended_at IS NULL` + `started_at + 3×avg_duration < now` heuristic. Surface as "Active Jobs" card or badge count. Small scope: just a count + suspect list. |
| 3 | Mon May 11 | M5 Auto-sync (6-hour background timer + manual trigger bridged). If lightweight, land it. If it requires scheduler infrastructure, defer to V1.1. |
| 4 | Tue May 12 | M3 Test suite — minimal `pytest` covering `_make_job_id()`, projection math, SQL query edge cases. M4 Lint/type check (`ruff` + `mypy`). |
| 5 | Wed May 13 | Bug fix / hardening pass. Cross-device regression check (MacBook → iPad). Verify iPad toolbar, modal sizing, theme compatibility. |
| 6 | Thu May 14 | **FEATURE FREEZE**. Final backend validation. Push passing commit. Update CHECKPOINT.md. Any unmerged work gets cut or moved to V1.1. |

### V1.0 Technical In-Scope

| # | Task | Status | Decision |
|---|------|--------|----------|
| H1 | Success/failure cost split | ✅ Delivered | Keep |
| H2 | Per-job token columns (detail rows) | ✅ Delivered | Keep |
| H3 | Sortable jobs table | ✅ Delivered | Keep |
| H4 | Top jobs highlight (Leader Board) | ✅ Delivered | Keep |
| H5 | Per-run expansion | 🟡 Not started | **V1.0** — fits existing expandable row pattern |
| H6 | Duration metrics | ✅ Delivered | Keep |
| H7 | Suspect/hung job detection | ⚫ Not started | **V1.0** — small scope: count + suspect list |
| H8 | Global outcome toggle | ✅ Delivered | Keep |
| M5 | Auto-sync | 🟡 Listed, never implemented | **V1.0 if small**; else V1.1 |
| M8 | Wrapper vs payload success decision | ⚫ Pending | **V1.0** — document in README, not a code change |

### V1.0 Technical Out-of-Scope (V1.1 or later)

| # | Task | Reason |
|---|------|--------|
| D1 | Budget thresholds + alerts | Needs notification infra Cronalytics doesn't own |
| D2 | Model comparison recommendations | Needs stable pricing + recommendation engine |
| D3 | Schedule optimization | Requires session output analysis, out of scope |
| D4 | Tool-level cost attribution | Needs `session_messages` join, too large |
| D5 | Live log streaming | Separate infrastructure project |
| D6 | External DB backend | SQLite sufficient for single-user local |
| — | Sparkline event annotations | Nice-to-have, not launch-critical |
| — | Pace column tooltip/education | README covers this; in-UI can be V1.1 |
| — | Session log deep-link from Top Runs | Requires Hermes session URL schema |

---

## Phase 2: Polish & Packaging (Days 7–11, May 15–19)

Goal: Make the launch shiny. Docs, demo, and GitHub are the product as much as the code.

| Day | Date | Focus |
|-----|------|-------|
| 7 | Fri May 15 | **README** — installation, screenshots, feature list, one-liner. **CHANGELOG** — version history from first commit to now. |
| 8 | Sat May 16 | **Demo video / GIF** — 30–60 second screen capture showing outcome toggle, sortable table, expandable rows, leader board. Compressed, loopable. |
| 9 | Sun May 17 | **GitHub release** — tag v1.0.0, release notes, attach demo video/GIF. **X thread draft** — 3–5 tweet thread with hook, demo, GitHub link, CTA. |
| 10 | Mon May 18 | **Discord announcement** — copy + formatting. **YouTube video** — edit, thumbnail, description, end cards. Schedule/premiere for Tuesday 2:00 PM EST. **Final cross-device pass** — MacBook + iPad, 30+ Omarchy themes. |
| 11 | Tue May 19 | **LAUNCH DAY**. Execute timeline below. Monitor responses. Be available for questions for 4 hours post-launch. |

### Launch Day Timeline (EST — Tuesday, May 19)

| Time | Action | Platform |
|------|--------|----------|
| 9:00 AM | GitHub release v1.0.0 goes live | GitHub |
| 9:30 AM | Announcement thread posted | X/Twitter |
| 10:00 AM | Community announcement with links | Discord |
| 2:00 PM | YouTube premiere goes live | YouTube |
| All day | Monitor mentions, reply to questions, retweet/respond | All |

---

## The 11-Day Checklist

### Technical (Days 1–6)
- [ ] H5 — Per-run expansion in Jobs Breakdown
- [ ] H7 — Suspect / orphaned / hung job detection
- [ ] M5 — Auto-sync (if feasible; else cut)
- [ ] M3 — Minimal test suite (`pytest`)
- [ ] M4 — Lint + type check (`ruff` + `mypy`)
- [ ] M8 — Document wrapper vs payload success in README
- [ ] Hardening / regression pass (MacBook → iPad)
- [ ] **May 14: FEATURE FREEZE**

### Packaging (Days 7–11)
- [ ] README.md — install, features, screenshots
- [ ] CHANGELOG.md — v1.0.0 release notes
- [ ] Demo video / GIF — 30–60s screen capture
- [ ] GitHub release — tag, notes, demo attachment
- [ ] X thread — draft, schedule for 9:30 AM EST May 19
- [ ] Discord announcement — draft, schedule for 10:00 AM EST May 19
- [ ] YouTube video — edit, thumbnail, schedule premiere 2:00 PM EST May 19
- [ ] Final cross-device / cross-theme pass
- [ ] **May 19: LAUNCH**

---

## If We Fall Behind

**Cut order (never slip launch date):**
1. M5 Auto-sync → V1.1
2. H7 Suspect detection → V1.1 (if scope creeps beyond count + list)
3. H5 Per-run expansion → V1.1 (but it's the last technical feature — try to keep it)
4. YouTube video → Skip, rely on GIF + screenshots

**Never cut:** README, CHANGELOG, GitHub release, X thread. These *are* the launch.

---

## Source: Launch Day Research

Full research report saved at `~/launch_day_research.md`.

**Consensus:** Tuesday is the single best day for synchronized cross-platform developer tool launches. X, GitHub, and Discord all peak Tuesday–Wednesday. YouTube prefers Thursday but Tuesday is within 10–15% of peak for tech content — an acceptable trade-off for unified launch momentum.
