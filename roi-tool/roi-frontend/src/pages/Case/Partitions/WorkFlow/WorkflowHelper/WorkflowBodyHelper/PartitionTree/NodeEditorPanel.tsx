import React, { useEffect } from "react";
import { NoColorsIcon } from "@/components/icons";
import { Information, Close, Undo } from "@carbon/icons-react";

import type {
  TreeNodeKind,
  PartitionTreeNodeData,
  NodeCustomizations,
  ExternalNodeData,
  ExternalNodeShape,
  ExternalNodeCustomizations,
} from "./Node";
import { SHAPE_DEFAULTS } from "./Node";
import { TREE_DEFAULTS, getPartitionDefaultsForNodeType, getPartitionNodeDimensions } from "./treeDefaults";
import { useTreeDefaults } from "./TreeDefaultsContext";

import colorConfig from "./colors.json";
import { BAIN_COLORS } from "./constants";
import { CollapsibleSection } from "./components/section";
import { ColorPalette, TextAlignLeft, Grid } from "@carbon/icons-react";

type EditorTab = "style" | "text" | "layout";
type PanelVariant = "sections" | "tabs";

const TAB_SECTIONS: Record<EditorTab, string[]> = {
  style: ["colors", "border", "shadow", "opacity"],
  text: ["label", "typography", "alignment"],
  layout: ["badges", "padding", "transform", "dimensions"],
};

function TabCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </div>
      {children}
    </div>
  );
}

import { ColorField } from "./components/color-field";
import { SwatchSection } from "./components/swatch-section";
import { DimensionField, NumericField } from "./components/dimension-field";

const ROTATION_PRESETS = [0, 90, 180, 270] as const;

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  onClear,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onClear?: () => void;
}) {
  const resolved = value ?? min;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-600 font-medium">{label}</span>
        <span className="text-[11px] font-mono text-gray-500">
          {resolved}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={resolved}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-gray-700 cursor-pointer bg-gray-200 rounded-full"
      />
    </div>
  );
}

type Props = {
  mode: TreeNodeKind;
  nodeIds: string[];
  nodeData: PartitionTreeNodeData | ExternalNodeData | null;
  overrides: Partial<NodeCustomizations> | Partial<ExternalNodeCustomizations>;
  dimensions?: { width: number; height: number };
  canCustomizeBadges?: boolean;
  onClose: () => void;
  onUpdate: (nodeIds: string[], overrides: Partial<NodeCustomizations> | Partial<ExternalNodeCustomizations>) => void;
  onUpdateDimensions?: (nodeIds: string[], width: number, height: number) => void;
  onReset: (nodeIds: string[]) => void;
  onDelete?: (nodeIds: string[]) => void;
  brandColors?: { hex: string; name: string }[];
  variant?: PanelVariant;
};

