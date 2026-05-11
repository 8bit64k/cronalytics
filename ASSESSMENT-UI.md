# Cronalytics UI / UX Assessment

**Scope:** Dashboard frontend (`dashboard/dist/index.js`)  
**Date:** 2026-05-11  
**Assessor:** Phosphor  
**Lines of Code:** ~1,781 (single bundled file)  
**Framework:** React 18 (via `React.createElement`, no JSX source in repo)

---

## Executive Summary

The Cronalytics UI is functional, visually cohesive, and leverages the Hermes SDK well, but it is delivered as a **single 1,781-line bundled module** with no source-map or separate component files. The architecture is a classic "mega-component" anti-pattern: one `CronTab` function holds ~800 lines of intertwined data fetching, business logic, localStorage I/O, sorting, modal orchestration, and markup. There is zero memoization, no TypeScript, and no Error Boundary. For a V1.0 launch this is acceptable; for V1.1 it is a maintainability time-bomb.

**Bottom line:** The UI works today, but every new feature will make the bundle harder to reason about. The highest-impact fix is splitting `CronTab` into focused sub-components and introducing a lightweight state container (useReducer or Zustand).

---

## 1. Component Structure & Modularity

### P0 — Monolithic Bundle (1,781 LOC)
- **Finding:** The entire UI ships as one IIFE. `CronTab` alone spans roughly lines 666–1,770 and mixes ~15 `useState` declarations, 7 `useModal` instances, 3 `useEffect` blocks, inline sorting logic, card markup, table markup, modal orchestration, sync logic, and toast handling.
- **Risk:** Impossible to unit-test in isolation. A bug in the sparkline tooltip requires reading through sync-state and localStorage code to find it. No hot-reload granularity.
- **Recommendation:** Split into logical files even if you continue bundling to a single `dist/index.js`:
  - `hooks/useApi.js` — already extracted as a pattern, just move it.
  - `hooks/usePersistentState.js` — wrap the `localStorage` + `useState` pairs.
  - `components/Toolbar.js` — `DaySelector`, `OutcomeToggle`, `ModeToggle`, plus the sticky bar.
  - `components/SummaryCards.js` — the 4-card grid.
  - `components/JobsTable.js` — sortable table + expando rows.
  - `components/JobDetailModal.js` — `Modal` + `JobDetailView`.
  - `components/SparkLine.js` — already its own function, promote it.
  - `lib/formatters.js` — `fmtCost`, `fmtTime`, `fmtDuration`, etc.
  - `lib/icons.js` — all SVG icon factories.

### P1 — Single Responsibility Violations
- **Finding:** `CronTab` fetches data *and* renders it *and* handles sync *and* manages persistence. `JobDetailView` fetches runs *and* sorts them client-side *and* renders the table.
- **Recommendation:** Move client-side sorting into a `useSorted` hook. Move API paths into a small `api.js` constants file. Keep components as "data in, UI out."

### P1 — Missing Source Files
- **Finding:** The repo contains only the bundled `dist/index.js`. There are no `.jsx`, `.tsx`, `.css`, or source-map files committed. Debugging in production requires reading minified-like bundled code.
- **Recommendation:** Commit the unbundled source (e.g., `dashboard/src/`) and add a build step (Vite, Rollup, or even `esbuild`) that produces `dist/index.js`. This makes the UI reviewable, diffable, and testable.

---

## 2. State Management & Hooks

### P0 — No State Normalization / Reducer
- **Finding:** `CronTab` declares ~15 individual `useState` calls. Related state (e.g., `syncing`, `syncInfo`, `syncToast`) is scattered. Sort state is an object but still managed with `useState`.
- **Risk:** Adding a fourth filter (e.g., model family) means another `useState` + another `useEffect` + another localStorage key. Easy to create inconsistent UI states.
- **Recommendation:** Replace the scattered `useState` calls in `CronTab` with `useReducer` or a lightweight store. Example shape:
  ```js
  const initial = {
    filters: { days: 30, outcome: 'both', mode: 'all' },
    ui:    { expandedId: null, selectedJobId: null, sortConfig: { key: null, dir: 'asc' } },
    sync:  { syncing: false, info: null, toast: null },
  };
  ```

### P1 — `useApi` Has No Retry / Deduping
- **Finding:** `useApi` (lines 214–228) fires on every `path` or `reload` change. Rapid filter toggles can spawn multiple in-flight requests. The cancellation flag prevents stale sets but does not cancel the underlying `fetch`.
- **Recommendation:** Add an `AbortController` and wire it to the cleanup function so the HTTP request itself is cancelled on unmount or path change.

### P1 — `useEffect` Dependency Arrays Are Sparse
- **Finding:** The health-fetch `useEffect` (lines 729–740) has an empty dependency array `[]` so it runs once on mount. If the plugin is hot-reloaded or re-mounted, it re-fetches, but there is no polling. This is fine for launch, but the pattern should be explicit (`// mount-only`) rather than accidental.
- **Recommendation:** Add a comment or a named hook (`useMount`) to make intent obvious.

