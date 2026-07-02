import type {
  BuilderState,
  ChartType,
  Column,
  Dataset,
  DatasetTransform,
  Encoding,
  JoinConfig,
  Pin,
  RangeHighlight,
  Row,
  StyleState,
  TextAnnotation,
} from "./types";
import { ROLES } from "./schemas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;

function activeDataset(state: BuilderState): Dataset {
  return (
    state.datasets.find((d) => d.id === state.activeDatasetId) ?? state.datasets[0]
  );
}

function columnType(ds: Dataset, name: string): "quantitative" | "temporal" | "nominal" {
  const c = ds.columns.find((c) => c.name === name);
  if (!c) return "nominal";
  return c.type === "number" ? "quantitative" : c.type === "date" ? "temporal" : "nominal";
}

/** Resolve a role -> field name from encoding, or null if unset/missing. */
function f(state: BuilderState, role: string): string | null {
  const name = state.encoding[role];
  if (!name) return null;
  const ds = activeDataset(state);
  if (!ds.columns.some((c) => c.name === name)) return null;
  return name;
}

function baseConfig(style: StyleState): Spec {
  const legend =
    style.legendPosition === "none"
      ? { disable: true }
      : {
          labelColor: style.textColor,
          titleColor: style.textColor,
          orient: style.legendPosition,
          labelFont: style.fontFamily,
          titleFont: style.fontFamily,
          labelFontSize: style.labelFontSize,
        };
  return {
    background: style.background,
    padding: style.padding,
    view: { stroke: "transparent" },
    font: style.fontFamily,
    axis: {
      labelColor: style.textColor,
      titleColor: style.textColor,
      labelPadding: style.axisLabelPadding,
      labelFont: style.fontFamily,
      titleFont: style.fontFamily,
      labelFontSize: style.labelFontSize,
      titleFontSize: style.labelFontSize + 1,
      labelAngle: style.labelAngle,
      domainColor: style.textColor,
      tickColor: style.textColor,
      gridColor: style.textColor,
      gridOpacity: 0.12,
    },
    legend,
    title: {
      color: style.textColor,
      font: style.fontFamily,
      fontSize: style.titleFontSize,
      fontWeight: style.titleFontWeight,
      subtitleColor: style.textColor,
      subtitleFont: style.fontFamily,
      subtitleFontSize: Math.max(10, style.titleFontSize - 4),
      anchor: "start",
    },
    range: { category: style.palette },
    scale: { bandPaddingInner: style.bandPadding },
  };
}

function titleBlock(style: StyleState): Spec | undefined {
  if (!style.title && !style.subtitle) return undefined;
  return {
    text: style.title || " ",
    ...(style.subtitle ? { subtitle: style.subtitle } : {}),
    anchor: "start",
  };
}

function axisFor(
  style: StyleState,
  axis: "x" | "y",
  defaultTitle?: string,
  kind: "quantitative" | "temporal" | "nominal" = "quantitative",
) {
  const custom = axis === "x" ? style.xAxisTitle : style.yAxisTitle;
  const showGrid = axis === "x" ? style.showGridX : style.showGridY;
  const out: Spec = {
    title: custom || defaultTitle || null,
    grid: showGrid,
  };
  if (kind === "quantitative" && style.numberFormat) out.format = style.numberFormat;
  if (kind === "temporal" && style.dateFormat) out.format = style.dateFormat;
  return out;
}

function sortFor(style: StyleState, field: string) {
  if (style.sortOrder === "none") return undefined;
  return { field, order: style.sortOrder === "asc" ? "ascending" : "descending" };
}

function stackFor(style: StyleState): "zero" | "normalize" | null {
  if (style.groupMode === "stacked") return "zero";
  if (style.groupMode === "normalized") return "normalize";
  return null;
}

function tooltipEncoding(state: BuilderState) {
  if (!state.style.tooltipEnabled) return undefined;
  const ds = activeDataset(state);
  const selected =
    state.style.tooltipFields.length > 0
      ? state.style.tooltipFields.filter((n) => ds.columns.some((c) => c.name === n))
      : ds.columns.map((c) => c.name);
  return selected.map((name) => {
    const type = columnType(ds, name);
    const enc: Spec = { field: name, type };
    if (type === "quantitative" && state.style.numberFormat) enc.format = state.style.numberFormat;
    if (type === "temporal" && state.style.dateFormat) enc.format = state.style.dateFormat;
    return enc;
  });
}

function hoverParams(style: StyleState) {
  if (!style.highlightOnHover) return undefined;
  return [
    { name: "hover", select: { type: "point", on: "mouseover", clear: "mouseout" } },
  ];
}

function extraSelections(style: StyleState): Spec[] {
  const params: Spec[] = [];
  if (style.zoomPan) params.push({ name: "grid", select: "interval", bind: "scales" });
  if (style.legendSelect) {
    params.push({ name: "legendSel", select: { type: "point", fields: ["__color__"] }, bind: "legend" });
  }
  return params;
}

