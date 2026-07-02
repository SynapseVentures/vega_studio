export type ChartType =
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "gantt"
  | "hierarchy"
  | "pie"
  | "donut"
  | "heatmap"
  | "histogram"
  | "boxplot"
  | "radar"
  | "funnel"
  | "waterfall"
  | "treemap"
  | "calendar"
  | "bullet"
  | "candlestick"
  | "sankey";

export type FieldType = "string" | "number" | "date";

export interface Column {
  name: string;
  type: FieldType;
}

export type Row = Record<string, string | number | null>;

/** Column-level transformation applied to a dataset before it feeds the chart. */
export interface DatasetTransform {
  id: string;
  /** New column name. */
  name: string;
  /** Vega expression, e.g. `datum.revenue * 1.2` or `datum.a + datum.b`. */
  expression: string;
  /** Type hint for the resulting column. */
  type?: FieldType;
}

export interface Dataset {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  transforms?: DatasetTransform[];
}

/** Join two datasets on shared keys — produces a virtual dataset. */
export interface JoinConfig {
  id: string;
  name: string;
  leftDatasetId: string;
  rightDatasetId: string;
  leftKey: string;
  rightKey: string;
  /** Prefix applied to right-side columns to avoid clashes. */
  rightPrefix?: string;
}

/** Encoding role slot per chart type. */
export interface Role {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
}

/** Map from role id -> column name (from the active dataset). */
export type Encoding = Record<string, string>;

export type LayerMode = "single" | "layered" | "tabs";

/** Story elements. */
export interface TextAnnotation {
  id: string;
  x: string | number;
  y: string | number;
  text: string;
  color: string;
  fontSize: number;
  align: "left" | "center" | "right";
  showArrow: boolean;
}
export interface RangeHighlight {
  id: string;
  axis: "x" | "y";
  from: string | number;
  to: string | number;
  color: string;
  opacity: number;
  label: string;
}
export interface Pin {
  id: string;
  x: string | number;
  y: string | number;
  text: string;
  author: string;
  createdAt: number;
  color: string;
  resolved: boolean;
}

/** Reusable branding preset. */
export interface BrandKit {
  id: string;
  name: string;
  palette: string[];
  fontFamily: string;
  primaryColor: string;
  textColor: string;
  background: string;
  logoUrl?: string;
}

// ---------- Legacy compat re-exports so existing imports keep working ----------
export type DataEntry = Row;
export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  optional?: boolean;
}
// -----------------------------------------------------------------------------

export type PointShape =
  | "circle"
  | "square"
  | "triangle-up"
  | "triangle-down"
  | "diamond"
  | "cross";

export type LineInterpolation = "linear" | "monotone" | "step";

export type BarGroupMode = "grouped" | "stacked" | "normalized";
export type SortOrder = "none" | "asc" | "desc";
export type LegendPosition = "top" | "right" | "bottom" | "left" | "none";
export type FontWeight = "normal" | "bold";
export type LabelAlign = "left" | "center" | "right";
export type LabelBaseline = "top" | "middle" | "bottom";
export type ThemePreset = "light" | "dark" | "minimal" | "editorial";
export type TrendlineType = "none" | "linear" | "moving-average";

export interface StyleState {
  theme: ThemePreset;
  markColor: string;
  palette: string[];
  background: string;
  textColor: string;

  width: number;
  height: number;
  padding: number;
  bandPadding: number;
  axisLabelPadding: number;
  responsive: boolean;

  pointShape: PointShape;
  opacity: number;
  strokeWidth: number;
  cornerRadius: number;
  lineInterpolation: LineInterpolation;
  showPointsOnLine: boolean;
  showMilestones: boolean;
  innerRadius: number;

  tooltipEnabled: boolean;
  tooltipFields: string[];
  highlightOnHover: boolean;
  zoomPan: boolean;
  legendSelect: boolean;

  barOrientation: "vertical" | "horizontal";
  areaFill: boolean;

  groupMode: BarGroupMode;
  sortOrder: SortOrder;
  groupField: string;
  showValueLabels: boolean;
  showMilestoneLabels: boolean;

  facetField: string;
  facetColumns: number;

  trendline: TrendlineType;
  movingAverageWindow: number;

  refLineEnabled: boolean;
  refLineAxis: "x" | "y";
  refLineValue: number;
  refLineColor: string;
  refLineLabel: string;

  dataLabelFontSize: number;
  dataLabelColor: string;
  dataLabelFontWeight: FontWeight;
  dataLabelAlign: LabelAlign;
  dataLabelBaseline: LabelBaseline;
  dataLabelPaddingX: number;
  dataLabelPaddingY: number;

  title: string;
  subtitle: string;
  xAxisTitle: string;
  yAxisTitle: string;
  fontFamily: string;
  titleFontSize: number;
  labelFontSize: number;
  titleFontWeight: FontWeight;
  labelAngle: number;

  showGridX: boolean;
  showGridY: boolean;
  numberFormat: string;
  dateFormat: string;

  legendPosition: LegendPosition;
  description: string;

  // ---- Storytelling ----
  caption: string;
  footnote: string;
  sourceAttribution: string;
  annotations: TextAnnotation[];
  ranges: RangeHighlight[];
  pins: Pin[];
  activeBrandKitId?: string;
}

export interface BuilderState {
  chartType: ChartType;
  datasets: Dataset[];
  joins: JoinConfig[];
  activeDatasetId: string;
  layerMode: LayerMode;
  encoding: Encoding;
  style: StyleState;
  brandKits: BrandKit[];
}

export interface SavedPreset {
  id: string;
  name: string;
  createdAt: number;
  state: BuilderState;
}
