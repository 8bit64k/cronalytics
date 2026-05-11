# Cronalytics V1.0 Launch Plan

> **Launch Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
> **Days Remaining: 8 (from May 11)**

## Philosophy

Code can iterate. First impressions are permanent.

**Technical features freeze May 14.** Everything after that is docs, demo, and launch polish.
If an idea shows up May 15, it goes in V1.1. No exceptions.

---

## Phase 1: Technical Lock (Days 1–4, May 11–14)

Goal: Merge remaining V1.0 code. No new features after May 14 end-of-day.

| Day | Date | Focus |
|-----|------|-------|
| 1 | Mon May 11 | Toolbar polish, hero redesign, manual-sync UX hardening, terminology unification, DaySelector wrapping hardening. |
| 2 | Tue May 12 | M3 Test suite — minimal `pytest` covering `_make_job_id()`, projection math, SQL edge cases. M4 Lint/type check (`ruff` + `mypy`). |
| 3 | Wed May 13 | Bug fix / hardening pass. Cross-device regression check (MacBook → iPad). Verify iPad toolbar, modal sizing, theme compatibility. |
| 4 | Thu May 14 | **FEATURE FREEZE**. Final backend validation. Push passing commit. Update CHECKPOINT.md. Any unmerged work gets cut or moved to V1.1. |

### V1.0 Technical In-Scope

| # | Task | Status | Decision |
|---|------|--------|----------|
| H1 | Success/failure cost split | ✅ Delivered | Keep |
| H2 | Per-job token columns (detail rows) | ✅ Delivered | Keep |
| H3 | Sortable jobs table | ✅ Delivered | Keep |
| H4 | Top jobs highlight (Leader Board) | ✅ Delivered | Keep |
| H5 | Per-run expansion (Job Detail Modal) | ✅ Delivered | Keep |
| H6 | Duration metrics | ✅ Delivered | Keep |
| H7 | Suspect/hung job detection | ⚫ Deferred | **V1.1** — troubleshooting-oriented, low surface area |
| H8 | Global outcome toggle | ✅ Delivered | Keep |
| H9 | Agent / no_agent mode awareness | ✅ Delivered | Keep |
| M5 | Auto-sync | ⚫ Deferred | **V1.1** — bootstrap scanner + hook + retry cover gaps |
| M8 | Wrapper vs payload success | 🟡 Document | **V1.0** — one paragraph in README, not a code change |
| — | Toolbar polish (DaySelector, toggles, wrapping, sync UX) | ✅ Delivered | Keep |
| — | Hero redesign (dictionary entry, accent border, system sans) | ✅ Delivered | Keep |

### V1.0 Technical Out-of-Scope (V1.1 or later)

| # | Task | Reason |
|---|------|--------|
| D1 | Budget thresholds + alerts | Needs notification infra Cronalytics doesn't own |
| D2 | Model comparison recommendations | Needs stable pricing + recommendation engine |
| D3 | Schedule optimization | Requires session output analysis, out of scope |
| D4 | Tool-level cost attribution | Needs `session_messages` join, too large |
| D5 | Live log streaming | Separate infrastructure project |
| D6 | External DB backend | SQLite sufficient for single-user local |
| D7 | Job detail modal pagination | Modal capped at 200 runs; "show all" deferred |
| — | Sparkline event annotations | Nice-to-have, not launch-critical |
| — | Pace column tooltip/education | README covers this; in-UI can be V1.1 |
| — | Session log deep-link from Top Runs | Requires Hermes session URL schema |

---

## Phase 2: Polish & Packaging (Days 5–8, May 15–19)

Goal: Make the launch shiny. Docs, demo, and GitHub are the product as much as the code.

| Day | Date | Focus |
|-----|------|-------|
| 5 | Fri May 15 | **README** — installation, screenshots, feature list, one-liner. **CHANGELOG** — version history from first commit to now. |
| 6 | Sat May 16 | **Demo video / GIF** — 30–60 second screen capture showing outcome toggle, sortable table, expandable rows, leader board. Compressed, loopable. |
| 7 | Sun May 17 | **GitHub release** — tag v1.0.0, release notes, attach demo video/GIF. **X thread draft** — 3–5 tweet thread with hook, demo, GitHub link, CTA. |
| 8 | Mon May 18 | **Discord announcement** — copy + formatting. **Final cross-device pass** — MacBook + iPad, 30+ Omarchy themes. Last bug sweep. |
| 9 | Tue May 19 | **LAUNCH DAY**. Execute timeline below. Monitor responses. Be available for questions for 4 hours post-launch. |

### Launch Day Timeline (EST — Tuesday, May 19)

| Time | Action | Platform |
|------|--------|----------|
| 9:00 AM | GitHub release v1.0.0 goes live | GitHub |
| 9:30 AM | Announcement thread posted | X/Twitter |
| 10:00 AM | Community announcement with links | Discord |
| All day | Monitor mentions, reply to questions, retweet/respond | All |

---

## The 8-Day Checklist

### Technical (Days 1–4)
- [x] H5 — Per-run expansion in Jobs Breakdown (modal-based drilldown)
- [x] H9 — Agent / no_agent mode awareness
- [x] Toolbar polish — DaySelector, Outcome/Mode toggles, wrapping, sync UX
- [x] Hero redesign — dictionary entry, accent border, system sans
- [ ] M3 — Minimal test suite (`pytest`)
- [ ] M4 — Lint + type check (`ruff` + `mypy`)
- [ ] M8 — Document wrapper vs payload success in README
- [ ] Hardening / regression pass (MacBook → iPad)
- [ ] **May 14: FEATURE FREEZE**

### Packaging (Days 5–8)
- [ ] README.md — install, features, screenshots
- [ ] CHANGELOG.md — v1.0.0 release notes
- [ ] Demo video / GIF — 30–60s screen capture
- [ ] GitHub release — tag, notes, demo attachment
- [ ] X thread — draft, schedule for 9:30 AM EST May 19
- [ ] Discord announcement — draft, schedule for 10:00 AM EST May 19
- [ ] Final cross-device / cross-theme pass
- [ ] **May 19: LAUNCH**

---

## If We Fall Behind

**Cut order (never slip launch date):**
1. M3 Test suite → V1.1 (nice-to-have, not user-facing)
2. M4 Lint/type check → V1.1 (engineering hygiene, not launch-critical)
3. YouTube video → Skip, rely on GIF + screenshots

**Never cut:** README, CHANGELOG, GitHub release, X thread. These *are* the launch.

---

## Source: Launch Day Research

Full research report saved at `~/launch_day_research.md`.

**Consensus:** Tuesday is the single best day for synchronized cross-platform developer tool launches. X, GitHub, and Discord all peak Tuesday–Wednesday.