function hoverOpacity(style: StyleState) {
  const base = style.opacity;
  const dim = Math.max(0.1, base * 0.25);
  if (!style.highlightOnHover && !style.legendSelect) return { value: base };
  const conditions: Spec[] = [];
  if (style.legendSelect) conditions.push({ param: "legendSel", value: base, empty: true });
  if (style.highlightOnHover) conditions.push({ param: "hover", value: base, empty: true });
  return { condition: conditions, value: dim };
}

function withTitle(style: StyleState, spec: Spec): Spec {
  const t = titleBlock(style);
  return t ? { title: t, ...spec } : spec;
}

function labelTextExpr(labelField: string | null, fallbackField: string): string {
  if (labelField) return `datum['${labelField}'] != null && datum['${labelField}'] !== '' ? datum['${labelField}'] : datum['${fallbackField}']`;
  return `datum['${fallbackField}']`;
}

function dataLabelMark(style: StyleState, overrides: Spec = {}): Spec {
  return {
    type: "text",
    color: style.dataLabelColor,
    font: style.fontFamily,
    fontSize: style.dataLabelFontSize,
    fontWeight: style.dataLabelFontWeight,
    align: style.dataLabelAlign,
    baseline: style.dataLabelBaseline,
    dx: style.dataLabelPaddingX,
    dy: -style.dataLabelPaddingY,
    ...overrides,
  };
}

function refLineLayer(style: StyleState): Spec | null {
  if (!style.refLineEnabled) return null;
  const axis = style.refLineAxis;
  const layers: Spec[] = [
    {
      mark: { type: "rule", color: style.refLineColor, strokeDash: [4, 4], strokeWidth: 1.5 },
      encoding: { [axis]: { datum: style.refLineValue } },
    },
  ];
  if (style.refLineLabel) {
    layers.push({
      mark: {
        type: "text",
        color: style.refLineColor,
        text: style.refLineLabel,
        align: axis === "y" ? "left" : "center",
        baseline: axis === "y" ? "bottom" : "top",
        dx: axis === "y" ? 4 : 0,
        dy: axis === "y" ? -2 : 4,
        font: style.fontFamily,
        fontSize: style.labelFontSize,
      },
      encoding: { [axis]: { datum: style.refLineValue } },
    });
  }
  return { layer: layers };
}

function trendlineLayers(state: BuilderState, xField: string, yField: string): Spec[] {
  const { style } = state;
  const groupField = f(state, "color");
  if (style.trendline === "none") return [];
  if (style.trendline === "linear") {
    return [
      {
        transform: [
          { regression: yField, on: xField, ...(groupField ? { groupby: [groupField] } : {}) },
        ],
        mark: { type: "line", strokeDash: [6, 4], strokeWidth: 2, opacity: 0.9 },
        encoding: {
          x: { field: xField, type: "quantitative" },
          y: { field: yField, type: "quantitative" },
          ...(groupField ? { color: { field: groupField, type: "nominal" } } : {}),
        },
      },
    ];
  }
  return [
    {
      transform: [
        {
          window: [{ op: "mean", field: yField, as: "__ma__" }],
          frame: [-Math.max(1, style.movingAverageWindow), 0],
          ...(groupField ? { groupby: [groupField] } : {}),
        },
      ],
      mark: { type: "line", strokeDash: [4, 3], strokeWidth: 2, opacity: 0.9 },
      encoding: {
        x: { field: xField, type: "quantitative" },
        y: { field: "__ma__", type: "quantitative" },
        ...(groupField ? { color: { field: groupField, type: "nominal" } } : {}),
      },
    },
  ];
}

function facetWrap(state: BuilderState, inner: Spec): Spec {
  const fld = state.style.facetField;
  if (!fld || fld === "none") return inner;
  const ds = activeDataset(state);
  if (!ds.columns.some((c) => c.name === fld)) return inner;
  return {
    facet: { field: fld, type: "nominal", columns: state.style.facetColumns },
    spec: inner,
  };
}

// ---------- Builders ----------

function buildBar(state: BuilderState): Spec {
  const { style } = state;
  const xF = f(state, "x");
  const yF = f(state, "y");
  if (!xF || !yF) return placeholder("bar", ["Category (X)", "Value (Y)"]);
  const colorF = f(state, "color");
  const horizontal = style.barOrientation === "horizontal";
  const catAxis = horizontal ? "y" : "x";
  const valAxis = horizontal ? "x" : "y";
  const stack = stackFor(style);

  const encoding: Spec = {
    [catAxis]: {
      field: xF,
      type: "nominal",
      axis: axisFor(style, catAxis, undefined, "nominal"),
      sort: sortFor(style, yF),
    },
    [valAxis]: {
      field: yF,
      type: "quantitative",
      axis: axisFor(style, valAxis, undefined, "quantitative"),
      stack,
    },
    opacity: hoverOpacity(style),
  };
  if (colorF) {
    encoding.color = { field: colorF, type: "nominal" };
    if (style.groupMode === "grouped") {
      if (horizontal) encoding.yOffset = { field: colorF };
      else encoding.xOffset = { field: colorF };
    }
  } else {
    encoding.color = { value: style.markColor };
  }
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;

  const barLayer: Spec = {
    mark: { type: "bar", cornerRadius: style.cornerRadius },
    params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
    encoding,
  };

  const layers: Spec[] = [barLayer];
  if (style.showValueLabels && !colorF) {
    const labelF = f(state, "label");
    layers.push({
      transform: [{ calculate: labelTextExpr(labelF, yF), as: "__label" }],
      mark: dataLabelMark(style, {
        dy: horizontal ? 0 : -style.dataLabelPaddingY,
        dx: horizontal ? style.dataLabelPaddingX + 6 : style.dataLabelPaddingX,
        align: horizontal ? "left" : style.dataLabelAlign,
        baseline: horizontal ? "middle" : style.dataLabelBaseline,
      }),
      encoding: {
        [catAxis]: { field: xF, type: "nominal" },
        [valAxis]: { field: yF, type: "quantitative" },
        text: { field: "__label", type: "nominal" },
      },
    });
  }
  const ref = refLineLayer(style);
  if (ref) layers.push(...(ref.layer as Spec[]));
  return withTitle(style, facetWrap(state, layers.length === 1 ? barLayer : { layer: layers }));
}

