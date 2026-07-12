import React, { useEffect } from "react";
import {
  NoColorsIcon,
  Information,
  Close,
  Undo,
  ColorPalette,
  TextAlignLeft,
  Grid,
} from "./icons";

import type {
  TreeNodeKind,
  PartitionTreeNodeData,
  NodeCustomizations,
  ExternalNodeData,
  ExternalNodeShape,
  ExternalNodeCustomizations,
} from "./node";
import { SHAPE_DEFAULTS } from "./node";
import { TREE_DEFAULTS, getPartitionDefaultsForNodeType, getPartitionNodeDimensions } from "@/lib/partition-tree/tree-defaults";
import { useTreeDefaults } from "./tree-defaults-context";

import colorConfig from "@/lib/partition-tree/colors.json";
import { BAIN_COLORS } from "@/lib/partition-tree/constants";
import { CollapsibleSection } from "./components/section";
import {
  panelFooterClass,
  panelHeaderClass,
  panelHeaderTitleClass,
  panelInputClass,
  panelLabelClass,
  panelMutedLabelClass,
  panelOptionClass,
  panelResetClass,
} from "./components/panel-styles";
import { cn } from "@/lib/utils";
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
    <div className="space-y-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
      <div className="mb-2 flex items-center justify-between">
        <span className={panelLabelClass}>{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
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
        className="h-1 w-full cursor-pointer rounded-full bg-muted accent-foreground"
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
      className={cn(
        "flex flex-col bg-background",
        isTabs ? "h-full min-h-0" : "border-t border-border"
      )}
    >
      <header className={panelHeaderClass}>
        <span className={panelHeaderTitleClass}>
          {isMulti ? `Edit ${nodeIds.length} Nodes` : mode === "external" ? "Edit External Node" : "Edit Node"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close panel"
        >
          <Close size={16} />
        </button>
      </header>

      {isTabs && (
        <div
          className="mx-3 mb-3 flex shrink-0 gap-0.5 rounded-md bg-muted/60 p-0.5"
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
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-[5px] py-1.5 text-[11px] font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "space-y-1 overflow-y-auto px-4 py-3",
          isTabs && "min-h-0 flex-1"
        )}
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
                className={cn(panelInputClass, "pr-14 pl-3")}
              />
              {pOverrides.customLabel != null && (
                <button
                  type="button"
                  onClick={() => setPartition("customLabel", undefined)}
                  className="absolute right-1 top-1/2 flex h-5 -translate-y-1/2 items-center rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
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
                className={cn(panelInputClass, "pr-14 pl-3")}
              />
              {eOverrides.customLabel != null && (
                <button
                  type="button"
                  onClick={() => setExternal("customLabel", undefined)}
                  className="absolute right-1 top-1/2 flex h-5 -translate-y-1/2 items-center rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
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
                      className={cn(
                        "h-8 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors",
                        calloutHasNoFill
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
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
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <NoColorsIcon />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">No brand colours</p>
                <p className="text-[10px] text-muted-foreground/70">Add colours in case settings</p>
              </div>
            </div>
          )}
        </SectionShell>

        {mode === "partition-tree" && (
          <SectionShell sectionId="alignment" title="Alignment">
            <span className={`${panelMutedLabelClass} mb-1 block`}>Horizontal</span>
            <div className="grid grid-cols-3 gap-1 mb-3">
              {(["left", "center", "right"] as const).map((align) => {
                const active = currentPartitionTextAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setPartition("customTextAlign", align)}
                    className={panelOptionClass(active)}
                    aria-pressed={active}
                  >
                    {align}
                  </button>
                );
              })}
            </div>
            <span className={`${panelMutedLabelClass} mb-1 block`}>Vertical</span>
            <div className="grid grid-cols-3 gap-1">
              {(["top", "center", "bottom"] as const).map((align) => {
                const active = currentPartitionVerticalAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setPartition("customVerticalAlign", align)}
                    className={panelOptionClass(active)}
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
                    className={panelOptionClass(active)}
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
              <span className={`${panelMutedLabelClass} mb-1 block`}>Font weight</span>
              {mode === "partition-tree" ? (
                <select
                  value={pOverrides.customFontWeight != null ? String(pOverrides.customFontWeight) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return setPartition("customFontWeight", undefined);
                    setPartition("customFontWeight", /^\d+$/.test(v) ? Number(v) : v);
                  }}
                  className={panelInputClass}
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
                  className={panelInputClass}
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
                    className={cn(
                      "border-b-2 pb-1 text-[11px] font-medium transition-colors",
                      badgeEditor === btn.id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-[10px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
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
                <span className={panelLabelClass}>Rotation</span>
                <span className="font-mono text-[11px] text-muted-foreground">{Math.round(currentRotation)}°</span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {ROTATION_PRESETS.map((deg) => {
                  const isActive = normalizedRotation === deg;
                  return (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setExternal("rotation", deg)}
                      className={panelOptionClass(isActive)}
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
                className="mb-1.5 h-1 w-full cursor-pointer rounded-full bg-muted accent-foreground"
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
            <span className={`${panelMutedLabelClass} mb-1 block`}>Border type</span>
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
                    className={cn(
                      panelOptionClass(active),
                      "flex items-center justify-center gap-2"
                    )}
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

      <footer className={panelFooterClass}>
        {mode === "external" && onDelete ? (
          <button type="button" onClick={() => onDelete(nodeIds)} className="text-[11px] font-medium text-destructive transition-colors hover:text-destructive/80">
            Delete
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={() => onReset(nodeIds)}
          disabled={!hasOverrides && !isMulti}
          className={panelResetClass}
        >
          Reset all
        </button>
        <span className="text-[10px] text-muted-foreground">{isMulti ? `${nodeIds.length} nodes` : hasOverrides ? "Modified" : ""}</span>
      </footer>
    </div>
  );
}

