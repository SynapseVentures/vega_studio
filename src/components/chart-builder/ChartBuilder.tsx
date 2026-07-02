import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VegaEmbed } from "react-vega";
import type { Result as VegaEmbedResult } from "vega-embed";
import { Toaster, toast } from "sonner";
import type {
  BrandKit,
  BuilderState,
  ChartType,
  Column,
  Dataset,
  Encoding,
  LayerMode,
  Row,
  SavedPreset,
  StyleState,
  TextAnnotation,
  ThemePreset,
} from "@/lib/chart-builder/types";
import {
  ROLES,
  DEFAULT_ENCODING,
  SEED_COLUMNS,
  SAMPLE_ROWS,
  makeSeedDataset,
  emptyRowFor,
  newDatasetId,
  renameColumn,
  remapEncoding,
} from "@/lib/chart-builder/schemas";
import {
  DEFAULT_STYLE,
  PALETTES,
  SHAPE_OPTIONS,
  FONT_FAMILIES,
  THEME_PRESETS,
} from "@/lib/chart-builder/defaults";
import { buildSpec } from "@/lib/chart-builder/build-spec";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  Plus,
  Copy,
  Download,
  Sparkles,
  Undo2,
  Redo2,
  Link2,
  ExternalLink,
  Upload,
  FileJson,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Files,
  Save,
  Database,
  Palette,
  SlidersHorizontal,
  Settings2,
  Code2,
  ChevronDown,
  ChevronUp,
  Layers,
  Check,
} from "lucide-react";

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
  { value: "gantt", label: "Gantt" },
  { value: "hierarchy", label: "Hierarchy" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
  { value: "heatmap", label: "Heatmap" },
  { value: "histogram", label: "Histogram" },
  { value: "boxplot", label: "Boxplot" },
  { value: "radar", label: "Radar" },
  { value: "funnel", label: "Funnel" },
  { value: "waterfall", label: "Waterfall" },
  { value: "treemap", label: "Treemap" },
  { value: "calendar", label: "Calendar heatmap" },
  { value: "bullet", label: "Bullet" },
  { value: "candlestick", label: "Candlestick" },
  { value: "sankey", label: "Sankey" },
];

const HAS_XY_ROWS: ChartType[] = [
  "bar",
  "line",
  "area",
  "scatter",
  "histogram",
  "pie",
  "donut",
  "heatmap",
];

const PRESETS_KEY = "vega-builder-presets-v2";