function buildLineOrArea(state: BuilderState, area: boolean): Spec {
  const { style } = state;
  const xF = f(state, "x");
  const yF = f(state, "y");
  if (!xF || !yF) return placeholder(area ? "area" : "line", ["X", "Y"]);
  const colorF = f(state, "color");
  const ds = activeDataset(state);
  const xType = columnType(ds, xF);

  const encoding: Spec = {
    x: { field: xF, type: xType === "nominal" ? "nominal" : xType, axis: axisFor(style, "x", undefined, xType) },
    y: {
      field: yF,
      type: "quantitative",
      axis: axisFor(style, "y"),
      stack: colorF && area ? stackFor(style) : null,
    },
    opacity: hoverOpacity(style),
  };
  encoding.color = colorF ? { field: colorF, type: "nominal" } : { value: style.markColor };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;

  const params = [...(hoverParams(style) ?? []), ...extraSelections(style)];
  const layers: Spec[] = [
    {
      mark: {
        type: area || style.areaFill ? "area" : "line",
        interpolate: style.lineInterpolation,
        strokeWidth: style.strokeWidth,
        opacity: area || style.areaFill ? 0.4 : 1,
      },
      ...(params.length ? { params } : {}),
    },
  ];
  if (style.showPointsOnLine) {
    layers.push({ mark: { type: "point", shape: style.pointShape, filled: true, size: 80 } });
  }
  if (style.showValueLabels) {
    const labelF = f(state, "label");
    layers.push({
      transform: [{ calculate: labelTextExpr(labelF, yF), as: "__label" }],
      mark: dataLabelMark(style),
      encoding: { text: { field: "__label", type: "nominal" } },
    });
  }
  if (xType === "quantitative") layers.push(...trendlineLayers(state, xF, yF));
  const ref = refLineLayer(style);
  if (ref) layers.push(...(ref.layer as Spec[]));
  return withTitle(style, facetWrap(state, { encoding, layer: layers }));
}

function buildScatter(state: BuilderState): Spec {
  const { style } = state;
  const xF = f(state, "x");
  const yF = f(state, "y");
  if (!xF || !yF) return placeholder("scatter", ["X", "Y"]);
  const colorF = f(state, "color");
  const sizeF = f(state, "size");
  const encoding: Spec = {
    x: { field: xF, type: "quantitative", axis: axisFor(style, "x") },
    y: { field: yF, type: "quantitative", axis: axisFor(style, "y") },
    opacity: hoverOpacity(style),
  };
  encoding.color = colorF ? { field: colorF, type: "nominal" } : { value: style.markColor };
  if (sizeF) encoding.size = { field: sizeF, type: "quantitative" };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;

  const pointLayer: Spec = {
    mark: { type: "point", shape: style.pointShape, filled: true, strokeWidth: style.strokeWidth },
    params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
    encoding,
  };
  const layers: Spec[] = [pointLayer];
  if (style.showValueLabels) {
    const labelF = f(state, "label");
    layers.push({
      transform: [{ calculate: labelTextExpr(labelF, yF), as: "__label" }],
      mark: dataLabelMark(style, { dy: -(style.dataLabelPaddingY + 4) }),
      encoding: {
        x: { field: xF, type: "quantitative" },
        y: { field: yF, type: "quantitative" },
        text: { field: "__label", type: "nominal" },
      },
    });
  }
  layers.push(...trendlineLayers(state, xF, yF));
  const ref = refLineLayer(style);
  if (ref) layers.push(...(ref.layer as Spec[]));
  return withTitle(style, facetWrap(state, layers.length === 1 ? pointLayer : { layer: layers }));
}

