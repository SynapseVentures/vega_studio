import type {
  ChartType,
  Column,
  Dataset,
  Encoding,
  FieldSchema,
  Role,
  Row,
} from "./types";

/** Per-chart roles that the spec builder understands. */
export const ROLES: Record<ChartType, Role[]> = {
  bar: [
    { id: "x", label: "Category (X)", type: "string", required: true },
    { id: "y", label: "Value (Y)", type: "number", required: true },
    { id: "color", label: "Color by", type: "string" },
    { id: "label", label: "Label", type: "string" },
  ],
  line: [
    { id: "x", label: "X", type: "number", required: true },
    { id: "y", label: "Y", type: "number", required: true },
    { id: "color", label: "Series (color)", type: "string" },
    { id: "label", label: "Label", type: "string" },
  ],
  area: [
    { id: "x", label: "X", type: "number", required: true },
    { id: "y", label: "Y", type: "number", required: true },
    { id: "color", label: "Series (color)", type: "string" },
    { id: "label", label: "Label", type: "string" },
  ],
  scatter: [
    { id: "x", label: "X", type: "number", required: true },
    { id: "y", label: "Y", type: "number", required: true },
    { id: "color", label: "Color by", type: "string" },
    { id: "size", label: "Size", type: "number" },
    { id: "label", label: "Label", type: "string" },
  ],
  gantt: [
    { id: "task", label: "Task", type: "string", required: true },
    { id: "start", label: "Start", type: "date", required: true },
    { id: "end", label: "End", type: "date", required: true },
    { id: "color", label: "Color by", type: "string" },
    { id: "milestone", label: "Milestone date", type: "date" },
    { id: "label", label: "Milestone label", type: "string" },
  ],
  hierarchy: [
    { id: "parent", label: "Parent", type: "string", required: true },
    { id: "name", label: "Name", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "label", label: "Label", type: "string" },
  ],
  pie: [
    { id: "category", label: "Category", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "label", label: "Label", type: "string" },
  ],
  donut: [
    { id: "category", label: "Category", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "label", label: "Label", type: "string" },
  ],
  heatmap: [
    { id: "row", label: "Row", type: "string", required: true },
    { id: "col", label: "Column", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "label", label: "Label", type: "string" },
  ],
  histogram: [
    { id: "value", label: "Value", type: "number", required: true },
    { id: "color", label: "Color by", type: "string" },
  ],
  boxplot: [
    { id: "category", label: "Category", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
  ],
  radar: [
    { id: "axis", label: "Axis", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "color", label: "Series", type: "string" },
  ],
  funnel: [
    { id: "stage", label: "Stage", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
  ],
  waterfall: [
    { id: "category", label: "Step", type: "string", required: true },
    { id: "value", label: "Delta", type: "number", required: true },
  ],
  treemap: [
    { id: "category", label: "Category", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
    { id: "color", label: "Group", type: "string" },
  ],
  calendar: [
    { id: "date", label: "Date", type: "date", required: true },
    { id: "value", label: "Value", type: "number", required: true },
  ],
  bullet: [
    { id: "category", label: "Metric", type: "string", required: true },
    { id: "value", label: "Actual", type: "number", required: true },
    { id: "target", label: "Target", type: "number", required: true },
  ],
  candlestick: [
    { id: "date", label: "Date", type: "date", required: true },
    { id: "open", label: "Open", type: "number", required: true },
    { id: "close", label: "Close", type: "number", required: true },
    { id: "high", label: "High", type: "number", required: true },
    { id: "low", label: "Low", type: "number", required: true },
  ],
  sankey: [
    { id: "source", label: "Source", type: "string", required: true },
    { id: "target", label: "Target", type: "string", required: true },
    { id: "value", label: "Value", type: "number", required: true },
  ],
};

/** Seed columns for a fresh dataset per chart type. */
export const SEED_COLUMNS: Record<ChartType, Column[]> = {
  bar: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
    { name: "group", type: "string" },
    { name: "label", type: "string" },
  ],
  line: [
    { name: "x", type: "number" },
    { name: "y", type: "number" },
    { name: "series", type: "string" },
    { name: "label", type: "string" },
  ],
  area: [
    { name: "x", type: "number" },
    { name: "y", type: "number" },
    { name: "series", type: "string" },
    { name: "label", type: "string" },
  ],
  scatter: [
    { name: "x", type: "number" },
    { name: "y", type: "number" },
    { name: "category", type: "string" },
    { name: "size", type: "number" },
    { name: "label", type: "string" },
  ],
  gantt: [
    { name: "task", type: "string" },
    { name: "start", type: "date" },
    { name: "end", type: "date" },
    { name: "milestone", type: "date" },
    { name: "label", type: "string" },
  ],
  hierarchy: [
    { name: "parent", type: "string" },
    { name: "name", type: "string" },
    { name: "value", type: "number" },
    { name: "label", type: "string" },
  ],
  pie: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
    { name: "label", type: "string" },
  ],
  donut: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
    { name: "label", type: "string" },
  ],
  heatmap: [
    { name: "row", type: "string" },
    { name: "col", type: "string" },
    { name: "value", type: "number" },
    { name: "label", type: "string" },
  ],
  histogram: [
    { name: "value", type: "number" },
    { name: "group", type: "string" },
  ],
  boxplot: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
  ],
  radar: [
    { name: "axis", type: "string" },
    { name: "value", type: "number" },
    { name: "series", type: "string" },
  ],
  funnel: [
    { name: "stage", type: "string" },
    { name: "value", type: "number" },
  ],
  waterfall: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
  ],
  treemap: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
    { name: "group", type: "string" },
  ],
  calendar: [
    { name: "date", type: "date" },
    { name: "value", type: "number" },
  ],
  bullet: [
    { name: "category", type: "string" },
    { name: "value", type: "number" },
    { name: "target", type: "number" },
  ],
  candlestick: [
    { name: "date", type: "date" },
    { name: "open", type: "number" },
    { name: "close", type: "number" },
    { name: "high", type: "number" },
    { name: "low", type: "number" },
  ],
  sankey: [
    { name: "source", type: "string" },
    { name: "target", type: "string" },
    { name: "value", type: "number" },
  ],
};

