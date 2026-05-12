# Cronalytics V1.0 Launch Plan

> **Launch Date: Tuesday, May 19, 2026 at ~9:00 AM EST**
> **Days Remaining: 8 (from May 11)**
> **Feature Freeze: May 14, 2026** ✅ COMPLETE

## Philosophy

Code can iterate. First impressions are permanent.

**Technical features freeze May 14.** Everything after that is docs, demo, and launch polish.
If an idea shows up May 15, it goes in V1.1. No exceptions.

---

## Phase 1: Technical Lock (Days 1–4, May 11–14)

Goal: Merge remaining V1.0 code. No new features after May 14 end-of-day.

| Day | Date | Focus |
|-----|------|-------|
| 1 | Mon May 11 | Toolbar polish, hero redesign, manual-sync UX hardening, terminology unification, DaySelector wrapping hardening, large-font theme resilience. |
| 2 | Tue May 12 | M3 Test suite — 83 pytest tests. M4 Lint/type check (`ruff` + `mypy`). Documentation rewrite pass. |
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
| M3 | Test suite | ✅ Delivered | Keep |
| M4 | Lint / type check | ✅ Delivered | Keep |
| M5 | Auto-sync | ⚫ Deferred | **V1.1** — bootstrap scanner + hook + retry cover gaps |
| M6 | iPad + theme compatibility | ✅ Delivered | Keep |
| M7 | Educational modals | ✅ Delivered | Keep |
| M8 | Wrapper vs payload success | ✅ Delivered | Keep |
| — | Toolbar polish (DaySelector, toggles, wrapping, sync UX) | ✅ Delivered | Keep |
| — | Hero redesign (dictionary entry, accent border, system sans) | ✅ Delivered | Keep |
| — | API validation layer | ✅ Delivered | Keep |
| — | Keyboard accessibility (a11y) | ✅ Delivered | Keep |
| — | Large-font theme resilience | ✅ Delivered | Keep |
| — | Monolith source split → modular `src/` | ✅ Delivered | Keep |

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
| D8 | Focus trap in modals | Medium effort, moderate DOM risk in Hermes context |
| — | Sparkline event annotations | Nice-to-have, not launch-critical |
| — | Session log deep-link from Top Runs | Requires Hermes session URL schema |

---

## Phase 2: Polish & Packaging (Days 5–8, May 15–19)

Goal: Make the launch shiny. Docs, demo, and GitHub are the product as much as the code.

| Day | Date | Focus |
|-----|------|-------|
| 5 | Fri May 15 | **README** — installation, screenshots, feature list, one-liner. **CHANGELOG** — version history. **Docs** — DESIGN.md, FEATURES.md, USAGE.md, INSTALL.md, UNINSTALL.md finalized. |
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
- [x] M3 — Test suite (`pytest`, 83 tests)
- [x] M4 — Lint + type check (`ruff` + `mypy`)
- [x] M6 — iPad + theme compatibility
- [x] M7 — Educational modals
- [x] M8 — Document wrapper vs payload success
- [x] API validation layer
- [x] Keyboard accessibility (a11y)
- [x] Large-font theme resilience
- [x] Monolith source split → modular `src/`
- [x] **May 14: FEATURE FREEZE**

### Packaging (Days 5–8)
- [x] README.md — install, features, architecture
- [x] DESIGN.md — architecture, data flow, technical decisions
- [x] FEATURES.md — complete feature catalog
- [x] USAGE.md — dashboard usage guide
- [x] INSTALL.md — installation methods
- [x] UNINSTALL.md — clean removal
- [ ] CHANGELOG.md — standalone version history
- [ ] Demo video / GIF — 30–60s screen capture
- [ ] GitHub release — tag, notes, demo attachment
- [ ] X thread — draft, schedule for 9:30 AM EST May 19
- [ ] Discord announcement — draft, schedule for 10:00 AM EST May 19
- [ ] Final cross-device / cross-theme pass
- [ ] **May 19: LAUNCH**

---

## If We Fall Behind

**Cut order (never slip launch date):**
1. Demo video → Skip, rely on GIF + screenshots
2. Standalone CHANGELOG.md → Use README changelog section

**Never cut:** README, DESIGN, FEATURES, USAGE, GitHub release, X thread. These *are* the launch.

---

## Source: Launch Day Research

Full research report saved at `~/launch_day_research.md`.

**Consensus:** Tuesday is the single best day for synchronized cross-platform developer tool launches. X, GitHub, and Discord all peak Tuesday–Wednesday.