function buildGantt(state: BuilderState): Spec {
  const { style } = state;
  const taskF = f(state, "task");
  const startF = f(state, "start");
  const endF = f(state, "end");
  if (!taskF || !startF || !endF) return placeholder("gantt", ["Task", "Start", "End"]);
  const colorF = f(state, "color");
  const milestoneF = f(state, "milestone");
  const labelF = f(state, "label");

  const encoding: Spec = {
    y: {
      field: taskF,
      type: "nominal",
      axis: axisFor(style, "y", undefined, "nominal"),
      sort: sortFor(style, startF),
    },
    x: { field: startF, type: "temporal", axis: axisFor(style, "x", "Timeline", "temporal") },
    x2: { field: endF },
    color: colorF ? { field: colorF, type: "nominal" } : { value: style.markColor },
    opacity: hoverOpacity(style),
  };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;

  const params = [...(hoverParams(style) ?? []), ...extraSelections(style)];
  const layers: Spec[] = [
    {
      mark: { type: "bar", cornerRadius: style.cornerRadius },
      encoding,
      ...(params.length ? { params } : {}),
    },
  ];
  if (style.showMilestones && milestoneF) {
    layers.push({
      transform: [{ filter: `datum['${milestoneF}'] != null && datum['${milestoneF}'] != ''` }],
      mark: { type: "point", shape: style.pointShape, filled: true, size: 160, color: "#ef4444" },
      encoding: {
        y: { field: taskF, type: "nominal" },
        x: { field: milestoneF, type: "temporal" },
      },
    });
    if (style.showMilestoneLabels) {
      layers.push({
        transform: [
          { filter: `datum['${milestoneF}'] != null && datum['${milestoneF}'] != ''` },
          { calculate: labelTextExpr(labelF, taskF), as: "__label" },
        ],
        mark: dataLabelMark(style, { dy: -(style.dataLabelPaddingY + 8) }),
        encoding: {
          y: { field: taskF, type: "nominal" },
          x: { field: milestoneF, type: "temporal" },
          text: { field: "__label", type: "nominal" },
        },
      });
    }
  }
  return withTitle(style, { layer: layers });
}

function buildHierarchy(state: BuilderState): Spec {
  const { style } = state;
  const nameF = f(state, "name");
  const parentF = f(state, "parent");
  const valueF = f(state, "value");
  if (!nameF || !parentF || !valueF) return placeholder("hierarchy", ["Parent", "Name", "Value"]);
  const encoding: Spec = {
    x: {
      field: nameF,
      type: "nominal",
      axis: axisFor(style, "x", undefined, "nominal"),
      sort: style.sortOrder === "none" ? "-y" : sortFor(style, valueF),
    },
    y: { field: valueF, type: "quantitative", axis: axisFor(style, "y") },
    color: { field: parentF, type: "nominal" },
    opacity: hoverOpacity(style),
  };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;
  return withTitle(style, {
    transform: [{ filter: `datum['${parentF}'] != null && datum['${parentF}'] != ''` }],
    mark: { type: "bar", cornerRadius: style.cornerRadius },
    params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
    encoding,
  });
}

function buildPie(state: BuilderState, donut: boolean): Spec {
  const { style } = state;
  const catF = f(state, "category");
  const valF = f(state, "value");
  if (!catF || !valF) return placeholder(donut ? "donut" : "pie", ["Category", "Value"]);
  const encoding: Spec = {
    theta: { field: valF, type: "quantitative", stack: true },
    color: { field: catF, type: "nominal" },
    opacity: hoverOpacity(style),
  };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;
  const arcLayer: Spec = {
    mark: { type: "arc", innerRadius: donut ? style.innerRadius : 0, stroke: style.background, strokeWidth: 1 },
    params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
    encoding,
  };
  if (!style.showValueLabels) return withTitle(style, arcLayer);
  const labelF = f(state, "label");
  return withTitle(style, {
    layer: [
      arcLayer,
      {
        transform: [{ calculate: labelTextExpr(labelF, valF), as: "__label" }],
        mark: dataLabelMark(style, { radius: donut ? style.innerRadius + 40 : 90 }),
        encoding: {
          theta: { field: valF, type: "quantitative", stack: true },
          text: { field: "__label", type: "nominal" },
          color: { value: style.dataLabelColor },
        },
      },
    ],
  });
}

function buildHeatmap(state: BuilderState): Spec {
  const { style } = state;
  const rowF = f(state, "row");
  const colF = f(state, "col");
  const valF = f(state, "value");
  if (!rowF || !colF || !valF) return placeholder("heatmap", ["Row", "Column", "Value"]);
  const encoding: Spec = {
    x: { field: colF, type: "nominal", axis: axisFor(style, "x", undefined, "nominal") },
    y: { field: rowF, type: "nominal", axis: axisFor(style, "y", undefined, "nominal") },
    color: {
      field: valF,
      type: "quantitative",
      scale: { range: [style.palette[0], style.palette[style.palette.length - 1]] },
    },
    opacity: hoverOpacity(style),
  };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;
  const rectLayer: Spec = {
    mark: { type: "rect", cornerRadius: style.cornerRadius },
    params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
    encoding,
  };
  if (!style.showValueLabels) return withTitle(style, rectLayer);
  const labelF = f(state, "label");
  return withTitle(style, {
    layer: [
      rectLayer,
      {
        transform: [{ calculate: labelTextExpr(labelF, valF), as: "__label" }],
        mark: dataLabelMark(style, { dy: 0, baseline: "middle", align: "center" }),
        encoding: {
          x: { field: colF, type: "nominal" },
          y: { field: rowF, type: "nominal" },
          text: { field: "__label", type: "nominal" },
        },
      },
    ],
  });
}

