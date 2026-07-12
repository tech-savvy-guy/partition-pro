import { useEffect, useRef, useState } from "react";
import { Edit } from "../icons";
import { ColorField } from "./color-field";
import { SegmentedToggle } from "./section";
import { panelResetClass } from "./panel-styles";
import colorConfig from "@/lib/partition-tree/colors.json";

export type TreeLegendColors = {
  clientSkuBg: string;
  clientSkuText: string;
  skuBg: string;
  skuText: string;
};

const DEFAULTS: TreeLegendColors = {
  clientSkuBg: colorConfig.badges.clientSku.background,
  clientSkuText: colorConfig.badges.clientSku.text,
  skuBg: colorConfig.badges.sku.background,
  skuText: colorConfig.badges.sku.text,
};

type ColorMode = "fill" | "text";

type SectionRowProps = {
  mode: ColorMode;
  fillValue: string | undefined;
  fillFallback: string;
  textValue: string | undefined;
  textFallback: string;
  onFillChange: (hex: string) => void;
  onFillClear: () => void;
  onTextChange: (hex: string) => void;
  onTextClear: () => void;
};

function SectionRow({
  mode,
  fillValue,
  fillFallback,
  textValue,
  textFallback,
  onFillChange,
  onFillClear,
  onTextChange,
  onTextClear,
}: SectionRowProps) {
  const activeValue = mode === "fill" ? fillValue : textValue;
  const activeFallback = mode === "fill" ? fillFallback : textFallback;
  const activeOnChange = mode === "fill" ? onFillChange : onTextChange;
  const activeOnClear = mode === "fill" ? onFillClear : onTextClear;

  return (
    <ColorField
      label={mode === "fill" ? "Fill" : "Text"}
      value={activeValue}
      fallback={activeFallback}
      onChange={activeOnChange}
      onClear={activeOnClear}
    />
  );
}

type Props = {
  colors: TreeLegendColors;
  onColorsChange: (colors: TreeLegendColors) => void;
  variant?: "panel" | "floating";
};

function LegendEditPopover({
  colors,
  onColorsChange,
  hasOverrides,
  onReset,
  onClose,
}: {
  colors: TreeLegendColors;
  onColorsChange: (colors: TreeLegendColors) => void;
  hasOverrides: boolean;
  onReset: () => void;
  onClose: () => void;
}) {
  const [clientMode, setClientMode] = useState<ColorMode>("fill");
  const [skuMode, setSkuMode] = useState<ColorMode>("fill");

  const set = (key: keyof TreeLegendColors, value: string | undefined) => {
    onColorsChange({ ...colors, [key]: value ?? DEFAULTS[key] });
  };

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-border bg-background p-3 shadow-lg"
      role="dialog"
      aria-label="Edit legend colours"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Edit legend</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          Done
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              Client SKU
            </span>
            <SegmentedToggle
              options={[
                { value: "fill", label: "Fill" },
                { value: "text", label: "Text" },
              ]}
              value={clientMode}
              onChange={setClientMode}
            />
          </div>
          <SectionRow
            mode={clientMode}
            fillValue={
              colors.clientSkuBg !== DEFAULTS.clientSkuBg
                ? colors.clientSkuBg
                : undefined
            }
            fillFallback={DEFAULTS.clientSkuBg}
            textValue={
              colors.clientSkuText !== DEFAULTS.clientSkuText
                ? colors.clientSkuText
                : undefined
            }
            textFallback={DEFAULTS.clientSkuText}
            onFillChange={(hex) => set("clientSkuBg", hex)}
            onFillClear={() => set("clientSkuBg", undefined)}
            onTextChange={(hex) => set("clientSkuText", hex)}
            onTextClear={() => set("clientSkuText", undefined)}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              SKU Count
            </span>
            <SegmentedToggle
              options={[
                { value: "fill", label: "Fill" },
                { value: "text", label: "Text" },
              ]}
              value={skuMode}
              onChange={setSkuMode}
            />
          </div>
          <SectionRow
            mode={skuMode}
            fillValue={
              colors.skuBg !== DEFAULTS.skuBg ? colors.skuBg : undefined
            }
            fillFallback={DEFAULTS.skuBg}
            textValue={
              colors.skuText !== DEFAULTS.skuText ? colors.skuText : undefined
            }
            textFallback={DEFAULTS.skuText}
            onFillChange={(hex) => set("skuBg", hex)}
            onFillClear={() => set("skuBg", undefined)}
            onTextChange={(hex) => set("skuText", hex)}
            onTextClear={() => set("skuText", undefined)}
          />
        </div>
      </div>

      {hasOverrides && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 w-full text-center text-[10px] font-medium text-muted-foreground transition-colors hover:text-destructive"
        >
          Reset to defaults
        </button>
      )}
    </div>
  );
}