function encodeStateToHash(state: BuilderState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}
function decodeStateFromHash(hash: string): BuilderState | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(hash)))) as BuilderState;
    if (parsed && parsed.chartType && parsed.style && Array.isArray(parsed.datasets)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function parseCsv(text: string): { columns: Column[]; rows: Row[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { columns: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Row = {};
    headers.forEach((h, i) => {
      const raw = cells[i] ?? "";
      const n = Number(raw);
      row[h] = raw !== "" && !Number.isNaN(n) ? n : raw;
    });
    return row;
  });
  const columns: Column[] = headers.map((h) => {
    const nums = rows.filter((r) => typeof r[h] === "number").length;
    return { name: h, type: nums > rows.length / 2 ? "number" : "string" };
  });
  return { columns, rows };
}

function initialState(): BuilderState {
  const ds = makeSeedDataset("bar", "data");
  return {
    chartType: "bar",
    datasets: [ds],
    joins: [],
    activeDatasetId: ds.id,
    layerMode: "single",
    encoding: { ...DEFAULT_ENCODING.bar },
    style: DEFAULT_STYLE,
    brandKits: [],
  };
}

export function ChartBuilder() {
  const [state, setState] = useState<BuilderState>(initialState);
  const { chartType, datasets, activeDatasetId, layerMode, encoding, style } = state;
  const [jsonOpen, setJsonOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("data");

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) ?? datasets[0],
    [datasets, activeDatasetId],
  );
  const activeColumns = activeDataset?.columns ?? [];

  // ---------- history ----------
  const historyRef = useRef<BuilderState[]>([]);
  const futureRef = useRef<BuilderState[]>([]);
  const suppressHistoryRef = useRef(false);
  const prevStateRef = useRef<BuilderState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.replace(/^#s=/, "");
    if (h) {
      const s = decodeStateFromHash(h);
      if (s) {
        suppressHistoryRef.current = true;
        setState(s);
        setTimeout(() => (suppressHistoryRef.current = false), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (suppressHistoryRef.current) {
      prevStateRef.current = state;
      return;
    }
    if (prevStateRef.current) {
      historyRef.current.push(prevStateRef.current);
      if (historyRef.current.length > 50) historyRef.current.shift();
      futureRef.current = [];
    }
    prevStateRef.current = state;
  }, [state]);

  const applyState = useCallback((s: BuilderState) => {
    suppressHistoryRef.current = true;
    setState(s);
    setTimeout(() => (suppressHistoryRef.current = false), 0);
  }, []);
  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(state);
    applyState(prev);
  }, [state, applyState]);
  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(state);
    applyState(next);
  }, [state, applyState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ---------- specs ----------
  const spec = useMemo(() => buildSpec(state, { includeData: true, fitContainer: true }), [state]);
  const exportSpec = useMemo(
    () => buildSpec(state, { includeData: false, fitContainer: false }),
    [state],
  );
  const specJson = useMemo(() => JSON.stringify(exportSpec, null, 2), [exportSpec]);

  const embedResultRef = useRef<VegaEmbedResult | null>(null);

  // ---------- mutations ----------
  const patch = (p: Partial<BuilderState>) => setState((s) => ({ ...s, ...p }));
  const patchStyle = (p: Partial<StyleState>) => setState((s) => ({ ...s, style: { ...s.style, ...p } }));
  const applyTheme = (t: ThemePreset) => patchStyle({ theme: t, ...THEME_PRESETS[t] });

  const changeChartType = (t: ChartType) => {
    // Reseed encoding for the new type, and if columns don't match, add a fresh dataset.
    setState((s) => {
      const enc: Encoding = { ...DEFAULT_ENCODING[t] };
      // Try to keep existing datasets; add a seed one for this type if none match.
      const hasCompat = s.datasets.some((d) =>
        Object.values(enc).every((col) => !col || d.columns.some((c) => c.name === col)),
      );
      if (hasCompat) return { ...s, chartType: t, encoding: enc };
      const ds = makeSeedDataset(t, "data");
      return {
        ...s,
        chartType: t,
        datasets: [...s.datasets, ds],
        activeDatasetId: ds.id,
        encoding: enc,
      };
    });
  };

  const updateEncoding = (role: string, colName: string) =>
    setState((s) => ({ ...s, encoding: { ...s.encoding, [role]: colName === "__none__" ? "" : colName } }));

  // Dataset ops
  const updateActiveDataset = (fn: (d: Dataset) => Dataset) =>
    setState((s) => ({
      ...s,
      datasets: s.datasets.map((d) => (d.id === s.activeDatasetId ? fn(d) : d)),
    }));

  const addDataset = () => {
    const ds = makeSeedDataset(chartType, `data_${datasets.length + 1}`);
    setState((s) => ({ ...s, datasets: [...s.datasets, ds], activeDatasetId: ds.id }));
  };
  const removeDataset = (id: string) => {
    if (datasets.length <= 1) return toast.error("Keep at least one dataset");
    setState((s) => {
      const next = s.datasets.filter((d) => d.id !== id);
      return {
        ...s,
        datasets: next,
        activeDatasetId: s.activeDatasetId === id ? next[0].id : s.activeDatasetId,
      };
    });
  };
  const renameDataset = (id: string, name: string) =>
    setState((s) => ({
      ...s,
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, name } : d)),
    }));
  const duplicateDataset = (id: string) => {
    const src = datasets.find((d) => d.id === id);
    if (!src) return;
    const copy: Dataset = {
      ...src,
      id: newDatasetId(),
      name: `${src.name}_copy`,
      columns: src.columns.map((c) => ({ ...c })),
      rows: src.rows.map((r) => ({ ...r })),
    };
    setState((s) => ({ ...s, datasets: [...s.datasets, copy], activeDatasetId: copy.id }));
  };

  // Columns
  const addColumn = () => {
    let idx = activeColumns.length + 1;
    while (activeColumns.some((c) => c.name === `col_${idx}`)) idx++;
    const name = `col_${idx}`;
    updateActiveDataset((d) => ({
      ...d,
      columns: [...d.columns, { name, type: "string" }],
      rows: d.rows.map((r) => ({ ...r, [name]: "" })),
    }));
  };
  const removeColumn = (name: string) => {
    updateActiveDataset((d) => ({
      ...d,
      columns: d.columns.filter((c) => c.name !== name),
      rows: d.rows.map((r) => {
        const next = { ...r };
        delete next[name];
        return next;
      }),
    }));
    setState((s) => ({ ...s, encoding: remapEncoding(s.encoding, name, "") }));
  };
  const renameColumnAt = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    if (activeColumns.some((c) => c.name === newName)) return toast.error("Column name already exists");
    setState((s) => ({
      ...s,
      datasets: s.datasets.map((d) =>
        d.id === s.activeDatasetId ? renameColumn(d, oldName, newName) : d,
      ),
      encoding: remapEncoding(s.encoding, oldName, newName),
    }));
  };
  const setColumnType = (name: string, type: Column["type"]) =>
    updateActiveDataset((d) => ({
      ...d,
      columns: d.columns.map((c) => (c.name === name ? { ...c, type } : c)),
    }));

  // Rows
  const addRow = () =>
    updateActiveDataset((d) => ({ ...d, rows: [...d.rows, emptyRowFor(d.columns)] }));
  const removeRow = (idx: number) =>
    updateActiveDataset((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== idx) }));
  const duplicateRow = (idx: number) =>
    updateActiveDataset((d) => ({
      ...d,
      rows: [...d.rows.slice(0, idx + 1), { ...d.rows[idx] }, ...d.rows.slice(idx + 1)],
    }));
  const moveRow = (idx: number, dir: -1 | 1) =>
    updateActiveDataset((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.rows.length) return d;
      const rows = [...d.rows];
      [rows[idx], rows[j]] = [rows[j], rows[idx]];
      return { ...d, rows };
    });
  const updateCell = (idx: number, colName: string, value: string) => {
    updateActiveDataset((d) => {
      const col = d.columns.find((c) => c.name === colName);
      const parsed = col?.type === "number" ? (value === "" ? null : Number(value)) : value;
      const rows = [...d.rows];
      rows[idx] = { ...rows[idx], [colName]: parsed };
      return { ...d, rows };
    });
  };
  const loadSample = () => {
    updateActiveDataset((d) => ({
      ...d,
      columns: SEED_COLUMNS[chartType].map((c) => ({ ...c })),
      rows: SAMPLE_ROWS[chartType].map((r) => ({ ...r })),
    }));
    setState((s) => ({ ...s, encoding: { ...DEFAULT_ENCODING[chartType] } }));
  };

  // ---------- transforms ----------
  const addTransform = () =>
    updateActiveDataset((d) => ({
      ...d,
      transforms: [
        ...(d.transforms ?? []),
        {
          id: crypto.randomUUID(),
          name: `calc_${(d.transforms?.length ?? 0) + 1}`,
          expression: "datum.value * 1",
          type: "number",
        },
      ],
    }));
  const updateTransform = (id: string, patch: Partial<{ name: string; expression: string; type: Column["type"] }>) =>
    updateActiveDataset((d) => ({
      ...d,
      transforms: (d.transforms ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  const removeTransform = (id: string) =>
    updateActiveDataset((d) => ({
      ...d,
      transforms: (d.transforms ?? []).filter((t) => t.id !== id),
    }));

  // ---------- joins ----------
  const addJoin = () => {
    if (datasets.length < 2) return toast.error("Need at least 2 datasets to join");
    const [a, b] = datasets;
    setState((s) => ({
      ...s,
      joins: [
        ...(s.joins ?? []),
        {
          id: crypto.randomUUID(),
          name: `${a.name}_x_${b.name}`,
          leftDatasetId: a.id,
          rightDatasetId: b.id,
          leftKey: a.columns[0]?.name ?? "",
          rightKey: b.columns[0]?.name ?? "",
          rightPrefix: `${b.name}_`,
        },
      ],
    }));
  };
  const updateJoin = (id: string, patch: Partial<BuilderState["joins"][number]>) =>
    setState((s) => ({
      ...s,
      joins: (s.joins ?? []).map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
  const removeJoin = (id: string) =>
    setState((s) => ({ ...s, joins: (s.joins ?? []).filter((j) => j.id !== id) }));

  // ---------- story helpers ----------
  const addAnnotation = () =>
    patchStyle({
      annotations: [
        ...style.annotations,
        {
          id: crypto.randomUUID(),
          x: 0,
          y: 0,
          text: "Note",
          color: "#111827",
          fontSize: 12,
          align: "left",
          showArrow: false,
        },
      ],
    });
  const updateAnnotation = (id: string, patch: Partial<StyleState["annotations"][number]>) =>
    patchStyle({ annotations: style.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const removeAnnotation = (id: string) =>
    patchStyle({ annotations: style.annotations.filter((a) => a.id !== id) });

  const addRange = () =>
    patchStyle({
      ranges: [
        ...style.ranges,
        { id: crypto.randomUUID(), axis: "x", from: 0, to: 1, color: "#fbbf24", opacity: 0.2, label: "" },
      ],
    });
  const updateRange = (id: string, patch: Partial<StyleState["ranges"][number]>) =>
    patchStyle({ ranges: style.ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRange = (id: string) =>
    patchStyle({ ranges: style.ranges.filter((r) => r.id !== id) });

  const addPin = () =>
    patchStyle({
      pins: [
        ...style.pins,
        {
          id: crypto.randomUUID(),
          x: 0,
          y: 0,
          text: "",
          author: "Me",
          createdAt: Date.now(),
          color: "#dc2626",
          resolved: false,
        },
      ],
    });
  const updatePin = (id: string, patch: Partial<StyleState["pins"][number]>) =>
    patchStyle({ pins: style.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePin = (id: string) =>
    patchStyle({ pins: style.pins.filter((p) => p.id !== id) });

  // ---------- brand kits ----------
  const saveBrandKit = () => {
    const name = prompt("Brand kit name?");
    if (!name) return;
    const kit: BrandKit = {
      id: crypto.randomUUID(),
      name,
      palette: style.palette,
      fontFamily: style.fontFamily,
      primaryColor: style.markColor,
      textColor: style.textColor,
      background: style.background,
    };
    setState((s) => ({ ...s, brandKits: [...s.brandKits, kit], style: { ...s.style, activeBrandKitId: kit.id } }));
    toast.success(`Saved brand kit "${name}"`);
  };
  const applyBrandKit = (id: string) => {
    const kit = state.brandKits.find((k) => k.id === id);
    if (!kit) return;
    patchStyle({
      palette: kit.palette,
      fontFamily: kit.fontFamily,
      markColor: kit.primaryColor,
      textColor: kit.textColor,
      background: kit.background,
      activeBrandKitId: kit.id,
    });
  };
  const removeBrandKit = (id: string) =>
    setState((s) => ({ ...s, brandKits: s.brandKits.filter((k) => k.id !== id) }));

  // ---------- export ----------
  const copyJson = async () => {
    await navigator.clipboard.writeText(specJson);
    toast.success("Spec JSON copied");
  };
  const downloadJson = () => {
    const blob = new Blob([specJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vega-lite-${chartType}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadData = () => {
    const payload = datasets.reduce<Record<string, Row[]>>((acc, d) => {
      acc[d.name] = d.rows;
      return acc;
    }, {});
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-${chartType}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportImage = async (format: "png" | "svg") => {
    const r = embedResultRef.current;
    if (!r) return toast.error("Chart not ready");
    try {
      const url = await r.view.toImageURL(format);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${chartType}.${format}`;
      a.click();
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const copyShareUrl = async () => {
    const hash = encodeStateToHash(state);
    const url = `${window.location.origin}${window.location.pathname}#s=${hash}`;
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", `#s=${hash}`);
    toast.success("Shareable URL copied");
  };
  const openInVegaEditor = () => {
    const encoded = encodeURIComponent(JSON.stringify({ mode: "vega-lite", spec }));
    window.open(`https://vega.github.io/editor/#/url/vega-lite/${btoa(encoded)}`, "_blank");
  };

  // ---------- import ----------
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const doImport = () => {
    try {
      let cols: Column[];
      let rows: Row[];
      if (importFormat === "json") {
        const parsed = JSON.parse(importText);
        if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects");
        rows = parsed as Row[];
        const names = new Set<string>();
        rows.forEach((r) => Object.keys(r).forEach((k) => names.add(k)));
        cols = [...names].map<Column>((n) => {
          const nums = rows.filter((r) => typeof r[n] === "number").length;
          return { name: n, type: nums > rows.length / 2 ? "number" : "string" };
        });
      } else {
        ({ columns: cols, rows } = parseCsv(importText));
      }
      if (rows.length === 0) throw new Error("No rows parsed");
      updateActiveDataset((d) => ({ ...d, columns: cols, rows }));
      setImportOpen(false);
      setImportText("");
      toast.success(`Imported ${rows.length} rows into "${activeDataset.name}"`);
    } catch (e) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ---------- presets ----------
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  const persistPresets = (next: SavedPreset[]) => {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  };
  const savePreset = () => {
    const name = prompt("Preset name?");
    if (!name) return;
    persistPresets([
      { id: crypto.randomUUID(), name, createdAt: Date.now(), state },
      ...presets,
    ]);
    toast.success("Preset saved");
  };
  const loadPreset = (p: SavedPreset) => {
    applyState(p.state);
    toast.success(`Loaded "${p.name}"`);
  };
  const deletePreset = (id: string) => persistPresets(presets.filter((p) => p.id !== id));

  const roles = ROLES[chartType];
  const showXY = HAS_XY_ROWS.includes(chartType);
  const stringColumns = activeColumns.filter((c) => c.type === "string");
  const totalRows = datasets.reduce((n, d) => n + d.rows.length, 0);

  return (
    <div className="relative min-h-screen bg-zinc-100 font-sans">
      <Toaster position="top-right" richColors />

      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-900 text-white shadow-sm">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" strokeLinecap="round" />
                <path d="M7 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Vega-Lite Builder
              </p>
              <Input
                value={style.title}
                placeholder={`Untitled ${chartType} chart`}
                onChange={(e) => patchStyle({ title: e.target.value })}
                className="h-7 border-transparent bg-transparent px-0 text-sm font-semibold text-zinc-900 shadow-none focus-visible:border-zinc-200 focus-visible:bg-white focus-visible:ring-0"
              />
            </div>

          </div>
          <div className="flex items-center gap-1.5">
            <Select value={chartType} onValueChange={(v) => changeChartType(v as ChartType)}>
              <SelectTrigger className="h-9 w-[130px] rounded-full border-zinc-200 bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToolIcon onClick={undo} title="Undo (⌘Z)">
              <Undo2 className="h-4 w-4" />
            </ToolIcon>
            <ToolIcon onClick={redo} title="Redo (⌘⇧Z)">
              <Redo2 className="h-4 w-4" />
            </ToolIcon>
            <ToolIcon onClick={copyShareUrl} title="Copy share URL">
              <Link2 className="h-4 w-4" />
            </ToolIcon>
            <ToolIcon onClick={openInVegaEditor} title="Open in Vega editor">
              <ExternalLink className="h-4 w-4" />
            </ToolIcon>
            <ToolIcon onClick={() => exportImage("png")} title="Export PNG">
              <ImageIcon className="h-4 w-4" />
            </ToolIcon>
            <Button
              size="sm"
              onClick={() => setJsonOpen(true)}
              className="h-9 rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Code2 className="mr-1.5 h-3.5 w-3.5" /> JSON
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1600px] flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 lg:h-[calc(100vh-72px)] lg:flex-row lg:pt-2">
        {/* CHART CANVAS */}
        <section className="flex h-full flex-[2] flex-col">
          <div
            className="flex h-full min-h-[420px] flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10 lg:min-h-0"
            style={{ backgroundColor: style.background }}
          >
            {layerMode === "tabs" && datasets.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1">
                {datasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => patch({ activeDatasetId: d.id })}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      activeDatasetId === d.id
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              <ChartRenderer
                spec={spec}
                onResult={(r) => {
                  embedResultRef.current = r;
                }}
              />
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
              <span>{datasets.length} dataset{datasets.length !== 1 && "s"}</span>
              <span>•</span>
              <span>{totalRows} rows</span>
              <span>•</span>
              <span>{chartType}</span>
              <span>•</span>
              <span>{layerMode} mode</span>
            </div>
          </div>
        </section>

        {/* SETTINGS PANEL */}
        <aside className="rounded-3xl border border-white/60 bg-white/75 shadow-2xl backdrop-blur-xl lg:flex-1"
          style={{ backdropFilter: "blur(24px) saturate(140%)" }}
        >
          <Tabs value={inspectorTab} onValueChange={setInspectorTab} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 grid grid-cols-4 rounded-2xl bg-zinc-100/80 p-1">
              <TabTrig value="data" icon={<Database className="h-4 w-4" />} label="Data" />
              <TabTrig value="style" icon={<Palette className="h-4 w-4" />} label="Style" />
              <TabTrig value="marks" icon={<SlidersHorizontal className="h-4 w-4" />} label="Marks" />
              <TabTrig value="advanced" icon={<Settings2 className="h-4 w-4" />} label="More" />
            </TabsList>

            <ScrollArea className="h-[340px] flex-1 lg:h-auto">
              <div className="p-4">
                {/* ========== DATA TAB ========== */}
                <TabsContent value="data" className="mt-0 space-y-4">
                  {/* Datasets manager */}
                  <Section title="Datasets" icon={<Layers className="h-3 w-3" />}>
                    <div className="flex items-center gap-2">
                      <Select value={activeDatasetId} onValueChange={(v) => patch({ activeDatasetId: v })}>
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {datasets.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} <span className="text-zinc-400">({d.rows.length})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <MiniBtn onClick={addDataset} title="Add dataset">
                        <Plus className="h-3 w-3" />
                      </MiniBtn>
                      <MiniBtn onClick={() => duplicateDataset(activeDatasetId)} title="Duplicate">
                        <Files className="h-3 w-3" />
                      </MiniBtn>
                      <MiniBtn onClick={() => removeDataset(activeDatasetId)} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </MiniBtn>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        Dataset id / name (used in JSON)
                      </Label>
                      <Input
                        className="h-8 font-mono text-xs"
                        value={activeDataset?.name ?? ""}
                        onChange={(e) => renameDataset(activeDatasetId, e.target.value)}
                        placeholder="e.g. sales_q1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        Layer mode
                      </Label>
                      <div className="mt-1.5 grid grid-cols-3 gap-1">
                        {(["single", "layered", "tabs"] as LayerMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => patch({ layerMode: m })}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold capitalize transition ${
                              layerMode === m
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-200 bg-white text-zinc-500"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-400">
                        {layerMode === "single" && "One dataset drives the chart."}
                        {layerMode === "layered" && "All datasets stacked as layers in a single spec."}
                        {layerMode === "tabs" && "Each dataset previews independently; JSON reflects the active tab."}
                      </p>
                    </div>
                  </Section>

                  {/* Columns editor */}
                  <Section title="Columns">
                    <div className="space-y-1.5">
                      {activeColumns.map((c) => (
                        <div key={c.name} className="grid grid-cols-[1fr_84px_auto] items-center gap-1.5">
                          <Input
                            className="h-7 font-mono text-xs"
                            defaultValue={c.name}
                            onBlur={(e) => renameColumnAt(c.name, e.target.value.trim())}
                          />
                          <Select value={c.type} onValueChange={(v) => setColumnType(c.name, v as Column["type"])}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="date">date</SelectItem>
                            </SelectContent>
                          </Select>
                          <MiniBtn onClick={() => removeColumn(c.name)} title="Delete column">
                            <Trash2 className="h-3 w-3" />
                          </MiniBtn>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addColumn} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add column
                    </Button>
                  </Section>

                  {/* Transforms */}
                  <Section title="Computed columns" defaultOpen={false}>
                    <p className="text-[10px] text-zinc-500">
                      Expressions run per row. Use <code className="rounded bg-zinc-100 px-1">datum.colName</code>.
                    </p>
                    <div className="space-y-2">
                      {(activeDataset?.transforms ?? []).map((t) => (
                        <div key={t.id} className="space-y-1.5 rounded-2xl border border-zinc-100 bg-white/70 p-2.5">
                          <div className="grid grid-cols-[1fr_84px_auto] gap-1.5">
                            <Input
                              className="h-7 font-mono text-xs"
                              value={t.name}
                              onChange={(e) => updateTransform(t.id, { name: e.target.value })}
                            />
                            <Select value={t.type} onValueChange={(v) => updateTransform(t.id, { type: v as Column["type"] })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">string</SelectItem>
                                <SelectItem value="number">number</SelectItem>
                                <SelectItem value="date">date</SelectItem>
                              </SelectContent>
                            </Select>
                            <MiniBtn onClick={() => removeTransform(t.id)} title="Remove">
                              <Trash2 className="h-3 w-3" />
                            </MiniBtn>
                          </div>
                          <Input
                            className="h-7 font-mono text-xs"
                            placeholder="datum.value * 1.2"
                            value={t.expression}
                            onChange={(e) => updateTransform(t.id, { expression: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addTransform} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add computed column
                    </Button>
                  </Section>

                  {/* Joins */}
                  <Section title="Joins" defaultOpen={false}>
                    <p className="text-[10px] text-zinc-500">
                      Merge two datasets on a key. Result is available as a virtual dataset.
                    </p>
                    <div className="space-y-2">
                      {(state.joins ?? []).map((j) => (
                        <div key={j.id} className="space-y-1.5 rounded-2xl border border-zinc-100 bg-white/70 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              className="h-7 flex-1 font-mono text-xs"
                              value={j.name}
                              onChange={(e) => updateJoin(j.id, { name: e.target.value })}
                            />
                            <MiniBtn onClick={() => removeJoin(j.id)} title="Remove">
                              <Trash2 className="h-3 w-3" />
                            </MiniBtn>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Select value={j.leftDatasetId} onValueChange={(v) => updateJoin(j.id, { leftDatasetId: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {datasets.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <Select value={j.rightDatasetId} onValueChange={(v) => updateJoin(j.id, { rightDatasetId: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {datasets.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input className="h-7 font-mono text-xs" placeholder="left key" value={j.leftKey} onChange={(e) => updateJoin(j.id, { leftKey: e.target.value })} />
                            <Input className="h-7 font-mono text-xs" placeholder="right key" value={j.rightKey} onChange={(e) => updateJoin(j.id, { rightKey: e.target.value })} />
                          </div>
                          <Input className="h-7 font-mono text-xs" placeholder="right prefix (optional)" value={j.rightPrefix ?? ""} onChange={(e) => updateJoin(j.id, { rightPrefix: e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addJoin} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add join
                    </Button>
                  </Section>

                  {/* Encoding role mapping */}
                  <Section title="Encoding (role → column)">
                    {roles.map((r) => (
                      <div key={r.id} className="grid grid-cols-[1fr_1fr] items-center gap-2">
                        <Label className="text-xs text-zinc-600">
                          {r.label}
                          {r.required && <span className="text-rose-400"> *</span>}
                        </Label>
                        <Select
                          value={encoding[r.id] || "__none__"}
                          onValueChange={(v) => updateEncoding(r.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {!r.required && <SelectItem value="__none__">(none)</SelectItem>}
                            {activeColumns.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.name}{" "}
                                <span className="text-zinc-400">({c.type})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </Section>

                  {/* Rows */}
                  <Section title={`Rows (${activeDataset?.rows.length ?? 0})`}>
                    <div className="mb-2 flex gap-1">
                      <MiniBtn onClick={loadSample} title="Reset to sample data">
                        <Sparkles className="h-3 w-3" />
                      </MiniBtn>
                      <MiniBtn onClick={() => setImportOpen(true)} title="Import CSV/JSON">
                        <Upload className="h-3 w-3" />
                      </MiniBtn>
                      <MiniBtn onClick={downloadData} title="Export data">
                        <FileJson className="h-3 w-3" />
                      </MiniBtn>
                      <MiniBtn onClick={addRow} title="Add row">
                        <Plus className="h-3 w-3" />
                      </MiniBtn>
                    </div>
                    <div className="space-y-2">
                      {activeDataset?.rows.map((row, idx) => (
                        <div key={idx} className="rounded-2xl border border-zinc-100 bg-white/70 p-2.5 shadow-sm">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                              Row {idx + 1}
                            </span>
                            <div className="flex gap-0.5">
                              <MiniBtn onClick={() => moveRow(idx, -1)} title="Up">
                                <ArrowUp className="h-3 w-3" />
                              </MiniBtn>
                              <MiniBtn onClick={() => moveRow(idx, 1)} title="Down">
                                <ArrowDown className="h-3 w-3" />
                              </MiniBtn>
                              <MiniBtn onClick={() => duplicateRow(idx)} title="Duplicate">
                                <Files className="h-3 w-3" />
                              </MiniBtn>
                              <MiniBtn onClick={() => removeRow(idx)} title="Delete">
                                <Trash2 className="h-3 w-3" />
                              </MiniBtn>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {activeColumns.map((c) => (
                              <div key={c.name} className="grid grid-cols-[80px_1fr] items-center gap-2">
                                <Label className="truncate font-mono text-[10px] text-zinc-600">
                                  {c.name}
                                </Label>
                                <Input
                                  className="h-7 rounded-lg border-zinc-200 bg-white text-xs"
                                  type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                                  value={(row[c.name] ?? "") as string | number}
                                  onChange={(e) => updateCell(idx, c.name, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="Presets library" defaultOpen={false}>
                    <Button size="sm" variant="outline" onClick={savePreset} className="w-full rounded-xl">
                      <Save className="mr-1.5 h-3 w-3" /> Save current
                    </Button>
                    {presets.length === 0 ? (
                      <p className="text-xs text-zinc-400">No presets saved yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {presets.map((p) => (
                          <div key={p.id} className="flex items-center gap-1">
                            <button
                              onClick={() => loadPreset(p)}
                              className="flex-1 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-zinc-100"
                            >
                              {p.name}{" "}
                              <span className="text-zinc-400">({p.state.chartType})</span>
                            </button>
                            <MiniBtn onClick={() => deletePreset(p.id)} title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </MiniBtn>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                </TabsContent>

                {/* ========== STYLE TAB ========== */}
                <TabsContent value="style" className="mt-0 space-y-4">
                  <Section title="Theme">
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => applyTheme(t)}
                          className={`rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition ${
                            style.theme === t
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Colors">
                    <ColorRow label="Mark" value={style.markColor} onChange={(v) => patchStyle({ markColor: v })} />
                    <ColorRow label="Background" value={style.background} onChange={(v) => patchStyle({ background: v })} />
                    <ColorRow label="Text" value={style.textColor} onChange={(v) => patchStyle({ textColor: v })} />
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        Palette
                      </Label>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {PALETTES.map((p) => (
                          <button
                            key={p.name}
                            onClick={() => patchStyle({ palette: p.colors })}
                            className="h-7 overflow-hidden rounded-lg border border-zinc-200"
                            title={p.name}
                          >
                            <div className="flex h-full">
                              {p.colors.slice(0, 4).map((c) => (
                                <div key={c} className="flex-1" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-6 gap-1">
                        {style.palette.map((c, i) => (
                          <input
                            key={i}
                            type="color"
                            value={c}
                            onChange={(e) => {
                              const next = [...style.palette];
                              next[i] = e.target.value;
                              patchStyle({ palette: next });
                            }}
                            className="h-6 w-full cursor-pointer rounded border border-zinc-200"
                          />
                        ))}
                      </div>
                    </div>
                  </Section>

                  <Section title="Brand kits" defaultOpen={false}>
                    <p className="text-[10px] text-zinc-500">
                      Save the current palette, font, colors, and background as a reusable kit.
                    </p>
                    <Button size="sm" variant="outline" onClick={saveBrandKit} className="w-full rounded-xl">
                      <Save className="mr-1.5 h-3 w-3" /> Save current as brand kit
                    </Button>
                    {state.brandKits.length === 0 ? (
                      <p className="text-xs text-zinc-400">No kits saved.</p>
                    ) : (
                      <div className="space-y-1">
                        {state.brandKits.map((k) => (
                          <div key={k.id} className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 ${style.activeBrandKitId === k.id ? "border-zinc-900 bg-zinc-900/5" : "border-zinc-200"}`}>
                            <div className="flex flex-1 items-center gap-2">
                              <div className="flex h-4 overflow-hidden rounded" style={{ width: 48 }}>
                                {k.palette.slice(0, 4).map((c, i) => (
                                  <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                                ))}
                              </div>
                              <button onClick={() => applyBrandKit(k.id)} className="flex-1 text-left text-xs font-medium">
                                {k.name}
                              </button>
                            </div>
                            <MiniBtn onClick={() => removeBrandKit(k.id)} title="Delete kit">
                              <Trash2 className="h-3 w-3" />
                            </MiniBtn>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>


                  <Section title="Size & spacing" defaultOpen={false}>
                    <ToggleRow label="Responsive width" right={<Switch checked={style.responsive} onCheckedChange={(v) => patchStyle({ responsive: v })} />} />
                    {!style.responsive && (
                      <SliderRow label="Width" value={style.width} min={240} max={900} step={10} onChange={(v) => patchStyle({ width: v })} />
                    )}
                    <SliderRow label="Height" value={style.height} min={180} max={700} step={10} onChange={(v) => patchStyle({ height: v })} />
                    <SliderRow label="Padding" value={style.padding} min={0} max={60} step={2} onChange={(v) => patchStyle({ padding: v })} />
                    {(chartType === "bar" || chartType === "gantt" || chartType === "hierarchy" || chartType === "boxplot" || chartType === "heatmap") && (
                      <SliderRow label="Bar spacing" value={Math.round(style.bandPadding * 100)} min={0} max={80} step={5} onChange={(v) => patchStyle({ bandPadding: v / 100 })} />
                    )}
                    {chartType === "donut" && (
                      <SliderRow label="Inner radius" value={style.innerRadius} min={10} max={140} step={5} onChange={(v) => patchStyle({ innerRadius: v })} />
                    )}
                    <SliderRow label="Axis pad" value={style.axisLabelPadding} min={0} max={30} step={1} onChange={(v) => patchStyle({ axisLabelPadding: v })} />
                  </Section>

                  <Section title="Typography" defaultOpen={false}>
                    <div className="space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input className="h-7 text-xs" value={style.title} placeholder="Chart title" onChange={(e) => patchStyle({ title: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Subtitle</Label>
                      <Input className="h-7 text-xs" value={style.subtitle} placeholder="Optional subtitle" onChange={(e) => patchStyle({ subtitle: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">X axis</Label>
                        <Input className="h-7 text-xs" value={style.xAxisTitle} onChange={(e) => patchStyle({ xAxisTitle: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Y axis</Label>
                        <Input className="h-7 text-xs" value={style.yAxisTitle} onChange={(e) => patchStyle({ yAxisTitle: e.target.value })} />
                      </div>
                    </div>
                    <ToggleRow label="Font" right={
                      <Select value={style.fontFamily} onValueChange={(v) => patchStyle({ fontFamily: v })}>
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    } />
                    <ToggleRow label="Title weight" right={
                      <Select value={style.titleFontWeight} onValueChange={(v) => patchStyle({ titleFontWeight: v as StyleState["titleFontWeight"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <SliderRow label="Title size" value={style.titleFontSize} min={10} max={32} step={1} onChange={(v) => patchStyle({ titleFontSize: v })} />
                    <SliderRow label="Label size" value={style.labelFontSize} min={8} max={20} step={1} onChange={(v) => patchStyle({ labelFontSize: v })} />
                    <SliderRow label="Label angle" value={style.labelAngle} min={-90} max={90} step={5} onChange={(v) => patchStyle({ labelAngle: v })} />
                  </Section>
                </TabsContent>

                {/* ========== MARKS TAB ========== */}
                <TabsContent value="marks" className="mt-0 space-y-4">
                  <Section title="Marks">
                    {chartType === "bar" && (
                      <ToggleRow label="Orientation" right={
                        <Select value={style.barOrientation} onValueChange={(v) => patchStyle({ barOrientation: v as StyleState["barOrientation"] })}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vertical">Vertical</SelectItem>
                            <SelectItem value="horizontal">Horizontal</SelectItem>
                          </SelectContent>
                        </Select>
                      } />
                    )}
                    {(chartType === "scatter" || chartType === "line" || chartType === "area" || chartType === "gantt") && (
                      <ToggleRow label="Point shape" right={
                        <Select value={style.pointShape} onValueChange={(v) => patchStyle({ pointShape: v as StyleState["pointShape"] })}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SHAPE_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      } />
                    )}
                    <SliderRow label="Opacity" value={Math.round(style.opacity * 100)} min={10} max={100} step={5} onChange={(v) => patchStyle({ opacity: v / 100 })} />
                    <SliderRow label="Stroke" value={style.strokeWidth} min={0} max={8} step={1} onChange={(v) => patchStyle({ strokeWidth: v })} />
                    {(chartType === "bar" || chartType === "gantt" || chartType === "hierarchy" || chartType === "histogram" || chartType === "heatmap") && (
                      <SliderRow label="Corner" value={style.cornerRadius} min={0} max={20} step={1} onChange={(v) => patchStyle({ cornerRadius: v })} />
                    )}
                    {(chartType === "line" || chartType === "area") && (
                      <>
                        <ToggleRow label="Interpolation" right={
                          <Select value={style.lineInterpolation} onValueChange={(v) => patchStyle({ lineInterpolation: v as StyleState["lineInterpolation"] })}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="linear">Linear</SelectItem>
                              <SelectItem value="monotone">Monotone</SelectItem>
                              <SelectItem value="step">Step</SelectItem>
                            </SelectContent>
                          </Select>
                        } />
                        <ToggleRow label="Show points" right={<Switch checked={style.showPointsOnLine} onCheckedChange={(v) => patchStyle({ showPointsOnLine: v })} />} />
                        {chartType === "line" && (
                          <ToggleRow label="Area fill" right={<Switch checked={style.areaFill} onCheckedChange={(v) => patchStyle({ areaFill: v })} />} />
                        )}
                      </>
                    )}
                    {chartType === "gantt" && (
                      <>
                        <ToggleRow label="Milestones" right={<Switch checked={style.showMilestones} onCheckedChange={(v) => patchStyle({ showMilestones: v })} />} />
                        <ToggleRow label="Milestone labels" right={<Switch checked={style.showMilestoneLabels} onCheckedChange={(v) => patchStyle({ showMilestoneLabels: v })} />} />
                      </>
                    )}
                  </Section>

                  <Section title="Grouping & sorting">
                    {(chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "histogram") && (
                      <ToggleRow label="Group mode" right={
                        <Select value={style.groupMode} onValueChange={(v) => patchStyle({ groupMode: v as StyleState["groupMode"] })}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grouped">Grouped</SelectItem>
                            <SelectItem value="stacked">Stacked</SelectItem>
                            <SelectItem value="normalized">100%</SelectItem>
                          </SelectContent>
                        </Select>
                      } />
                    )}
                    <ToggleRow label="Sort" right={
                      <Select value={style.sortOrder} onValueChange={(v) => patchStyle({ sortOrder: v as StyleState["sortOrder"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <ToggleRow label="Legend" right={
                      <Select value={style.legendPosition} onValueChange={(v) => patchStyle({ legendPosition: v as StyleState["legendPosition"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="none">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <ToggleRow label="Value labels" right={<Switch checked={style.showValueLabels} onCheckedChange={(v) => patchStyle({ showValueLabels: v })} />} />
                  </Section>

                  <Section title="Label formatting" defaultOpen={false}>
                    <ColorRow label="Color" value={style.dataLabelColor} onChange={(v) => patchStyle({ dataLabelColor: v })} />
                    <SliderRow label="Font size" value={style.dataLabelFontSize} min={8} max={24} step={1} onChange={(v) => patchStyle({ dataLabelFontSize: v })} />
                    <ToggleRow label="Weight" right={
                      <Select value={style.dataLabelFontWeight} onValueChange={(v) => patchStyle({ dataLabelFontWeight: v as StyleState["dataLabelFontWeight"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="bold">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <ToggleRow label="Align" right={
                      <Select value={style.dataLabelAlign} onValueChange={(v) => patchStyle({ dataLabelAlign: v as StyleState["dataLabelAlign"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <ToggleRow label="Baseline" right={
                      <Select value={style.dataLabelBaseline} onValueChange={(v) => patchStyle({ dataLabelBaseline: v as StyleState["dataLabelBaseline"] })}>
                        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="middle">Middle</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    } />
                    <SliderRow label="Padding X" value={style.dataLabelPaddingX} min={-40} max={40} step={1} onChange={(v) => patchStyle({ dataLabelPaddingX: v })} />
                    <SliderRow label="Padding Y" value={style.dataLabelPaddingY} min={-40} max={40} step={1} onChange={(v) => patchStyle({ dataLabelPaddingY: v })} />
                  </Section>
                </TabsContent>

                {/* ========== ADVANCED TAB ========== */}
                <TabsContent value="advanced" className="mt-0 space-y-4">
                  <Section title="Interaction">
                    <ToggleRow label="Tooltip" right={<Switch checked={style.tooltipEnabled} onCheckedChange={(v) => patchStyle({ tooltipEnabled: v })} />} />
                    <ToggleRow label="Highlight on hover" right={<Switch checked={style.highlightOnHover} onCheckedChange={(v) => patchStyle({ highlightOnHover: v })} />} />
                    <ToggleRow label="Zoom & pan" right={<Switch checked={style.zoomPan} onCheckedChange={(v) => patchStyle({ zoomPan: v })} />} />
                    <ToggleRow label="Legend click" right={<Switch checked={style.legendSelect} onCheckedChange={(v) => patchStyle({ legendSelect: v })} />} />
                    {style.tooltipEnabled && (
                      <div>
                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                          Tooltip columns
                        </Label>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {activeColumns.map((c) => {
                            const active = style.tooltipFields.length === 0 || style.tooltipFields.includes(c.name);
                            return (
                              <button
                                key={c.name}
                                onClick={() => {
                                  const current = style.tooltipFields.length === 0
                                    ? activeColumns.map((x) => x.name)
                                    : style.tooltipFields;
                                  const next = current.includes(c.name)
                                    ? current.filter((x) => x !== c.name)
                                    : [...current, c.name];
                                  patchStyle({ tooltipFields: next });
                                }}
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition ${
                                  active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-500"
                                }`}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Section>

                  {(chartType === "line" || chartType === "area" || chartType === "scatter") && (
                    <Section title="Trendline">
                      <ToggleRow label="Type" right={
                        <Select value={style.trendline} onValueChange={(v) => patchStyle({ trendline: v as StyleState["trendline"] })}>
                          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="linear">Linear regression</SelectItem>
                            <SelectItem value="moving-average">Moving average</SelectItem>
                          </SelectContent>
                        </Select>
                      } />
                      {style.trendline === "moving-average" && (
                        <SliderRow label="Window" value={style.movingAverageWindow} min={2} max={20} step={1} onChange={(v) => patchStyle({ movingAverageWindow: v })} />
                      )}
                    </Section>
                  )}

                  {showXY && chartType !== "pie" && chartType !== "donut" && chartType !== "heatmap" && (
                    <Section title="Reference line" defaultOpen={false}>
                      <ToggleRow label="Enabled" right={<Switch checked={style.refLineEnabled} onCheckedChange={(v) => patchStyle({ refLineEnabled: v })} />} />
                      {style.refLineEnabled && (
                        <>
                          <ToggleRow label="Axis" right={
                            <Select value={style.refLineAxis} onValueChange={(v) => patchStyle({ refLineAxis: v as "x" | "y" })}>
                              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="x">X</SelectItem>
                                <SelectItem value="y">Y</SelectItem>
                              </SelectContent>
                            </Select>
                          } />
                          <div className="space-y-1">
                            <Label className="text-xs">Value</Label>
                            <Input type="number" className="h-7 text-xs" value={style.refLineValue} onChange={(e) => patchStyle({ refLineValue: Number(e.target.value) })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Label</Label>
                            <Input className="h-7 text-xs" value={style.refLineLabel} onChange={(e) => patchStyle({ refLineLabel: e.target.value })} />
                          </div>
                          <ColorRow label="Color" value={style.refLineColor} onChange={(v) => patchStyle({ refLineColor: v })} />
                        </>
                      )}
                    </Section>
                  )}

                  <Section title="Axes & format" defaultOpen={false}>
                    <ToggleRow label="Grid X" right={<Switch checked={style.showGridX} onCheckedChange={(v) => patchStyle({ showGridX: v })} />} />
                    <ToggleRow label="Grid Y" right={<Switch checked={style.showGridY} onCheckedChange={(v) => patchStyle({ showGridY: v })} />} />
                    <div className="space-y-1">
                      <Label className="text-xs">Number format (d3)</Label>
                      <Input className="h-7 font-mono text-xs" placeholder=",.2f  or  $.2s" value={style.numberFormat} onChange={(e) => patchStyle({ numberFormat: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date format (d3-time)</Label>
                      <Input className="h-7 font-mono text-xs" placeholder="%b %d" value={style.dateFormat} onChange={(e) => patchStyle({ dateFormat: e.target.value })} />
                    </div>
                  </Section>

                  {(chartType === "bar" || chartType === "line" || chartType === "area" || chartType === "scatter") && stringColumns.length > 0 && (
                    <Section title="Facet" defaultOpen={false}>
                      <ToggleRow label="Facet by" right={
                        <Select value={style.facetField || "none"} onValueChange={(v) => patchStyle({ facetField: v })}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {stringColumns.map((c) => (
                              <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      } />
                      {style.facetField && style.facetField !== "none" && (
                        <SliderRow label="Columns" value={style.facetColumns} min={1} max={6} step={1} onChange={(v) => patchStyle({ facetColumns: v })} />
                      )}
                    </Section>
                  )}

                  <Section title="Accessibility" defaultOpen={false}>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea rows={3} className="text-xs" placeholder="Screen-reader description" value={style.description} onChange={(e) => patchStyle({ description: e.target.value })} />
                    </div>
                  </Section>

                  <Section title="Captions & source" defaultOpen={false}>
                    <div className="space-y-1">
                      <Label className="text-xs">Caption</Label>
                      <Input className="h-7 text-xs" value={style.caption} onChange={(e) => patchStyle({ caption: e.target.value })} placeholder="Shown below the chart" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Footnote</Label>
                      <Input className="h-7 text-xs" value={style.footnote} onChange={(e) => patchStyle({ footnote: e.target.value })} placeholder="Small text at the bottom" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Source</Label>
                      <Input className="h-7 text-xs" value={style.sourceAttribution} onChange={(e) => patchStyle({ sourceAttribution: e.target.value })} placeholder="Source: …" />
                    </div>
                  </Section>

                  <Section title={`Annotations (${style.annotations.length})`} defaultOpen={false}>
                    <div className="space-y-2">
                      {style.annotations.map((a) => (
                        <div key={a.id} className="space-y-1.5 rounded-2xl border border-zinc-100 bg-white/70 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input className="h-7 flex-1 text-xs" placeholder="Note text" value={a.text} onChange={(e) => updateAnnotation(a.id, { text: e.target.value })} />
                            <MiniBtn onClick={() => removeAnnotation(a.id)} title="Remove"><Trash2 className="h-3 w-3" /></MiniBtn>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input className="h-7 font-mono text-xs" placeholder="x" value={String(a.x)} onChange={(e) => updateAnnotation(a.id, { x: e.target.value })} />
                            <Input className="h-7 font-mono text-xs" placeholder="y" value={String(a.y)} onChange={(e) => updateAnnotation(a.id, { y: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5">
                            <Select value={a.align} onValueChange={(v) => updateAnnotation(a.id, { align: v as TextAnnotation["align"] })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input type="number" className="h-7 text-xs" value={a.fontSize} onChange={(e) => updateAnnotation(a.id, { fontSize: Number(e.target.value) })} />
                            <input type="color" value={a.color} onChange={(e) => updateAnnotation(a.id, { color: e.target.value })} className="h-7 w-8 cursor-pointer rounded border border-zinc-200" />
                          </div>
                          <ToggleRow label="Arrow" right={<Switch checked={a.showArrow} onCheckedChange={(v) => updateAnnotation(a.id, { showArrow: v })} />} />
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addAnnotation} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add annotation
                    </Button>
                  </Section>

                  <Section title={`Range highlights (${style.ranges.length})`} defaultOpen={false}>
                    <div className="space-y-2">
                      {style.ranges.map((r) => (
                        <div key={r.id} className="space-y-1.5 rounded-2xl border border-zinc-100 bg-white/70 p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Input className="h-7 flex-1 text-xs" placeholder="Label (optional)" value={r.label} onChange={(e) => updateRange(r.id, { label: e.target.value })} />
                            <MiniBtn onClick={() => removeRange(r.id)} title="Remove"><Trash2 className="h-3 w-3" /></MiniBtn>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <Select value={r.axis} onValueChange={(v) => updateRange(r.id, { axis: v as "x" | "y" })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="x">X</SelectItem>
                                <SelectItem value="y">Y</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input className="h-7 font-mono text-xs" placeholder="from" value={String(r.from)} onChange={(e) => updateRange(r.id, { from: e.target.value })} />
                            <Input className="h-7 font-mono text-xs" placeholder="to" value={String(r.to)} onChange={(e) => updateRange(r.id, { to: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-[auto_1fr] items-center gap-1.5">
                            <input type="color" value={r.color} onChange={(e) => updateRange(r.id, { color: e.target.value })} className="h-7 w-8 cursor-pointer rounded border border-zinc-200" />
                            <SliderRow label="Opacity" value={Math.round(r.opacity * 100)} min={0} max={100} step={5} onChange={(v) => updateRange(r.id, { opacity: v / 100 })} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addRange} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add range highlight
                    </Button>
                  </Section>

                  <Section title={`Comments & pins (${style.pins.length})`} defaultOpen={false}>
                    <div className="space-y-2">
                      {style.pins.map((p) => (
                        <div key={p.id} className={`space-y-1.5 rounded-2xl border p-2.5 ${p.resolved ? "border-emerald-200 bg-emerald-50/40" : "border-zinc-100 bg-white/70"}`}>
                          <div className="flex items-center gap-1.5">
                            <input type="color" value={p.color} onChange={(e) => updatePin(p.id, { color: e.target.value })} className="h-7 w-8 cursor-pointer rounded border border-zinc-200" />
                            <Input className="h-7 flex-1 text-xs" placeholder="Author" value={p.author} onChange={(e) => updatePin(p.id, { author: e.target.value })} />
                            <MiniBtn onClick={() => updatePin(p.id, { resolved: !p.resolved })} title={p.resolved ? "Reopen" : "Resolve"}>
                              <Check className="h-3 w-3" />
                            </MiniBtn>
                            <MiniBtn onClick={() => removePin(p.id)} title="Remove"><Trash2 className="h-3 w-3" /></MiniBtn>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input className="h-7 font-mono text-xs" placeholder="x" value={String(p.x)} onChange={(e) => updatePin(p.id, { x: e.target.value })} />
                            <Input className="h-7 font-mono text-xs" placeholder="y" value={String(p.y)} onChange={(e) => updatePin(p.id, { y: e.target.value })} />
                          </div>
                          <Textarea rows={2} className="text-xs" placeholder="Comment…" value={p.text} onChange={(e) => updatePin(p.id, { text: e.target.value })} />
                          <p className="text-[10px] text-zinc-400">{new Date(p.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={addPin} className="w-full rounded-xl">
                      <Plus className="mr-1 h-3 w-3" /> Add pin
                    </Button>
                  </Section>


                  <Section title="Export & share" defaultOpen>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => exportImage("png")} className="rounded-xl">
                        <ImageIcon className="mr-1.5 h-3 w-3" /> PNG
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => exportImage("svg")} className="rounded-xl">
                        <ImageIcon className="mr-1.5 h-3 w-3" /> SVG
                      </Button>
                      <Button size="sm" variant="outline" onClick={copyShareUrl} className="rounded-xl">
                        <Link2 className="mr-1.5 h-3 w-3" /> Share URL
                      </Button>
                      <Button size="sm" variant="outline" onClick={openInVegaEditor} className="rounded-xl">
                        <ExternalLink className="mr-1.5 h-3 w-3" /> Editor
                      </Button>
                    </div>
                  </Section>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </aside>
      </main>

      {/* JSON DRAWER */}
      <Sheet open={jsonOpen} onOpenChange={setJsonOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Vega-Lite JSON</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={copyJson}>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={downloadJson}>
                  <Download className="mr-1 h-3 w-3" /> Download
                </Button>
              </div>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-120px)] rounded-2xl border border-zinc-200 bg-zinc-50">
            <pre className="whitespace-pre p-3 font-mono text-xs leading-relaxed">{specJson}</pre>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* IMPORT DIALOG */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data into "{activeDataset?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant={importFormat === "json" ? "default" : "outline"} onClick={() => setImportFormat("json")}>JSON</Button>
              <Button size="sm" variant={importFormat === "csv" ? "default" : "outline"} onClick={() => setImportFormat("csv")}>CSV</Button>
            </div>
            <Textarea
              rows={12}
              className="font-mono text-xs"
              placeholder={importFormat === "json" ? '[\n  {"month": "Jan", "revenue": 100}\n]' : "month,revenue\nJan,100"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Columns are inferred from headers/keys. Then map them via the Encoding section.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={doImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartRenderer({ spec, onResult }: { spec: any; onResult?: (r: VegaEmbedResult) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="h-full w-full">
      <VegaEmbed
        spec={spec}
        style={{ width: "100%", height: "100%" }}
        options={{ actions: false }}
        onError={(e) => setError(e instanceof Error ? e.message : String(e))}
        onEmbed={(result) => {
          setError(null);
          if (result && onResult) onResult(result as VegaEmbedResult);
        }}
      />
      {error && (
        <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          Chart error: {error}
        </div>
      )}
    </div>
  );
}

function TabTrig({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm [&_svg]:h-3.5 [&_svg]:w-3.5"
    >
      {icon}
      <span>{label}</span>
    </TabsTrigger>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white/70 shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-700">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
      </button>
      {open && <div className="space-y-2.5 border-t border-zinc-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-zinc-600">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border border-zinc-200" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-20 font-mono text-xs" />
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-600">{label}</Label>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ToggleRow({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-zinc-600">{label}</Label>
      {right}
    </div>
  );
}

function ToolIcon({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900">
      {children}
    </button>
  );
}

function MiniBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
      {children}
    </button>
  );
}