function buildHistogram(state: BuilderState): Spec {
  const { style } = state;
  const valF = f(state, "value");
  if (!valF) return placeholder("histogram", ["Value"]);
  const colorF = f(state, "color");
  const encoding: Spec = {
    x: { field: valF, type: "quantitative", bin: { maxbins: 12 }, axis: axisFor(style, "x") },
    y: { aggregate: "count", type: "quantitative", axis: axisFor(style, "y", "Count") },
    opacity: hoverOpacity(style),
  };
  if (colorF) {
    encoding.color = { field: colorF, type: "nominal" };
    (encoding.y as Spec).stack = stackFor(style) ?? "zero";
  } else {
    encoding.color = { value: style.markColor };
  }
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;
  const layers: Spec[] = [
    {
      mark: { type: "bar", cornerRadius: style.cornerRadius },
      params: [...(hoverParams(style) ?? []), ...extraSelections(style)],
      encoding,
    },
  ];
  const ref = refLineLayer(style);
  if (ref) layers.push(...(ref.layer as Spec[]));
  return withTitle(style, layers.length === 1 ? layers[0] : { layer: layers });
}

function buildBoxplot(state: BuilderState): Spec {
  const { style } = state;
  const catF = f(state, "category");
  const valF = f(state, "value");
  if (!catF || !valF) return placeholder("boxplot", ["Category", "Value"]);
  const encoding: Spec = {
    x: { field: catF, type: "nominal", axis: axisFor(style, "x", undefined, "nominal") },
    y: { field: valF, type: "quantitative", axis: axisFor(style, "y") },
    color: { field: catF, type: "nominal" },
  };
  const tt = tooltipEncoding(state);
  if (tt) encoding.tooltip = tt;
  return withTitle(style, { mark: { type: "boxplot", extent: "min-max" }, encoding });
}

function placeholder(kind: string, missing: string[]): Spec {
  return {
    mark: { type: "text", fontSize: 12, color: "#94a3b8" },
    encoding: {
      text: { value: `Map required fields for ${kind}: ${missing.join(", ")}` },
    },
  };
}

// ---------- New chart builders (best-effort in vega-lite) ----------

function buildRadar(state: BuilderState): Spec {
  const { style } = state;
  const axisF = f(state, "axis");
  const valF = f(state, "value");
  if (!axisF || !valF) return placeholder("radar", ["Axis", "Value"]);
  const colorF = f(state, "color");
  // Approximate radar: polar arc chart using axis as theta, value as radius.
  return withTitle(style, {
    layer: [
      {
        mark: { type: "arc", innerRadius: 0, stroke: style.background, strokeWidth: 1, opacity: 0.6 },
        encoding: {
          theta: { field: axisF, type: "nominal" },
          radius: { field: valF, type: "quantitative", scale: { type: "linear", zero: true } },
          color: colorF
            ? { field: colorF, type: "nominal" }
            : { value: style.markColor },
          tooltip: tooltipEncoding(state),
        },
      },
    ],
  });
}

function buildFunnel(state: BuilderState): Spec {
  const { style } = state;
  const stageF = f(state, "stage");
  const valF = f(state, "value");
  if (!stageF || !valF) return placeholder("funnel", ["Stage", "Value"]);
  return withTitle(style, {
    mark: { type: "bar", cornerRadius: style.cornerRadius },
    encoding: {
      y: {
        field: stageF,
        type: "nominal",
        sort: { field: valF, order: "descending" },
        axis: axisFor(style, "y", undefined, "nominal"),
      },
      x: { field: valF, type: "quantitative", axis: axisFor(style, "x") },
      color: { field: stageF, type: "nominal", legend: null },
      tooltip: tooltipEncoding(state),
    },
  });
}

function buildWaterfall(state: BuilderState): Spec {
  const { style } = state;
  const catF = f(state, "category");
  const valF = f(state, "value");
  if (!catF || !valF) return placeholder("waterfall", ["Step", "Delta"]);
  return withTitle(style, {
    transform: [
      { window: [{ op: "sum", field: valF, as: "__cum" }], frame: [null, 0] },
      { calculate: `datum.__cum - datum['${valF}']`, as: "__prev" },
      { calculate: `datum['${valF}'] >= 0 ? 'increase' : 'decrease'`, as: "__dir" },
    ],
    mark: { type: "bar", cornerRadius: style.cornerRadius },
    encoding: {
      x: { field: catF, type: "nominal", sort: null, axis: axisFor(style, "x", undefined, "nominal") },
      y: { field: "__prev", type: "quantitative", axis: axisFor(style, "y") },
      y2: { field: "__cum" },
      color: {
        field: "__dir",
        type: "nominal",
        scale: { domain: ["increase", "decrease"], range: ["#16a34a", "#ef4444"] },
      },
      tooltip: tooltipEncoding(state),
    },
  });
}

