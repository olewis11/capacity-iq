# CapacityIQ — Developer Guide

## Project purpose
CapacityIQ is a React SPA for engineering resource planning: it maps headcount supply (engineers and their allocations) against project demand across a 5-tier discipline org hierarchy, with a swimlane grid view, people/org-chart view, analytics, and a change log.

## Tech stack
- **React 18** — loaded as a global (`window.React`); never `import React from 'react'`. Use `const {useState,...}=React;` at the top of any file that needs hooks.
- **esbuild** — bundles `src/app.jsx` with `--bundle --format=iife --minify --sourcemap=inline`
- **Single HTML output** — the bundle is injected into `index.html` at `<!-- BUILD:APP -->` and written to `dist/index.html`
## Build & dev
| Command | What it does |
|---------|-------------|
| `./build.sh` | Compile + bundle → `dist/index.html`; exit 0 on success |
| `./dev.sh` | fswatch watcher; rebuilds on any change under `src/` or `index.html` |

## Persistence

This copy has no backend — all data (`state.engineers`, `projects`, `assignments`, `discMeta`, change log, snapshots) is read/written to the browser's `localStorage` (see the `STORE_*` keys and `loadLS`/`saveLS` helpers in `app.jsx`, and `StoreDataModal.jsx`). On a brand-new browser with nothing saved yet, `buildDemoSeed()` in `app.jsx` populates a small fictional org so the app isn't empty on first load. To back this with something durable instead, swap `loadLS`/`saveLS` for calls to your own REST/DB service.

## Source layout

### Top-level
| File | Description |
|------|-------------|
| `src/app.jsx` | Main `App` component: all state, event handlers, routing, and the top-level JSX layout |
| `src/constants.js` | Palette constants, disc/group metadata, role labels, pure color helpers (`blendHex`, `tierBlend`, `getColorForAlloc`, …) |
| `src/context.js` | React contexts: `DiscCtx` (disc config), `UserCtx` (current user), `ViewCtx` (render state shared to grid cells) |
| `src/reducer.js` | Pure Redux-style reducer for all state mutations (projects, engineers, assignments, tierOrder, discMeta) |

### `src/utils/`
| File | Exports |
|------|---------|
| `months.js` | `addMonths`, `monthDiff`, `fmtMonth`, `fmtMonthLong`, `fmtMonthShort`, `ratioToBarColor`, `currentMonth` |
| `demand.js` | `getDemand`, `getGroupDemand`, `roundHalf`, `leafName` |
| `supply.js` | `getSupply`, `getAssigned`, `getEngineerTotalAlloc`, `getOrgSupply` |
| `csv.js` | `csvEsc`, `parseCSVLine`, `parseImportCSV` |
| `org.js` | `sortByOrder`, `discDemandKey`, `discPaletteColor` |

### `src/hooks/`
| File | Exports |
|------|---------|
| `useUndoableReducer.js` | `useUndoableReducer(reducer, initialState)` — wraps `useReducer` with undo/redo history (up to 50 steps for data-mutating actions) |

### `src/components/`
| File | Exports |
|------|---------|
| `SwimCell.jsx` | Leaf-level swimlane cell: supply bar + gap indicator; reads `editMode` from `ViewCtx` |
| `SummaryCell.jsx` | Aggregate heatmap cell for sg/ssg/sssg rows; reads `editMode`, `showHeatmap`, `discHeatmapMax`, `TODAY` from `ViewCtx` |
| `AssignmentBarRow.jsx` | Horizontal assignment duration bar for the project header row |
| `MasterDurationBar.jsx` | Project-level duration bar in the grid header |
| `EngBadges.jsx` | Engineer avatar badge strip shown on assignment bars |
| `Tooltip.jsx` | Hover tooltip wrapper |
| `DiscSparkline.jsx` | Tiny sparkline chart for discipline supply/demand trends |
| `ProjectRows.jsx` | Renders all discipline swimlane rows (sg→ssg→sssg→disc) for one expanded project; uses `ViewCtx` |
| `TeamRosterModal.jsx` | Modal showing engineers assigned to a discipline group |
| `AnalyticsModal.jsx` | Exports `OrgAnalytics` (inline panel) and `AnalyticsModal` (modal wrapper) |
| `ChangeLog.jsx` | Exports `applyLogFilters`, `LogMessage`, `ChangeLogEntries`, `ChangeLog` |
| `AssignPanel.jsx` | Slide-in panel for adding/editing engineer assignments |
| `SettingsModal.jsx` | Project settings modal (name, dates, demand, ramp config) |
| `HelpModal.jsx` | In-app help/keyboard shortcuts reference |
| `SnapshotsModal.jsx` | Named snapshot save/restore UI |
| `WorkdayImportModal.jsx` | Workday headcount CSV import wizard |
| `EngineerRegistryModal.jsx` | Manage engineer roster and discipline assignments |
| `TierOrderModal.jsx` | Drag-to-reorder discipline tier hierarchy |
| `StoreDataModal.jsx` | Local demo data (localStorage) file browser |
| `UserRegistryModal.jsx` | User access/role management |
| `ActionMenu.jsx` | Context action menu for project rows |