export const DEFAULT_ENCODING: Record<ChartType, Encoding> = {
  bar: { x: "category", y: "value", color: "group", label: "label" },
  line: { x: "x", y: "y", color: "series", label: "label" },
  area: { x: "x", y: "y", color: "series", label: "label" },
  scatter: { x: "x", y: "y", color: "category", size: "size", label: "label" },
  gantt: { task: "task", start: "start", end: "end", milestone: "milestone", label: "label" },
  hierarchy: { parent: "parent", name: "name", value: "value", label: "label" },
  pie: { category: "category", value: "value", label: "label" },
  donut: { category: "category", value: "value", label: "label" },
  heatmap: { row: "row", col: "col", value: "value", label: "label" },
  histogram: { value: "value", color: "group" },
  boxplot: { category: "category", value: "value" },
  radar: { axis: "axis", value: "value", color: "series" },
  funnel: { stage: "stage", value: "value" },
  waterfall: { category: "category", value: "value" },
  treemap: { category: "category", value: "value", color: "group" },
  calendar: { date: "date", value: "value" },
  bullet: { category: "category", value: "value", target: "target" },
  candlestick: { date: "date", open: "open", close: "close", high: "high", low: "low" },
  sankey: { source: "source", target: "target", value: "value" },
};

export const SAMPLE_ROWS: Record<ChartType, Row[]> = {
  bar: [
    { category: "Jan", value: 28, group: "A", label: "" },
    { category: "Feb", value: 55, group: "A", label: "" },
    { category: "Mar", value: 43, group: "A", label: "" },
    { category: "Apr", value: 91, group: "B", label: "Peak" },
    { category: "May", value: 81, group: "B", label: "" },
    { category: "Jun", value: 53, group: "B", label: "" },
  ],
  line: [
    { x: 1, y: 10, series: "North", label: "" },
    { x: 2, y: 28, series: "North", label: "" },
    { x: 3, y: 22, series: "North", label: "" },
    { x: 4, y: 44, series: "North", label: "Peak" },
    { x: 1, y: 18, series: "South", label: "" },
    { x: 2, y: 12, series: "South", label: "" },
    { x: 3, y: 35, series: "South", label: "" },
    { x: 4, y: 30, series: "South", label: "" },
  ],
  area: [
    { x: 1, y: 10, series: "North", label: "" },
    { x: 2, y: 28, series: "North", label: "" },
    { x: 3, y: 22, series: "North", label: "" },
    { x: 4, y: 44, series: "North", label: "" },
    { x: 1, y: 18, series: "South", label: "" },
    { x: 2, y: 12, series: "South", label: "" },
    { x: 3, y: 35, series: "South", label: "" },
    { x: 4, y: 30, series: "South", label: "" },
  ],
  scatter: [
    { x: 10, y: 22, category: "A", size: 120, label: "" },
    { x: 24, y: 40, category: "A", size: 200, label: "" },
    { x: 30, y: 15, category: "B", size: 80, label: "" },
    { x: 42, y: 55, category: "B", size: 300, label: "Outlier" },
    { x: 55, y: 33, category: "C", size: 160, label: "" },
    { x: 68, y: 70, category: "C", size: 240, label: "" },
  ],
  gantt: [
    { task: "Design", start: "2025-01-01", end: "2025-01-14", milestone: "2025-01-10", label: "Review" },
    { task: "Build", start: "2025-01-10", end: "2025-02-05", milestone: "2025-02-01", label: "Alpha" },
    { task: "Test", start: "2025-02-01", end: "2025-02-20", milestone: null, label: "" },
    { task: "Launch", start: "2025-02-18", end: "2025-02-28", milestone: "2025-02-28", label: "Go live" },
  ],
  hierarchy: [
    { parent: "", name: "Root", value: 0, label: "" },
    { parent: "Root", name: "Engineering", value: 40, label: "" },
    { parent: "Root", name: "Design", value: 20, label: "" },
    { parent: "Root", name: "Sales", value: 30, label: "" },
    { parent: "Root", name: "Ops", value: 15, label: "" },
  ],
  pie: [
    { category: "Engineering", value: 40, label: "" },
    { category: "Design", value: 20, label: "" },
    { category: "Sales", value: 30, label: "" },
    { category: "Ops", value: 15, label: "" },
  ],
  donut: [
    { category: "Engineering", value: 40, label: "" },
    { category: "Design", value: 20, label: "" },
    { category: "Sales", value: 30, label: "" },
    { category: "Ops", value: 15, label: "" },
  ],
  heatmap: [
    { row: "Mon", col: "Week 1", value: 12, label: "" },
    { row: "Mon", col: "Week 2", value: 24, label: "" },
    { row: "Tue", col: "Week 1", value: 18, label: "" },
    { row: "Tue", col: "Week 2", value: 32, label: "" },
    { row: "Wed", col: "Week 1", value: 22, label: "" },
    { row: "Wed", col: "Week 2", value: 40, label: "" },
  ],
  histogram: [
    { value: 4, group: "A" },
    { value: 7, group: "A" },
    { value: 12, group: "A" },
    { value: 15, group: "B" },
    { value: 17, group: "B" },
    { value: 22, group: "A" },
    { value: 24, group: "A" },
    { value: 30, group: "B" },
  ],
  boxplot: [
    { category: "A", value: 12 },
    { category: "A", value: 22 },
    { category: "A", value: 28 },
    { category: "A", value: 40 },
    { category: "B", value: 8 },
    { category: "B", value: 20 },
    { category: "B", value: 25 },
    { category: "B", value: 60 },
    { category: "C", value: 15 },
    { category: "C", value: 28 },
    { category: "C", value: 33 },
  ],
  radar: [
    { axis: "Speed", value: 80, series: "Product A" },
    { axis: "Reliability", value: 65, series: "Product A" },
    { axis: "Comfort", value: 90, series: "Product A" },
    { axis: "Safety", value: 70, series: "Product A" },
    { axis: "Efficiency", value: 55, series: "Product A" },
    { axis: "Speed", value: 60, series: "Product B" },
    { axis: "Reliability", value: 85, series: "Product B" },
    { axis: "Comfort", value: 70, series: "Product B" },
    { axis: "Safety", value: 88, series: "Product B" },
    { axis: "Efficiency", value: 75, series: "Product B" },
  ],
  funnel: [
    { stage: "Visitors", value: 10000 },
    { stage: "Signups", value: 3200 },
    { stage: "Trials", value: 1400 },
    { stage: "Paid", value: 420 },
    { stage: "Retained", value: 260 },
  ],
  waterfall: [
    { category: "Start", value: 100 },
    { category: "Revenue", value: 80 },
    { category: "Costs", value: -35 },
    { category: "Tax", value: -12 },
    { category: "Refunds", value: -8 },
    { category: "End", value: 0 },
  ],
  treemap: [
    { category: "Chrome", value: 65, group: "Desktop" },
    { category: "Safari", value: 18, group: "Desktop" },
    { category: "Firefox", value: 8, group: "Desktop" },
    { category: "Edge", value: 6, group: "Desktop" },
    { category: "iOS Safari", value: 30, group: "Mobile" },
    { category: "Chrome Mobile", value: 42, group: "Mobile" },
    { category: "Samsung", value: 12, group: "Mobile" },
  ],
  calendar: [
    { date: "2025-01-06", value: 8 },
    { date: "2025-01-07", value: 12 },
    { date: "2025-01-08", value: 5 },
    { date: "2025-01-09", value: 20 },
    { date: "2025-01-10", value: 15 },
    { date: "2025-01-13", value: 22 },
    { date: "2025-01-14", value: 18 },
    { date: "2025-01-15", value: 30 },
    { date: "2025-01-16", value: 12 },
    { date: "2025-01-17", value: 9 },
    { date: "2025-01-20", value: 16 },
    { date: "2025-01-21", value: 24 },
    { date: "2025-01-22", value: 40 },
    { date: "2025-01-23", value: 6 },
    { date: "2025-01-24", value: 11 },
  ],
  bullet: [
    { category: "Q1 Revenue", value: 82, target: 100 },
    { category: "Q2 Revenue", value: 110, target: 100 },
    { category: "Q3 Revenue", value: 95, target: 120 },
    { category: "Q4 Revenue", value: 130, target: 120 },
  ],
  candlestick: [
    { date: "2025-01-01", open: 100, close: 108, high: 112, low: 98 },
    { date: "2025-01-02", open: 108, close: 104, high: 110, low: 100 },
    { date: "2025-01-03", open: 104, close: 115, high: 118, low: 103 },
    { date: "2025-01-04", open: 115, close: 112, high: 120, low: 110 },
    { date: "2025-01-05", open: 112, close: 120, high: 124, low: 111 },
    { date: "2025-01-06", open: 120, close: 118, high: 122, low: 115 },
  ],
  sankey: [
    { source: "Search", target: "Landing", value: 500 },
    { source: "Landing", target: "Signup", value: 200 },
    { source: "Landing", target: "Bounce", value: 300 },
    { source: "Signup", target: "Trial", value: 140 },
    { source: "Signup", target: "Drop", value: 60 },
    { source: "Trial", target: "Paid", value: 55 },
  ],
};