function buildTreemap(state: BuilderState): Spec {
  // Vega-Lite has no native treemap; approximate as horizontal bars grouped by color.
  const { style } = state;
  const catF = f(state, "category");
  const valF = f(state, "value");
  if (!catF || !valF) return placeholder("treemap", ["Category", "Value"]);
  const colorF = f(state, "color");
  return withTitle(style, {
    mark: { type: "bar", cornerRadius: style.cornerRadius, stroke: style.background, strokeWidth: 2 },
    encoding: {
      x: { field: valF, aggregate: "sum", type: "quantitative", stack: "normalize", axis: null },
      y: colorF ? { field: colorF, type: "nominal", axis: axisFor(style, "y", undefined, "nominal") } : { value: 0 },
      color: { field: catF, type: "nominal" },
      tooltip: tooltipEncoding(state),
    },
  });
}

function buildCalendar(state: BuilderState): Spec {
  const { style } = state;
  const dateF = f(state, "date");
  const valF = f(state, "value");
  if (!dateF || !valF) return placeholder("calendar", ["Date", "Value"]);
  return withTitle(style, {
    mark: { type: "rect", cornerRadius: 2, stroke: style.background, strokeWidth: 1 },
    encoding: {
      x: {
        field: dateF,
        timeUnit: "yearweek",
        type: "ordinal",
        axis: { title: null, format: "%b %d", labelAngle: 0 },
      },
      y: {
        field: dateF,
        timeUnit: "day",
        type: "ordinal",
        axis: { title: null, format: "%a" },
      },
      color: {
        field: valF,
        aggregate: "sum",
        type: "quantitative",
        scale: { range: [style.palette[0], style.palette[style.palette.length - 1]] },
      },
      tooltip: tooltipEncoding(state),
    },
  });
}

function buildBullet(state: BuilderState): Spec {
  const { style } = state;
  const catF = f(state, "category");
  const valF = f(state, "value");
  const tgtF = f(state, "target");
  if (!catF || !valF || !tgtF) return placeholder("bullet", ["Metric", "Actual", "Target"]);
  return withTitle(style, {
    layer: [
      {
        mark: { type: "bar", color: style.markColor, cornerRadius: style.cornerRadius, size: 18 },
        encoding: {
          y: { field: catF, type: "nominal", axis: axisFor(style, "y", undefined, "nominal") },
          x: { field: valF, type: "quantitative", axis: axisFor(style, "x") },
          tooltip: tooltipEncoding(state),
        },
      },
      {
        mark: { type: "tick", color: "#111827", size: 26, thickness: 3 },
        encoding: {
          y: { field: catF, type: "nominal" },
          x: { field: tgtF, type: "quantitative" },
        },
      },
    ],
  });
}

function buildCandlestick(state: BuilderState): Spec {
  const { style } = state;
  const dateF = f(state, "date");
  const openF = f(state, "open");
  const closeF = f(state, "close");
  const highF = f(state, "high");
  const lowF = f(state, "low");
  if (!dateF || !openF || !closeF || !highF || !lowF)
    return placeholder("candlestick", ["Date", "Open", "Close", "High", "Low"]);
  const colorEnc = {
    condition: { test: `datum['${openF}'] <= datum['${closeF}']`, value: "#16a34a" },
    value: "#ef4444",
  };
  return withTitle(style, {
    encoding: {
      x: { field: dateF, type: "temporal", axis: axisFor(style, "x", undefined, "temporal") },
      color: colorEnc,
    },
    layer: [
      {
        mark: { type: "rule" },
        encoding: {
          y: { field: lowF, type: "quantitative", axis: axisFor(style, "y") },
          y2: { field: highF },
        },
      },
      {
        mark: { type: "bar", size: 6 },
        encoding: {
          y: { field: openF, type: "quantitative" },
          y2: { field: closeF },
          tooltip: tooltipEncoding(state),
        },
      },
    ],
  });
}

function buildSankey(state: BuilderState): Spec {
  const { style } = state;
  const srcF = f(state, "source");
  const tgtF = f(state, "target");
  const valF = f(state, "value");
  if (!srcF || !tgtF || !valF) return placeholder("sankey", ["Source", "Target", "Value"]);
  // Native vega-lite has no sankey. Render side-by-side bar summary as fallback.
  return withTitle(style, {
    layer: [
      {
        mark: { type: "bar", cornerRadius: style.cornerRadius, opacity: 0.85 },
        encoding: {
          y: { field: srcF, type: "nominal", axis: { title: "Source" } },
          x: { field: valF, aggregate: "sum", type: "quantitative", axis: axisFor(style, "x") },
          color: { field: tgtF, type: "nominal", title: "Target" },
          tooltip: tooltipEncoding(state),
        },
      },
      {
        mark: { type: "text", fontSize: 10, color: style.textColor, dx: 4, align: "left" },
        encoding: {
          text: { value: "Sankey (simplified — flows aggregated)" },
          x: { datum: 0 },
          y: { datum: 0 },
        },
      },
    ],
  });
}