### P2 — Modal State Explosion
- **Finding:** Seven independent `useModal()` calls for: pace, runs, cost, tokens, topRuns, topCost, topTokens, topPace. That's 7 `isOpen` booleans + 7 open/close pairs.
- **Recommendation:** Collapse to a single `activeModal: null | 'pace' | 'runs' | ...` state. The current pattern is not wrong, just noisy.

---

## 3. Performance Optimization

### P0 — Zero Memoization
- **Finding:** No `useMemo`, `useCallback`, or `React.memo` appears anywhere. Every keystroke in the custom-days input, every hover on a table row, and every `setHoverIdx` in `SparkLine` triggers a full re-render of `CronTab` and all its children.
- **Impact:** On a jobs list of 50+ rows, hovering the sparkline will re-render the entire table, toolbar, and summary cards.
- **Recommendation:**
  1. Wrap `SparkLine` in `React.memo` — it only needs to re-render when `runs` changes.
  2. Memoize the `sortedJobs` array with `useMemo` keyed on `jobList` and `sortConfig`.
  3. Memoize the `getSortValue` lookup object (currently recreated every render).
  4. In `JobDetailView`, memoize `sortedRuns` — currently re-sorted on every render even when data is stable.

### P1 — Inline Anonymous Functions in Props
- **Finding:** Dozens of arrow functions are created inline in `React.createElement` props:
  - `onClick={() => setSelectedJobId(j.job_id)}`
  - `onMouseEnter: (e) => { e.currentTarget.style.background = "..." }`
  - `onClick: () => { setSKey(col.key); setSDir(...); }`
- **Impact:** If any child were memoized, these new function references would defeat it. Today the children are not memoized, so the issue is latent — but as soon as you add `React.memo` to table rows, these will force re-renders.
- **Recommendation:** For list items, use a stable handler factory or pass the item ID and look it up in a stable callback:
  ```js
  const handleRowClick = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);
  ```

### P1 — Sparkline Re-calculates Extrema on Every Render
- **Finding:** `SparkLine` (lines 447–544) computes `maxCost`, `maxTok`, `maxDur`, `tokPts`, `durPts` on every render. These are `O(n)` walks over the `runs` array.
- **Recommendation:** Wrap the geometry calculations in `useMemo(() => ..., [runs])`.

### P2 — No Code Splitting
- **Finding:** The entire UI is one synchronous script. The `JobDetailView` (including its table, sorting, and sparkline) is downloaded and parsed even if the user never opens a job detail.
- **Recommendation:** For post-launch, consider dynamic `import()` for the detail view if the bundle grows.

---

## 4. Code Quality & Security

### P0 — No TypeScript
- **Finding:** The entire frontend is plain JavaScript. API responses are destructured without validation. A backend schema change (e.g., renaming `projected_cost_30d` to `projected_cost_30d_usd`) would fail silently or render `undefined`.
- **Risk:** The backend (`plugin_api.py`) is typed with Pydantic, but those contracts evaporate at the HTTP boundary.
- **Recommendation:** Add a lightweight runtime validation layer (e.g., Zod or io-ts) or migrate the source to TypeScript. Even JSDoc `@type` annotations on the `useApi` return value would help.

### P0 — No Error Boundary
- **Finding:** If `SparkLine` receives a malformed `runs` entry (e.g., `estimated_cost_usd: null` where `Math.max(...)` expects numbers), the entire `CronTab` will unmount and the user sees a blank plugin tab.
- **Recommendation:** Wrap the plugin registration in an Error Boundary:
  ```js
  class PluginErrorBoundary extends React.Component {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
      return this.state.hasError
        ? React.createElement('div', null, 'Cronalytics encountered an error.')
        : this.props.children;
    }
  }
  ```

### P1 — Hardcoded Magic Values
- **Finding:** Colors, thresholds, and sizes are scattered as string literals:
  - Pace thresholds: `1.0`, `2.0` (lines 79–81)
  - Sync-age thresholds: `60`, `3600`, `86400`, `604800` (lines 70–74)
  - Model-name strings: `"kimi"`, `"gemini"`, `"gpt"`, `"claude"` (lines 467–470)
  - Style values repeated dozens of times (`"0.4rem 0.35rem"`, `fontFamily: "var(--theme-font-mono, monospace)"`)
- **Recommendation:** Centralize constants:
  ```js
  const PACE = { GREEN: 1.0, RED: 2.0 };
  const MODEL_PALETTE = { kimi: '#22c55e', gemini: '#f59e0b', gpt: '#3b82f6', claude: '#d946ef' };
  ```