let __datasetSeq = 1;
export function newDatasetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ds-${Date.now()}-${__datasetSeq++}`;
}

export function makeSeedDataset(chartType: ChartType, name = "data"): Dataset {
  return {
    id: newDatasetId(),
    name,
    columns: SEED_COLUMNS[chartType].map((c) => ({ ...c })),
    rows: SAMPLE_ROWS[chartType].map((r) => ({ ...r })),
    transforms: [],
  };
}

export function emptyRowFor(columns: Column[]): Row {
  const r: Row = {};
  for (const c of columns) r[c.name] = c.type === "number" ? 0 : "";
  return r;
}

export function renameColumn(dataset: Dataset, oldName: string, newName: string): Dataset {
  if (oldName === newName) return dataset;
  const columns = dataset.columns.map((c) =>
    c.name === oldName ? { ...c, name: newName } : c,
  );
  const rows = dataset.rows.map((row) => {
    const next: Row = {};
    for (const k of Object.keys(row)) {
      next[k === oldName ? newName : k] = row[k];
    }
    return next;
  });
  return { ...dataset, columns, rows };
}

export function remapEncoding(enc: Encoding, oldName: string, newName: string): Encoding {
  const out: Encoding = { ...enc };
  for (const k of Object.keys(out)) if (out[k] === oldName) out[k] = newName;
  return out;
}

// ---------- Legacy compat ----------
export const SCHEMAS: Record<ChartType, FieldSchema[]> = Object.fromEntries(
  (Object.keys(ROLES) as ChartType[]).map((t) => [
    t,
    ROLES[t].map<FieldSchema>((r) => ({
      key: r.id,
      label: r.label,
      type: r.type,
      optional: !r.required,
    })),
  ]),
) as Record<ChartType, FieldSchema[]>;