const BUILDERS: Record<ChartType, (s: BuilderState) => Spec> = {
  bar: buildBar,
  line: (s) => buildLineOrArea(s, false),
  area: (s) => buildLineOrArea(s, true),
  scatter: buildScatter,
  gantt: buildGantt,
  hierarchy: buildHierarchy,
  pie: (s) => buildPie(s, false),
  donut: (s) => buildPie(s, true),
  heatmap: buildHeatmap,
  histogram: buildHistogram,
  boxplot: buildBoxplot,
  radar: buildRadar,
  funnel: buildFunnel,
  waterfall: buildWaterfall,
  treemap: buildTreemap,
  calendar: buildCalendar,
  bullet: buildBullet,
  candlestick: buildCandlestick,
  sankey: buildSankey,
};

export interface BuildOptions {
  includeData?: boolean;
  fitContainer?: boolean;
  /** Override preview dataset (tabs mode). */
  previewDatasetId?: string;
}

// ---------- Transforms + Joins ----------

/** Apply dataset-level calculate transforms to produce a new dataset with computed columns. */
function applyTransforms(ds: Dataset): Dataset {
  const transforms = ds.transforms ?? [];
  if (transforms.length === 0) return ds;
  // Build new columns list
  const newCols: Column[] = [...ds.columns];
  for (const t of transforms) {
    if (!newCols.some((c) => c.name === t.name)) {
      newCols.push({ name: t.name, type: t.type ?? "number" });
    }
  }
  // Evaluate expressions row-wise via `Function`. Limit to `datum` scope.
  const rows = ds.rows.map((row) => {
    const next: Row = { ...row };
    for (const t of transforms) {
      try {
        const fn = new Function("datum", `return (${t.expression});`);
        const v = fn(next);
        next[t.name] = typeof v === "number" || typeof v === "string" ? v : v == null ? null : String(v);
      } catch {
        next[t.name] = null;
      }
    }
    return next;
  });
  return { ...ds, columns: newCols, rows };
}

/** Materialize a join: left-join right onto left by key, prefixing right columns. */
function materializeJoin(datasets: Dataset[], join: JoinConfig): Dataset | null {
  const left = datasets.find((d) => d.id === join.leftDatasetId);
  const right = datasets.find((d) => d.id === join.rightDatasetId);
  if (!left || !right) return null;
  const prefix = join.rightPrefix ?? `${right.name}_`;
  const rightIndex = new Map<string | number | null, Row>();
  for (const r of right.rows) rightIndex.set(r[join.rightKey], r);
  const columns: Column[] = [
    ...left.columns,
    ...right.columns
      .filter((c) => c.name !== join.rightKey)
      .map((c) => ({ ...c, name: `${prefix}${c.name}` })),
  ];
  const rows = left.rows.map((lr) => {
    const rr = rightIndex.get(lr[join.leftKey]);
    const merged: Row = { ...lr };
    if (rr) {
      for (const c of right.columns) {
        if (c.name === join.rightKey) continue;
        merged[`${prefix}${c.name}`] = rr[c.name];
      }
    } else {
      for (const c of right.columns) {
        if (c.name === join.rightKey) continue;
        merged[`${prefix}${c.name}`] = null;
      }
    }
    return merged;
  });
  return { id: join.id, name: join.name, columns, rows, transforms: [] };
}

/** Build the effective dataset pool including materialized joins + transforms applied. */
function effectiveDatasets(state: BuilderState): Dataset[] {
  const base = state.datasets.map(applyTransforms);
  const joined = (state.joins ?? [])
    .map((j) => materializeJoin(base, j))
    .filter((d): d is Dataset => !!d)
    .map(applyTransforms);
  return [...base, ...joined];
}

// ---------- Story layers ----------

function annotationLayers(anns: TextAnnotation[]): Spec[] {
  return anns.flatMap((a) => {
    const layers: Spec[] = [
      {
        mark: {
          type: "text",
          text: a.text,
          color: a.color,
          fontSize: a.fontSize,
          align: a.align,
          fontWeight: "bold",
        },
        encoding: {
          x: { datum: coerce(a.x) },
          y: { datum: coerce(a.y) },
        },
      },
    ];
    if (a.showArrow) {
      layers.push({
        mark: { type: "point", shape: "triangle-down", color: a.color, size: 60, filled: true },
        encoding: {
          x: { datum: coerce(a.x) },
          y: { datum: coerce(a.y) },
        },
      });
    }
    return layers;
  });
}
function rangeLayers(ranges: RangeHighlight[]): Spec[] {
  return ranges.flatMap((r) => {
    const enc: Spec = {};
    if (r.axis === "x") {
      enc.x = { datum: coerce(r.from) };
      enc.x2 = { datum: coerce(r.to) };
    } else {
      enc.y = { datum: coerce(r.from) };
      enc.y2 = { datum: coerce(r.to) };
    }
    const layers: Spec[] = [
      { mark: { type: "rect", color: r.color, opacity: r.opacity }, encoding: enc },
    ];
    if (r.label) {
      const labEnc: Spec = { ...enc };
      layers.push({
        mark: { type: "text", text: r.label, color: r.color, fontSize: 11, dx: 4, dy: -4, align: "left" },
        encoding: labEnc,
      });
    }
    return layers;
  });
}
function pinLayers(pins: Pin[]): Spec[] {
  return pins.flatMap((p) => [
    {
      mark: { type: "point", shape: "circle", color: p.color, size: 200, filled: true, opacity: 0.9, stroke: "#fff", strokeWidth: 2 },
      encoding: { x: { datum: coerce(p.x) }, y: { datum: coerce(p.y) } },
    },
    {
      mark: { type: "text", text: `${pins.indexOf(p) + 1}`, color: "#fff", fontSize: 10, fontWeight: "bold" },
      encoding: { x: { datum: coerce(p.x) }, y: { datum: coerce(p.y) } },
    },
  ]);
}
function coerce(v: string | number): string | number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return v !== "" && !Number.isNaN(n) ? n : v;
}