## Data model

### 5-tier org hierarchy (discipline tree)
```
group (e.g. "SW", "HW")
  └─ subgroup (e.g. "Software - Autonomy")
       └─ subsubgroup (e.g. "Autonomy - Perception")
            └─ subsubsubgroup (e.g. "Perception - Vision")
                 └─ disc key (leaf, e.g. "Perception - Vision - Classical")
```
Stored in `state.discMeta`: `{ [discKey]: { color, bg, border, abbr, group, subgroup?, subsubgroup?, subsubsubgroup? } }`.
Hierarchy maps are derived by memoized computation in `App` and passed down as props (or via `DiscCtx`).

### Project shape
```js
{
  id, name, color,
  startMonth, endMonth,          // "YYYY-MM" strings
  demand: { [discKey]: number }, // peak FTE demand per disc
  monthlyDemand: { [discKey]: { [month]: number } }, // per-month overrides
  rampUp:   { enabled, months },
  rampDown: { enabled, months },
}
```

### Assignment shape
```js
{
  id, projectId, engineerId,
  startMonth, endMonth,   // "YYYY-MM" strings
  allocation,             // integer percent (e.g. 100 = 1.0 FTE)
}
```

## Key functions

| Function | Where | What it does |
|----------|-------|-------------|
| `getDemand(project, disc, month)` | `utils/demand.js` | Returns FTE demand for a disc in a month, applying monthly overrides and ramp curves |
| `getGroupDemand(project, group, month)` | `utils/demand.js` | Same as `getDemand` but at group key level |
| `getSupply(assignments, engineers, projectId, disc, month)` | `utils/supply.js` | Returns allocated FTE supply for a disc on a project in a month |
| `getAssigned(assignments, engineers, projectId, disc, month)` | `utils/supply.js` | Returns `[{eng, assignment}]` array for a disc/project/month |
| `getEngineerTotalAlloc(assignments, month, engineerId)` | `utils/supply.js` | Total allocation % for an engineer in a month (across all projects) |
| `SummaryCell` | `components/SummaryCell.jsx` | Aggregate cell for subgroup/subsubgroup rows; shows italic supply or demand number with optional heatmap |
| `SwimCell` | `components/SwimCell.jsx` | Leaf disc cell with supply fill bar and gap/surplus indicator |
| `discDemandKey(d, activeMeta)` | `utils/org.js` | Returns the demand key for a disc (subsubgroup → subgroup → group → disc) |
| `discPaletteColor(disc, activeMeta, sgPaletteIdx)` | `utils/org.js` | Returns the DEPT_PALETTE bold color for a disc |

## Editing cheatsheet

| To change… | Go to… |
|-----------|--------|
| Demand calculation / ramp logic | `src/utils/demand.js` → `getDemand` |
| Supply / allocation math | `src/utils/supply.js` |
| Heatmap color thresholds | `src/components/SummaryCell.jsx` (heat alpha) or `src/components/SwimCell.jsx` (demand-mode intensity) |
| Supply bar colors | `src/utils/months.js` → `ratioToBarColor`; bar fill in `SwimCell.jsx` |
| Swimlane row rendering for projects | `src/components/ProjectRows.jsx` |
| Discipline group/subgroup row structure | `src/app.jsx` — the large discipline-view section mapped over `discGroupOrder` |
| Any modal UI | The corresponding `src/components/*Modal.jsx` file |
| Reducer / state mutations | `src/reducer.js` |
| Undo/redo history | `src/hooks/useUndoableReducer.js` |
| Org hierarchy maps | Memoized block near top of `App()` in `src/app.jsx` (builds `discGroupMap`, `discSubgroupMap`, etc.) |
| ViewCtx (grid render context) | `src/context.js` (definition) + `<ViewCtx.Provider>` in `src/app.jsx` |
| Discipline palette colors | `src/constants.js` → `DISC_PALETTE_SW`, `DISC_PALETTE_HW`, `DISC_PALETTE_OTHER`, `DEPT_PALETTE` |