### P1 — Input Validation Is Minimal
- **Finding:** `DaySelector` validates `parseInt(custom, 10)` and rejects negative numbers, but does not cap the upper bound. A user entering `99999` will hit the API with `?days=99999`, potentially causing a slow query or timeout.
- **Recommendation:** Clamp days to a reasonable max (e.g., 365) in the UI before calling `onChange`.

### P2 — `innerHTML` / XSS Surface
- **Finding:** The code does not use `dangerouslySetInnerHTML`, so XSS risk is low. However, `jobName` and `model` strings from the API are rendered directly as text children. If the backend ever returns HTML-like strings, they will be escaped by React, which is correct.
- **Status:** Acceptable for launch.

---

## 5. Accessibility & UX

### P1 — Table Headers Are Not Semantically Sortable
- **Finding:** The jobs table headers use `cursor: "pointer"` and `onClick` but lack `role="button"`, `tabIndex={0}`, and keyboard handlers. Keyboard-only users cannot sort.
- **Recommendation:** Add `tabIndex={0}` and an `onKeyDown` handler for `Enter`/`Space` on each `<th>`.

### P1 — Modal Focus Trap Missing
- **Finding:** The `Modal` component (lines 238–306) handles `Escape` and backdrop click, but does not trap focus inside the modal. Tabbing from the close button can send focus to elements behind the overlay.
- **Recommendation:** Use a focus-trap pattern (or a tiny `useFocusTrap` hook) so keyboard navigation stays inside the modal while open.

### P2 — Color-Only Status Indicators
- **Finding:** Success/failure in the runs table is shown as green `✓` vs red `✗`. Color-blind users may struggle to distinguish them.
- **Recommendation:** Keep the symbols (they are already text), but ensure the symbols themselves differ enough — `✓` vs `✗` is actually good; just avoid relying on color alone for the sparkline legend.

---

## 6. Common "Code Smells" Audit

| Smell | Present? | Location / Evidence |
|---|---|---|
| **Massive component (>500 LOC)** | ✅ Yes | Entire file is 1,781 LOC; `CronTab` is ~1,100 LOC |
| **Intertwined UI & business logic** | ✅ Yes | Sorting, filtering, localStorage, and API calls inside render |
| **Anonymous functions in props** | ✅ Yes | Dozens of inline arrows in `onClick`, `onMouseEnter`, etc. |
| **Hardcoded strings/numbers** | ✅ Yes | Colors, thresholds, style objects scattered throughout |
| **Missing `key` prop bugs** | ❌ No | Lists use stable `job_id` and `session_id` keys |
| **Prop drilling** | ⚠️ Latent | Not an issue today because everything is one component; will become one immediately upon splitting |
| **Empty catch blocks** | ✅ Yes | `catch(() => {})` on hero fetch and health fetch (lines 726, 739) — swallows network errors silently |

---

## 7. Priority Matrix

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | Split monolith into source files + add build step | Medium | **Critical** — blocks testing, review, and team contribution |
| **P0** | Introduce Error Boundary | Low | **Critical** — prevents total UI crash from one bad API response |
| **P0** | Add runtime type validation or TS migration | Medium | **High** — catches contract drift between Python backend and JS frontend |
| **P1** | Extract `useReducer` for `CronTab` state | Low | **High** — reduces bug surface when adding new filters |
| **P1** | Memoize `sortedJobs`, `SparkLine` geometry, and callbacks | Low | **Medium** — smoother interactions on large datasets |
| **P1** | Centralize constants (colors, thresholds, styles) | Low | **Medium** — theming and maintenance |
| **P1** | Add `AbortController` to `useApi` | Low | **Medium** — kills stale requests |
| **P1** | Clamp `days` input + validate before API call | Low | **Low-Medium** — prevents accidental DoS |
| **P2** | Keyboard sort handlers on table headers | Low | **Medium** — a11y |
| **P2** | Focus trap in modal | Low | **Medium** — a11y |
| **P2** | Collapse 7 modal states into one enum | Low | **Low** — cleanliness |

---

## 8. Immediate Recommendations for V1.0 Freeze

If the May 14 freeze is immovable, do these **three** things only:

1. **Add an Error Boundary** (30 min). Wrap `CronTab` so a malformed API response cannot white-screen the plugin.
2. **Clamp the days input** (15 min). Max 365 days in `DaySelector` before calling `onChange`.
3. **Document the build process** (15 min). Add a `README.md` in `dashboard/` explaining how `dist/index.js` is produced, even if the answer is "hand-edited and bundled manually for now."

Everything else can ship in a V1.1 polish sprint.

---

## Appendix A — File Inventory

```
dashboard/
├── manifest.json          # Plugin manifest (valid)
├── plugin_api.py          # FastAPI backend (out of UI scope)
├── dist/
│   ├── index.js           # Bundled React UI (1,781 LOC)  ← sole frontend artifact
│   └── hero.txt           # Static banner text
```

**Notable absence:** No `src/`, no `.jsx`/`.tsx`, no `package.json` for the UI, no CSS files, no tests, no source map.