function wrapStory(state: BuilderState, inner: Spec): Spec {
  const { annotations, ranges, pins } = state.style;
  const extra = [...rangeLayers(ranges ?? []), ...annotationLayers(annotations ?? []), ...pinLayers(pins ?? [])];
  if (extra.length === 0) return inner;
  // If inner already has a layer, extend; otherwise wrap.
  if (Array.isArray(inner.layer)) {
    return { ...inner, layer: [...inner.layer, ...extra] };
  }
  const { data: _d, ...rest } = inner;
  void _d;
  return { ...(inner.data ? { data: inner.data } : {}), layer: [rest, ...extra] };
}

function withSubtitleAndFootnote(style: StyleState, spec: Spec): Spec {
  // Prepend subtitle with caption / append footnote via subtitle array.
  const subtitleParts: string[] = [];
  if (style.subtitle) subtitleParts.push(style.subtitle);
  if (style.caption) subtitleParts.push(style.caption);
  if (style.footnote) subtitleParts.push(style.footnote);
  if (style.sourceAttribution) subtitleParts.push(`Source: ${style.sourceAttribution}`);
  if (!style.title && subtitleParts.length === 0) return spec;
  const title: Spec = {
    text: style.title || " ",
    anchor: "start",
  };
  if (subtitleParts.length > 0) title.subtitle = subtitleParts;
  return { ...spec, title };
}

export function buildSpec(state: BuilderState, options: BuildOptions = { includeData: true }): Spec {
  const { style } = state;
  const fit = options.fitContainer;
  const includeData = options.includeData ?? true;

  // Resolve datasets (apply transforms + materialize joins) then pick which drive the chart.
  const pool = effectiveDatasets(state);
  const findDs = (id: string) => pool.find((d) => d.id === id);

  const layer = state.layerMode;
  let usedDatasets: Dataset[];
  let workingState = state;
  if (layer === "layered") {
    usedDatasets = pool.filter((d) => state.datasets.some((s) => s.id === d.id));
  } else if (layer === "tabs") {
    const previewId = options.previewDatasetId ?? state.activeDatasetId;
    const ds = findDs(previewId);
    usedDatasets = ds ? [ds] : [];
    workingState = { ...state, activeDatasetId: previewId, datasets: pool };
  } else {
    const ds = findDs(state.activeDatasetId);
    usedDatasets = ds ? [ds] : [];
    workingState = { ...state, datasets: pool };
  }

  const baseTop: Spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    ...(style.description ? { description: style.description } : {}),
    ...(fit
      ? { width: "container", height: "container" }
      : {
          width: style.responsive ? "container" : style.width,
          height: style.height,
        }),
    background: style.background,
    padding: style.padding,
    config: baseConfig(style),
  };

  const datasetsBlock: Record<string, Row[]> = {};
  for (const ds of usedDatasets) {
    datasetsBlock[ds.name] = includeData ? ds.rows : [];
  }

  if (layer === "layered" && usedDatasets.length > 1) {
    const layers = usedDatasets.map((ds) => {
      const inner = BUILDERS[state.chartType]({ ...workingState, activeDatasetId: ds.id });
      return { data: { name: ds.name }, ...stripTop(inner) };
    });
    const combined: Spec = { ...baseTop, datasets: datasetsBlock, layer: layers };
    return withSubtitleAndFootnote(style, wrapStory(state, combined));
  }

  const soleDs = usedDatasets[0];
  const inner = BUILDERS[state.chartType](workingState);
  const built: Spec = {
    ...baseTop,
    data: soleDs
      ? includeData
        ? { values: soleDs.rows, name: soleDs.name }
        : { name: soleDs.name }
      : { values: [] },
    ...inner,
  };
  return withSubtitleAndFootnote(style, wrapStory(state, built));
}

// Ensure DatasetTransform import isn't tree-shaken as unused.
export type _KeepTypes = DatasetTransform;

/** Remove top-level $schema/width/height/background/padding/config from a nested layer spec. */
function stripTop(spec: Spec): Spec {
  const {
    $schema: _s,
    width: _w,
    height: _h,
    background: _b,
    padding: _p,
    config: _c,
    ...rest
  } = spec;
  void _s;
  void _w;
  void _h;
  void _b;
  void _p;
  void _c;
  return rest;
}
