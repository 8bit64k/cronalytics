# Cron Insights — Work Checkpoint
# Created: 2026-05-01 20:25
# Created by: Phosphor after gateway restart
# Next action for Nick: say "check Kanban" and I'll find this

## Active Task
Kanban: t_c4ca88f1 "Cron Insights: Cost formatting + Date range selector"
Status: IN PROGRESS (work was mid-flight before gateway restart)

## What Survived Restart
- Kanban task anchor: t_c4ca88f1 (assigned to phosphor)
- All git changes in working tree (uncommitted)

## What Was Lost
- Chat context explaining that work had begun
- My awareness that the changes existed (this file restores that)

## Current State Of Changes (as of git diff --stat)
dashboard/dist/index.js   |  76 insertions, deletions
 dashboard/plugin_api.py   |  22 insertions, deletions
 facts.py                 | 143 insertions, deletions
 tests/test_parser.py     |  24 insertions, deletions (unrelated to feature)

## What Was Done Before Restart

### 1) Cost Formatting — MOSTLY DONE
- Frontend fmtCost() changed from toFixed(6) to Intl.NumberFormat USD 2 decimals
- Backend facts.py changed from round(..., 8) to round(..., 4) for API responses
- REMAINING: verify costs render correctly in all cells (table, summary cards, trend)

### 2) Date Range Selector (7D/30D/90D/All) — PARTIALLY DONE

BACKEND (COMPLETE):
- plugin_api.py: summary, jobs, models, trends endpoints now accept days=0 (All), removed ge=1/le=90 constraints
- plugin_api.py: job_runs endpoint now accepts days parameter  
- facts.py: query_summary(), query_jobs(), query_job_runs() support days=0 (no WHERE clause)
- facts.py: previous_period logic gated to only compute when days > 0

FRONTEND (NEEDS VERIFICATION):
- DaySelector component created (7D/30D/90D/All buttons, styled)
- DaySelector placed in header row next to "Cron Insights" title
- useState(30) for days, passed as query param to all API calls
- windowLabel computed: "All time" or "Last N days"
- "Last 7 days" text replaced with windowLabel throughout

FRONTEND (LIKELY BUG — MUST FIX):
- useApi hook's dependency array may NOT include the URL string
- Changing DaySelector buttons probably does NOT trigger refetch
- Need to verify: open DevTools → Network tab → click 7D/30D/90D/All → should see new requests
- If no requests fire: need to fix useApi to accept url as reactive prop, or add useEffect wrapper

## Files To Touch To Complete
1. dashboard/dist/index.js — fix useApi reactivity if broken, verify DaySelector re-renders
2. dashboard/plugin_api.py — may already be complete (verify)
3. facts.py — may already be complete (verify)
4. No new files needed

## Test Plan
1. iPad → https://hermes.tail315577.ts.net/ → Cron Insights tab
2. Click each DaySelector button (7D, 30D, 90D, All)
3. Verify Network tab shows new API requests with correct ?days=N param
4. Verify costs show as $xx.xx not $x.xxxxxx
5. Verify summary cards update per window
6. Verify "All" shows all historical data (longer list or higher totals)

## What's Next After This
- Fix any bugs found in verification
- Commit the changes
- Nick's additional change requests (he hinted at "a few more")
