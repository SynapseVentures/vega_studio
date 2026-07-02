## Goal

Replace the fixed-schema data model with **user-defined columns** and **multiple named datasets**, so the exported Vega-Lite JSON uses the exact field names and dataset ids that will exist in the real data.

## New data model

```text
BuilderState
├── datasets: Dataset[]                 // 1..N named datasets
│     └── { id, name, columns[], rows[] }
│            columns: [{ name, type: string|number|date }]
│            rows: [{ [columnName]: value }]       // free-form
├── activeDatasetIds: string[]          // which dataset(s) feed the chart
├── layerMode: "single" | "layered" | "tabs"
│     • single  → one active dataset, normal spec
│     • layered → each dataset becomes a Vega-Lite layer, same encoding shape
│     • tabs    → preview switches per dataset, each has its own spec
├── encoding: Record<ChartType, Record<Role, string>>
│     Role = x | y | color | size | label | x2 | start | end | milestone | ...
│     Value = a column NAME from the active dataset (empty = unused)
└── style: StyleState                   // unchanged
```

Exported JSON:

- single → `{ data: { name: "<datasetName>" }, ... }`
- layered → `{ datasets: { <name>: [...] }, layer: [ {data:{name}, ...}, ... ] }`
  (or with `includeData:false`, only the `data:{name}` references remain — no rows leak)

## UI changes (Data tab)

```text
┌ Datasets ────────────────────────────┐
│ [sales ▾] [+ add] [rename] [delete]  │  ← dropdown of datasets, add/rename
│ Layer mode: (•) single ( ) layered   │
│                       ( ) tabs       │
├ Columns (of active dataset) ─────────┤
│ month     [string ▾]  [x]            │
│ revenue   [number ▾]  [x]            │
│ region    [string ▾]  [x]            │
│ [+ add column]                       │
├ Rows ────────────────────────────────┤
│ Row 1 · month [Apr] · revenue [42]…  │  ← inputs generated from columns
│ …                                    │
├ Encoding (role → column) ────────────┤
│ X axis    [ month ▾ ]                │
│ Y axis    [ revenue ▾ ]              │
│ Color by  [ region ▾ ]               │
│ Label     [ (none) ▾ ]               │
└──────────────────────────────────────┘
```

Loading a chart type seeds encoding + a default dataset with sensible column names, but the user can rename anything.

## Build-spec changes

- `buildSpec` accepts the new state and resolves role→column via `encoding[chartType]`.
- If a required role is empty, that layer is skipped (with a friendly placeholder).
- `layered` mode maps each dataset to one layer using the same encoding shape.
- `tabs` mode: `buildSpec` returns one spec per dataset; UI shows dataset tabs above the chart.
- `includeData=false` still strips rows and emits `datasets: {}` shell.

## Files touched

- `src/lib/chart-builder/types.ts` — new `Dataset`, `Column`, `Encoding`, `LayerMode`.
- `src/lib/chart-builder/schemas.ts` → becomes `roles.ts`: per-chart `ROLES` (id, label, required, type hint) + default column/encoding seeds.
- `src/lib/chart-builder/build-spec.ts` — rewritten to consume `datasets + encoding`.
- `src/components/chart-builder/ChartBuilder.tsx` — Data tab rewritten; header gets dataset switcher + layer-mode; preview supports dataset tabs.
- Existing Style/Marks/More tabs, presets, undo/redo, share URL, PNG/SVG export continue to work; state shape bumps to `v2` and old localStorage/hash payloads are ignored (not migrated).

## Scope call-outs

- Chart types kept working end-to-end in this pass: bar, line, area, scatter, gantt, pie, donut, heatmap, histogram, boxplot, hierarchy. Same coverage as today.
- Trendlines / reference lines / facet keep working on the resolved encoding.
- Tooltip fields become "all columns of the active dataset" by default.

Confirm and I'll implement.