function FloatingTreeLegend({
  colors,
  onColorsChange,
  hasOverrides,
  onReset,
}: {
  colors: TreeLegendColors;
  onColorsChange: (colors: TreeLegendColors) => void;
  hasOverrides: boolean;
  onReset: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setEditOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [editOpen]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto relative"
      data-download-ignore="true"
    >
      <div className="flex items-center gap-2.5 rounded-full border border-border/80 bg-background/90 py-1 pl-2.5 pr-1 shadow-md ring-1 ring-black/5 backdrop-blur-md">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Legend
        </span>

        <div className="flex items-center gap-2.5 border-l border-border/80 pl-2.5">
          <div className="flex items-center gap-1" title="Client SKU">
            <span
              className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: colors.clientSkuBg }}
            />
            <span className="text-[10px] text-muted-foreground">Client</span>
          </div>
          <div className="flex items-center gap-1" title="SKU Count">
            <span
              className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: colors.skuBg }}
            />
            <span className="text-[10px] text-muted-foreground">SKU</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
            editOpen
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title="Edit legend colours"
          aria-label="Edit legend colours"
          aria-expanded={editOpen}
        >
          <Edit size={14} />
        </button>
      </div>

      {editOpen && (
        <LegendEditPopover
          colors={colors}
          onColorsChange={onColorsChange}
          hasOverrides={hasOverrides}
          onReset={() => {
            onReset();
            setEditOpen(false);
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

export function TreeLegend({
  colors,
  onColorsChange,
  variant = "panel",
}: Props) {
  const [clientMode, setClientMode] = useState<ColorMode>("fill");
  const [skuMode, setSkuMode] = useState<ColorMode>("fill");

  const set = (key: keyof TreeLegendColors, value: string | undefined) => {
    onColorsChange({ ...colors, [key]: value ?? DEFAULTS[key] });
  };

  const hasOverrides =
    colors.clientSkuBg !== DEFAULTS.clientSkuBg ||
    colors.clientSkuText !== DEFAULTS.clientSkuText ||
    colors.skuBg !== DEFAULTS.skuBg ||
    colors.skuText !== DEFAULTS.skuText;

  if (variant === "floating") {
    return (
      <FloatingTreeLegend
        colors={colors}
        onColorsChange={onColorsChange}
        hasOverrides={hasOverrides}
        onReset={() => onColorsChange(DEFAULTS)}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Legend</span>
        <button
          type="button"
          onClick={() => onColorsChange(DEFAULTS)}
          disabled={!hasOverrides}
          className={panelResetClass}
        >
          Reset
        </button>
      </header>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              Client SKU
            </span>
            <SegmentedToggle
              options={[
                { value: "fill", label: "Fill" },
                { value: "text", label: "Text" },
              ]}
              value={clientMode}
              onChange={setClientMode}
            />
          </div>
          <SectionRow
            mode={clientMode}
            fillValue={
              colors.clientSkuBg !== DEFAULTS.clientSkuBg
                ? colors.clientSkuBg
                : undefined
            }
            fillFallback={DEFAULTS.clientSkuBg}
            textValue={
              colors.clientSkuText !== DEFAULTS.clientSkuText
                ? colors.clientSkuText
                : undefined
            }
            textFallback={DEFAULTS.clientSkuText}
            onFillChange={(hex) => set("clientSkuBg", hex)}
            onFillClear={() => set("clientSkuBg", undefined)}
            onTextChange={(hex) => set("clientSkuText", hex)}
            onTextClear={() => set("clientSkuText", undefined)}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              SKU Count
            </span>
            <SegmentedToggle
              options={[
                { value: "fill", label: "Fill" },
                { value: "text", label: "Text" },
              ]}
              value={skuMode}
              onChange={setSkuMode}
            />
          </div>
          <SectionRow
            mode={skuMode}
            fillValue={
              colors.skuBg !== DEFAULTS.skuBg ? colors.skuBg : undefined
            }
            fillFallback={DEFAULTS.skuBg}
            textValue={
              colors.skuText !== DEFAULTS.skuText ? colors.skuText : undefined
            }
            textFallback={DEFAULTS.skuText}
            onFillChange={(hex) => set("skuBg", hex)}
            onFillClear={() => set("skuBg", undefined)}
            onTextChange={(hex) => set("skuText", hex)}
            onTextClear={() => set("skuText", undefined)}
          />
        </div>
      </div>
    </div>
  );
}
