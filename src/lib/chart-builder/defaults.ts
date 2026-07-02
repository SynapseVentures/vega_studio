import type { PointShape, StyleState, ThemePreset } from "./types";

export const PALETTES: { name: string; colors: string[] }[] = [
  { name: "Ocean", colors: ["#0ea5e9", "#6366f1", "#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444"] },
  { name: "Forest", colors: ["#16a34a", "#65a30d", "#059669", "#0d9488", "#ca8a04", "#b45309"] },
  { name: "Sunset", colors: ["#f97316", "#ef4444", "#ec4899", "#a855f7", "#f59e0b", "#eab308"] },
  { name: "Mono", colors: ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"] },
  // Wong colorblind-safe palette
  { name: "Colorblind", colors: ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"] },
  { name: "Viridis", colors: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725", "#90d743"] },
];

export const SHAPE_OPTIONS: { value: PointShape; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "triangle-up", label: "Triangle up" },
  { value: "triangle-down", label: "Triangle down" },
  { value: "diamond", label: "Diamond" },
  { value: "cross", label: "Cross" },
];

export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "Inter, system-ui, sans-serif", label: "Inter / System" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "'Times New Roman', serif", label: "Times" },
];

export const DEFAULT_STYLE: StyleState = {
  theme: "light",

  markColor: "#6366f1",
  palette: PALETTES[0].colors,
  background: "#ffffff",
  textColor: "#0f172a",

  width: 520,
  height: 340,
  padding: 12,
  bandPadding: 0.2,
  axisLabelPadding: 4,
  responsive: false,

  pointShape: "circle",
  opacity: 1,
  strokeWidth: 2,
  cornerRadius: 2,
  lineInterpolation: "monotone",
  showPointsOnLine: true,
  showMilestones: true,
  innerRadius: 60,

  tooltipEnabled: true,
  tooltipFields: [],
  highlightOnHover: true,
  zoomPan: false,
  legendSelect: true,

  barOrientation: "vertical",
  areaFill: false,

  groupMode: "grouped",
  sortOrder: "none",
  groupField: "auto",
  showValueLabels: false,
  showMilestoneLabels: true,

  facetField: "none",
  facetColumns: 3,

  trendline: "none",
  movingAverageWindow: 3,

  refLineEnabled: false,
  refLineAxis: "y",
  refLineValue: 0,
  refLineColor: "#ef4444",
  refLineLabel: "",

  dataLabelFontSize: 11,
  dataLabelColor: "#0f172a",
  dataLabelFontWeight: "normal",
  dataLabelAlign: "center",
  dataLabelBaseline: "bottom",
  dataLabelPaddingX: 0,
  dataLabelPaddingY: 6,

  title: "",
  subtitle: "",
  xAxisTitle: "",
  yAxisTitle: "",
  fontFamily: "Inter, system-ui, sans-serif",
  titleFontSize: 16,
  labelFontSize: 11,
  titleFontWeight: "bold",
  labelAngle: 0,

  showGridX: false,
  showGridY: true,
  numberFormat: "",
  dateFormat: "",

  legendPosition: "right",

  description: "",

  caption: "",
  footnote: "",
  sourceAttribution: "",
  annotations: [],
  ranges: [],
  pins: [],
  activeBrandKitId: undefined,
};

export const BRAND_KITS_KEY = "vega-builder-brand-kits-v1";

export const THEME_PRESETS: Record<ThemePreset, Partial<StyleState>> = {
  light: {
    background: "#ffffff",
    textColor: "#0f172a",
    palette: PALETTES[0].colors,
    showGridY: true,
    showGridX: false,
  },
  dark: {
    background: "#0f172a",
    textColor: "#e2e8f0",
    palette: PALETTES[0].colors,
    showGridY: true,
    showGridX: false,
    dataLabelColor: "#e2e8f0",
  },
  minimal: {
    background: "#ffffff",
    textColor: "#334155",
    palette: PALETTES[3].colors,
    showGridY: false,
    showGridX: false,
    titleFontWeight: "normal",
  },
  editorial: {
    background: "#faf7f2",
    textColor: "#1c1917",
    palette: ["#c2410c", "#78716c", "#0f766e", "#a16207", "#7c2d12"],
    fontFamily: "Georgia, serif",
    titleFontWeight: "bold",
    showGridY: true,
    showGridX: false,
  },
};