export function NodeEditorPanel({
  mode,
  nodeIds,
  nodeData,
  overrides,
  dimensions,
  canCustomizeBadges = true,
  onClose,
  onUpdate,
  onUpdateDimensions,
  onReset,
  onDelete,
  brandColors,
  variant = "sections",
}: Props) {
  const { layout: treeLayout } = useTreeDefaults();
  const [openSections, setOpenSections] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState<EditorTab>("style");
  const [badgeEditor, setBadgeEditor] = React.useState<"client" | "sku">("sku");
  const isTabs = variant === "tabs";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setOpenSections(["colors"]);
    setActiveTab("style");
  }, [mode, nodeIds.join(",")]);

  if (nodeIds.length === 0) return null;

  const isMulti = nodeIds.length > 1;
  const hasOverrides = Object.keys(overrides).length > 0;

  const setPartition = <K extends keyof NodeCustomizations>(field: K, value: NodeCustomizations[K] | undefined) => {
    onUpdate(nodeIds, { [field]: value } as Partial<NodeCustomizations>);
  };

  const setExternal = <K extends keyof ExternalNodeCustomizations>(field: K, value: ExternalNodeCustomizations[K] | undefined) => {
    onUpdate(nodeIds, { [field]: value } as Partial<ExternalNodeCustomizations>);
  };

  const pData = mode === "partition-tree" ? (nodeData as PartitionTreeNodeData | null) : null;
  const eData = mode === "external" ? (nodeData as ExternalNodeData | null) : null;
  const pOverrides = mode === "partition-tree" ? (overrides as Partial<NodeCustomizations>) : {};
  const eOverrides = mode === "external" ? (overrides as Partial<ExternalNodeCustomizations>) : {};

  const currentRotation = eOverrides.rotation ?? eData?.rotation ?? 0;
  const normalizedRotation = ((Math.round(currentRotation) % 360) + 360) % 360;
  const currentShape = (eOverrides.shape ?? eData?.shape ?? "box") as ExternalNodeShape;
  const currentExternalFill =
    eOverrides.customBackground ??
    eData?.customBackground ??
    (currentShape === "callout" ? "#6A9DD3" : "#C8102E");
  const currentExternalText =
    eOverrides.customColor ??
    eData?.customColor ??
    (currentShape === "label" || currentShape === "callout" ? "#333333" : "#ffffff");
  const currentTextAlign = eOverrides.textAlign ?? eData?.textAlign ?? "center";
  const calloutHasNoFill = currentShape === "callout" && currentExternalFill === "transparent";

  const textForBg = (hex: string) => {
    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) return "#ffffff";
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  const partitionDefaultColors = (() => {
    const nodeType = pData?.nodeType;
    if (nodeType === "root") return { fill: colorConfig.nodes.root.background, text: "#ffffff" };
    if (nodeType === "attribute") {
      return { fill: colorConfig.nodes.attribute.background, text: colorConfig.nodes.attribute.text };
    }
    if (nodeType === "value") {
      const palette = colorConfig.nodes.value.palette;
      const level = pData?.level ?? 0;
      const isClickable = pData?.isClickable ?? true;
      const idx = (level - 1) % palette.length;
      const fill = isClickable ? palette[Math.max(0, idx)] : colorConfig.nodes.value.disabled;
      return { fill, text: textForBg(fill) };
    }
    return { fill: colorConfig.nodes.root.background, text: "#ffffff" };
  })();
  const currentPartitionFill =
    pOverrides.customBackground ??
    pData?.customBackground ??
    partitionDefaultColors.fill;
  const currentPartitionText =
    pOverrides.customColor ??
    pData?.customColor ??
    partitionDefaultColors.text;
  const shapeDims = SHAPE_DEFAULTS[currentShape] ?? SHAPE_DEFAULTS.box;
  const currentWidth = dimensions?.width ?? shapeDims.width;
  const currentHeight = dimensions?.height ?? shapeDims.height;
  const partitionNodeType = pData?.nodeType ?? "value";
  const partitionStyleDefaults = getPartitionDefaultsForNodeType(partitionNodeType);
  const partitionLayoutDefaults = getPartitionNodeDimensions(
    partitionNodeType,
    treeLayout,
  );
  const currentPartitionWidth = dimensions?.width ?? pOverrides.width ?? partitionLayoutDefaults.width;
  const currentPartitionHeight = dimensions?.height ?? pOverrides.height ?? partitionLayoutDefaults.height;
  const currentPartitionTextAlign = pOverrides.customTextAlign ?? pData?.customTextAlign ?? "center";
  const currentPartitionVerticalAlign =
    pOverrides.customVerticalAlign ?? pData?.customVerticalAlign ?? "center";

  const sectionOpen = (key: string) => openSections.includes(key);
  const onSectionToggle = (key: string, nextOpen: boolean) => {
    setOpenSections((prev) => {
      if (!nextOpen) return prev.filter((k) => k !== key);
      return [key];
    });
  };

  const currentBorderStyle =
    mode === "partition-tree"
      ? (pOverrides.customBorderStyle ?? "solid")
      : (eOverrides.borderStyle ?? "solid");

  const showSection = (sectionId: string) => {
    if (!isTabs) return true;
    return TAB_SECTIONS[activeTab].includes(sectionId);
  };

  const SectionShell = ({
    sectionId,
    title,
    children,
  }: {
    sectionId: string;
    title: string;
    children: React.ReactNode;
  }) => {
    if (!showSection(sectionId)) return null;
    if (isTabs) {
      return <TabCard title={title}>{children}</TabCard>;
    }
    return (
      <CollapsibleSection
        title={title}
        open={sectionOpen(sectionId)}
        onOpenChange={(v) => onSectionToggle(sectionId, v)}
      >
        {children}
      </CollapsibleSection>
    );
  };

  const editorTabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    { id: "style", label: "Style", icon: <ColorPalette size={14} /> },
    { id: "text", label: "Text", icon: <TextAlignLeft size={14} /> },
    { id: "layout", label: "Layout", icon: <Grid size={14} /> },
  ];

  return (
    <div
      className={`flex flex-col bg-white ${
        isTabs ? "h-full min-h-0" : "border-t border-gray-200"
      }`}
    >
      <header
        className={`flex shrink-0 items-center justify-between border-b px-4 h-10 ${
          isTabs ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
        }`}
      >
        <span className="text-[12px] font-semibold text-gray-700">
          {isMulti ? `Edit ${nodeIds.length} Nodes` : mode === "external" ? "Edit External Node" : "Edit Node"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          aria-label="Close panel"
        >
          <Close size={16} />
        </button>
      </header>

      {isTabs && (
        <div
          className="mx-3 mb-2 flex shrink-0 gap-0.5 rounded-lg bg-gray-100 p-0.5"
          role="tablist"
          aria-label="Editor sections"
        >
          {editorTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-[#dc2626]/30"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`overflow-y-auto px-3 py-3 space-y-2 ${
          isTabs ? "flex-1 min-h-0" : ""
        }`}
      >
        {isMulti && (
          <div className="text-[11px] text-yellow-900 bg-yellow-50 border border-yellow-200 rounded px-2.5 py-2 flex items-center gap-2">
            <Information size={14} className="shrink-0 text-yellow-600" />
            <span>Changes apply to <strong>all {nodeIds.length}</strong> selected nodes.</span>
          </div>
        )}

        {mode === "partition-tree" && !isMulti && pData && (
          <SectionShell sectionId="label" title="Label">
            <div className="relative">
              <input
                type="text"
                value={pOverrides.customLabel ?? pData.nodeName}
                onChange={(e) => setPartition("customLabel", e.target.value)}
                placeholder={pData.nodeName}
                className="w-full pl-3 pr-14 py-1.5 text-[12px] rounded border border-gray-200 bg-gray-50/60 focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-200 outline-none transition-colors"
              />
              {pOverrides.customLabel != null && (
                <button
                  type="button"
                  onClick={() => setPartition("customLabel", undefined)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 px-1.5 rounded text-[10px] text-gray-500 hover:text-red-500 transition-colors"
                  title="Reset label"
                  aria-label="Reset label"
                >
                  <Undo size={12} />
                </button>
              )}
            </div>
          </SectionShell>
        )}

        {mode === "external" && currentShape !== "callout" && (!isMulti || currentShape === "label") && (
          <SectionShell sectionId="label" title={currentShape === "label" ? "Text" : "Label"}>
            <div className="relative">
              <input
                type="text"
                value={eOverrides.customLabel ?? eData?.label ?? ""}
                onChange={(e) => setExternal("customLabel", e.target.value)}
                placeholder={currentShape === "label" ? "Label text" : "Node label"}
                className="w-full pl-3 pr-14 py-1.5 text-[12px] rounded border border-gray-200 bg-gray-50/60 focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-200 outline-none transition-colors"
              />
              {eOverrides.customLabel != null && (
                <button
                  type="button"
                  onClick={() => setExternal("customLabel", undefined)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 px-1.5 rounded text-[10px] text-gray-500 hover:text-red-500 transition-colors"
                  title="Reset label"
                  aria-label="Reset label"
                >
                  <Undo size={12} />
                </button>
              )}
            </div>
          </SectionShell>
        )}

        <SectionShell sectionId="colors" title="Colors">
          {(mode === "partition-tree" || currentShape !== "label") && (
            <>
              <ColorField
                label="Fill"
                value={
                  mode === "partition-tree"
                    ? currentPartitionFill
                    : calloutHasNoFill
                      ? undefined
                      : currentExternalFill
                }
                fallback={mode === "partition-tree" ? partitionDefaultColors.fill : currentShape === "callout" ? "#6A9DD3" : "#C8102E"}
                onChange={(hex) => mode === "partition-tree" ? setPartition("customBackground", hex) : setExternal("customBackground", hex)}
                onClear={() => mode === "partition-tree" ? setPartition("customBackground", undefined) : setExternal("customBackground", undefined)}
                action={
                  mode === "external" && currentShape === "callout" ? (
                    <button
                      type="button"
                      onClick={() => setExternal("customBackground", calloutHasNoFill ? "#6A9DD3" : "transparent")}
                      className={`h-8 shrink-0 rounded border px-2 text-[11px] font-medium transition-colors ${
                        calloutHasNoFill
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                      aria-pressed={calloutHasNoFill}
                    >
                      No fill
                    </button>
                  ) : undefined
                }
              />
            </>
          )}
          <ColorField
            label={mode === "external" && currentShape === "label" ? "Text color" : "Text"}
            value={mode === "partition-tree" ? currentPartitionText : currentExternalText}
            fallback={
              mode === "partition-tree"
                ? partitionDefaultColors.text
                : mode === "external" && (currentShape === "label" || currentShape === "callout")
                  ? "#333333"
                  : "#ffffff"
            }
            onChange={(hex) => mode === "partition-tree" ? setPartition("customColor", hex) : setExternal("customColor", hex)}
            onClear={() => mode === "partition-tree" ? setPartition("customColor", undefined) : setExternal("customColor", undefined)}
          />
          <SwatchSection
            title="Bain Colors"
            colors={BAIN_COLORS}
            size={isTabs ? "lg" : "sm"}
            activeFill={mode === "external" && currentShape === "label" ? undefined : mode === "partition-tree" ? currentPartitionFill : currentExternalFill}
            activeText={mode === "partition-tree" ? currentPartitionText : currentExternalText}
            onSetFill={(hex) => mode === "partition-tree" ? setPartition("customBackground", hex) : setExternal("customBackground", hex)}
            onSetText={(hex) => mode === "partition-tree" ? setPartition("customColor", hex) : setExternal("customColor", hex)}
            textOnly={mode === "external" && currentShape === "label"}
          />
          {brandColors && brandColors.length > 0 ? (
            <SwatchSection
              title="Brand Colors"
              colors={brandColors}
              size={isTabs ? "lg" : "sm"}
              activeFill={mode === "external" && currentShape === "label" ? undefined : mode === "partition-tree" ? currentPartitionFill : currentExternalFill}
              activeText={mode === "partition-tree" ? currentPartitionText : currentExternalText}
              onSetFill={(hex) => mode === "partition-tree" ? setPartition("customBackground", hex) : setExternal("customBackground", hex)}
              onSetText={(hex) => mode === "partition-tree" ? setPartition("customColor", hex) : setExternal("customColor", hex)}
              textOnly={mode === "external" && currentShape === "label"}
            />
          ) : (
            <div className="flex items-center gap-2 py-2 px-2 rounded bg-gray-50 border border-gray-100">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <NoColorsIcon />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium">No brand colours</p>
                <p className="text-[10px] text-gray-400">Add colours in case settings</p>
              </div>
            </div>
          )}
        </SectionShell>

        {mode === "partition-tree" && (
          <SectionShell sectionId="alignment" title="Alignment">
            <span className="text-[10px] text-gray-500 font-medium block mb-1">Horizontal</span>
            <div className="grid grid-cols-3 gap-1 mb-3">
              {(["left", "center", "right"] as const).map((align) => {
                const active = currentPartitionTextAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setPartition("customTextAlign", align)}
                    className={`h-7 rounded border text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    aria-pressed={active}
                  >
                    {align}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-gray-500 font-medium block mb-1">Vertical</span>
            <div className="grid grid-cols-3 gap-1">
              {(["top", "center", "bottom"] as const).map((align) => {
                const active = currentPartitionVerticalAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setPartition("customVerticalAlign", align)}
                    className={`h-7 rounded border text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    aria-pressed={active}
                  >
                    {align}
                  </button>
                );
              })}
            </div>
          </SectionShell>
        )}

        {mode === "external" && currentShape === "callout" && (
          <SectionShell sectionId="alignment" title="Alignment">
            <div className="grid grid-cols-3 gap-1">
              {(["left", "center", "right"] as const).map((align) => {
                const active = currentTextAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setExternal("textAlign", align)}
                    className={`h-7 rounded border text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    aria-pressed={active}
                  >
                    {align}
                  </button>
                );
              })}
            </div>
          </SectionShell>
        )}

        <SectionShell sectionId="typography" title="Typography">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NumericField
                label="Font size"
                value={mode === "partition-tree" ? pOverrides.customFontSize : eOverrides.fontSize}
                fallback={
                  mode === "partition-tree"
                    ? partitionStyleDefaults.fontSize
                    : TREE_DEFAULTS.external.fontSize
                }
                unit="px"
                min={1}
                onChange={(v) =>
                  mode === "partition-tree"
                    ? setPartition("customFontSize", v)
                    : setExternal("fontSize", v)
                }
              />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-medium block mb-1">Font weight</span>
              {mode === "partition-tree" ? (
                <select
                  value={pOverrides.customFontWeight != null ? String(pOverrides.customFontWeight) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return setPartition("customFontWeight", undefined);
                    setPartition("customFontWeight", /^\d+$/.test(v) ? Number(v) : v);
                  }}
                  className="w-full px-2 py-1.5 text-[11px] rounded border border-gray-200 bg-gray-50/60 focus:bg-white focus:border-gray-300 outline-none transition-colors"
                >
                  <option value="">Default</option>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extrabold</option>
                </select>
              ) : (
                <select
                  value={String(eOverrides.fontWeight ?? eData?.fontWeight ?? 500)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExternal("fontWeight", /^\d+$/.test(v) ? parseInt(v, 10) : v);
                  }}
                  className="w-full px-2 py-1.5 text-[11px] rounded border border-gray-200 bg-gray-50/60 focus:bg-white focus:border-gray-300 outline-none transition-colors"
                >
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extrabold</option>
                </select>
              )}
            </div>
          </div>
        </SectionShell>

        {mode === "partition-tree" && canCustomizeBadges && (
          <SectionShell sectionId="badges" title="Badges">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex gap-4">
                {[
                  { id: "client", label: "Client SKU" },
                  { id: "sku", label: "SKU Count" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setBadgeEditor(btn.id as "client" | "sku")}
                    className={`text-[11px] font-medium pb-1 transition-colors ${
                      badgeEditor === btn.id
                        ? "text-gray-900 border-b-2 border-gray-900"
                        : "text-gray-400 border-b-2 border-transparent hover:text-gray-600"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
                title="Reset this badge type"
                onClick={() => {
                  if (badgeEditor === "client") {
                    setPartition("customBadgeScale", undefined);
                    setPartition("customClientBadgeScale", undefined);
                    setPartition("customClientBadgeOffsetX", undefined);
                    setPartition("customClientBadgeOffsetY", undefined);
                    return;
                  }
                  setPartition("customBadgeScale", undefined);
                  setPartition("customSkuBadgeScale", undefined);
                  setPartition("customSkuBadgeOffsetX", undefined);
                  setPartition("customSkuBadgeOffsetY", undefined);
                }}
              >
                Reset
              </button>
            </div>

            {badgeEditor === "client" ? (
              <div className="space-y-3">
                <SliderField
                  label="Size"
                  value={
                    pOverrides.customClientBadgeScale != null
                      ? Math.round(pOverrides.customClientBadgeScale * 100)
                      : pOverrides.customBadgeScale != null
                        ? Math.round(pOverrides.customBadgeScale * 100)
                        : 100
                  }
                  min={50}
                  max={300}
                  unit="%"
                  onChange={(v) => {
                    setPartition("customBadgeScale", undefined);
                    setPartition("customClientBadgeScale", v === 100 ? undefined : v / 100);
                  }}
                />
                <SliderField
                  label="Offset X"
                  value={pOverrides.customClientBadgeOffsetX ?? 0}
                  min={-40}
                  max={40}
                  unit="px"
                  onChange={(v) => setPartition("customClientBadgeOffsetX", v === 0 ? undefined : v)}
                />
                <SliderField
                  label="Offset Y"
                  value={pOverrides.customClientBadgeOffsetY ?? 0}
                  min={-40}
                  max={40}
                  unit="px"
                  onChange={(v) => setPartition("customClientBadgeOffsetY", v === 0 ? undefined : v)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <SliderField
                  label="Size"
                  value={
                    pOverrides.customSkuBadgeScale != null
                      ? Math.round(pOverrides.customSkuBadgeScale * 100)
                      : pOverrides.customBadgeScale != null
                        ? Math.round(pOverrides.customBadgeScale * 100)
                        : 100
                  }
                  min={50}
                  max={300}
                  unit="%"
                  onChange={(v) => {
                    setPartition("customBadgeScale", undefined);
                    setPartition("customSkuBadgeScale", v === 100 ? undefined : v / 100);
                  }}
                />
                <SliderField
                  label="Offset X"
                  value={pOverrides.customSkuBadgeOffsetX ?? 0}
                  min={-40}
                  max={40}
                  unit="px"
                  onChange={(v) => setPartition("customSkuBadgeOffsetX", v === 0 ? undefined : v)}
                />
                <SliderField
                  label="Offset Y"
                  value={pOverrides.customSkuBadgeOffsetY ?? 0}
                  min={-40}
                  max={40}
                  unit="px"
                  onChange={(v) => setPartition("customSkuBadgeOffsetY", v === 0 ? undefined : v)}
                />
              </div>
            )}
          </SectionShell>
        )}

        <SectionShell sectionId="padding" title="Padding">
          <div className="grid grid-cols-2 gap-2">
            <NumericField
              label="Padding X"
              value={mode === "partition-tree" ? pOverrides.customPaddingX : eOverrides.paddingX}
              fallback={
                mode === "partition-tree"
                  ? partitionStyleDefaults.paddingX
                  : TREE_DEFAULTS.external.paddingX
              }
              unit="px"
              min={0}
              onChange={(v) =>
                mode === "partition-tree"
                  ? setPartition("customPaddingX", v)
                  : setExternal("paddingX", v)
              }
            />
            <NumericField
              label="Padding Y"
              value={mode === "partition-tree" ? pOverrides.customPaddingY : eOverrides.paddingY}
              fallback={
                mode === "partition-tree"
                  ? partitionStyleDefaults.paddingY
                  : TREE_DEFAULTS.external.paddingY
              }
              unit="px"
              min={0}
              onChange={(v) =>
                mode === "partition-tree"
                  ? setPartition("customPaddingY", v)
                  : setExternal("paddingY", v)
              }
            />
          </div>
        </SectionShell>

        {mode === "external" && currentShape !== "callout" && (
          <SectionShell sectionId="transform" title="Transform">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Rotation</span>
                <span className="text-[11px] font-mono text-gray-500">{Math.round(currentRotation)}°</span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {ROTATION_PRESETS.map((deg) => {
                  const isActive = normalizedRotation === deg;
                  return (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setExternal("rotation", deg)}
                      className={`h-7 rounded text-[11px] font-medium border transition-colors ${
                        isActive
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                      aria-pressed={isActive}
                      title={`Rotate to ${deg} degrees`}
                    >
                      {deg}°
                    </button>
                  );
                })}
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={15}
                value={Math.round(currentRotation)}
                onChange={(e) => setExternal("rotation", parseInt(e.target.value, 10))}
                className="w-full h-1 accent-gray-600 cursor-pointer bg-gray-200 rounded-full mb-1.5"
              />
            </div>
          </SectionShell>
        )}

        {!isMulti && (
          <SectionShell sectionId="dimensions" title="Dimensions">
            <div className="grid grid-cols-2 gap-2">
              <DimensionField
                label="Width"
                value={mode === "external" ? currentWidth : currentPartitionWidth}
                onChange={(v) =>
                  onUpdateDimensions?.(
                    nodeIds,
                    v,
                    mode === "external" ? currentHeight : currentPartitionHeight
                  )
                }
              />
              <DimensionField
                label="Height"
                value={mode === "external" ? currentHeight : currentPartitionHeight}
                onChange={(v) =>
                  onUpdateDimensions?.(
                    nodeIds,
                    mode === "external" ? currentWidth : currentPartitionWidth,
                    v
                  )
                }
              />
            </div>
          </SectionShell>
        )}

        <SectionShell sectionId="border" title="Border">
          <ColorField
            label="Border color"
            value={mode === "partition-tree" ? pOverrides.customBorderColor : eOverrides.borderColor}
            fallback={mode === "external" && currentShape === "callout" ? "#4B5563" : "#000000"}
            onChange={(hex) => mode === "partition-tree" ? setPartition("customBorderColor", hex) : setExternal("borderColor", hex)}
            onClear={() => mode === "partition-tree" ? setPartition("customBorderColor", undefined) : setExternal("borderColor", undefined)}
          />
          <NumericField
            label="Border width"
            value={mode === "partition-tree" ? pOverrides.customBorderWidth : eOverrides.borderWidth}
            fallback={
              mode === "partition-tree"
                ? partitionStyleDefaults.borderWidth
                : TREE_DEFAULTS.external.borderWidth
            }
            unit="px"
            min={0}
            onChange={(v) =>
              mode === "partition-tree"
                ? setPartition("customBorderWidth", v)
                : setExternal("borderWidth", v)
            }
          />
          <div className="mt-2">
            <span className="text-[10px] text-gray-500 font-medium block mb-1">Border type</span>
            <div className="grid grid-cols-2 gap-1">
              {(["solid", "dashed", "dotted", "none"] as const).map((style) => {
                const active = currentBorderStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      mode === "partition-tree"
                        ? setPartition("customBorderStyle", style === "solid" ? undefined : style)
                        : setExternal("borderStyle", style === "solid" ? undefined : style)
                    }
                    className={`flex h-7 items-center justify-center gap-2 rounded border text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    aria-pressed={active}
                  >
                    <span
                      className="inline-block w-6"
                      style={{
                        borderTop: `2px ${style} ${active ? "#ffffff" : "#6b7280"}`,
                      }}
                    />
                    {style}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionShell>

        <SectionShell sectionId="shadow" title="Shadow">
          <ColorField
            label="Shadow color"
            value={mode === "partition-tree" ? pOverrides.customShadowColor : eOverrides.shadowColor}
            fallback="rgba(0,0,0,0.25)"
            onChange={(hex) => mode === "partition-tree" ? setPartition("customShadowColor", hex) : setExternal("shadowColor", hex)}
            onClear={() => mode === "partition-tree" ? setPartition("customShadowColor", undefined) : setExternal("shadowColor", undefined)}
          />
          <SliderField
            label="Blur"
            value={mode === "partition-tree" ? pOverrides.customShadowBlur : eOverrides.shadowBlur}
            min={0}
            max={40}
            unit="px"
            onChange={(v) => mode === "partition-tree" ? setPartition("customShadowBlur", v === 0 ? undefined : v) : setExternal("shadowBlur", v === 0 ? undefined : v)}
          />
          <SliderField
            label="Offset X"
            value={mode === "partition-tree" ? pOverrides.customShadowOffsetX : eOverrides.shadowOffsetX}
            min={-20}
            max={20}
            unit="px"
            onChange={(v) => mode === "partition-tree" ? setPartition("customShadowOffsetX", v === 0 ? undefined : v) : setExternal("shadowOffsetX", v === 0 ? undefined : v)}
          />
          <SliderField
            label="Offset Y"
            value={mode === "partition-tree" ? pOverrides.customShadowOffsetY : eOverrides.shadowOffsetY}
            min={-20}
            max={20}
            unit="px"
            onChange={(v) => mode === "partition-tree" ? setPartition("customShadowOffsetY", v === 0 ? undefined : v) : setExternal("shadowOffsetY", v === 0 ? undefined : v)}
          />
        </SectionShell>

        <SectionShell sectionId="opacity" title="Opacity">
          <SliderField
            label="Opacity"
            value={mode === "partition-tree" ? pOverrides.customOpacity ?? 100 : eOverrides.opacity ?? 100}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => mode === "partition-tree" ? setPartition("customOpacity", v === 100 ? undefined : v) : setExternal("opacity", v === 100 ? undefined : v)}
          />
        </SectionShell>
      </div>

      <footer
        className={`flex shrink-0 items-center justify-between border-t px-3 py-2.5 ${
          isTabs ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
        }`}
      >
        {mode === "external" && onDelete ? (
          <button type="button" onClick={() => onDelete(nodeIds)} className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors">
            Delete
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={() => onReset(nodeIds)}
          disabled={!hasOverrides && !isMulti}
          className={`text-[11px] font-medium transition-colors ${
            hasOverrides || isMulti ? "text-gray-500 hover:text-red-500" : "text-gray-300 cursor-not-allowed"
          }`}
        >
          Reset all
        </button>
        <span className="text-[10px] text-gray-400">{isMulti ? `${nodeIds.length} nodes` : hasOverrides ? "Modified" : ""}</span>
      </footer>
    </div>
  );
}

