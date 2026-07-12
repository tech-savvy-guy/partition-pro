import React, { useEffect, useRef, useState } from "react";
import { Edit } from "@carbon/icons-react";
import { ColorField } from "./color-field";
import colorConfig from "../colors.json";

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

function Toggle({
  value,
  onChange,
}: {
  value: ColorMode;
  onChange: (v: ColorMode) => void;
}) {
  return (
    <div className="flex items-center bg-gray-100 rounded p-0.5 gap-0.5">
      {(["fill", "text"] as ColorMode[]).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
            value === opt
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

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
      className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
      role="dialog"
      aria-label="Edit legend colours"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-700">Edit legend</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-medium text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          Done
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500">Client SKU</span>
            <Toggle value={clientMode} onChange={setClientMode} />
          </div>
          <SectionRow
            mode={clientMode}
            fillValue={
              colors.clientSkuBg !== DEFAULTS.clientSkuBg ? colors.clientSkuBg : undefined
            }
            fillFallback={DEFAULTS.clientSkuBg}
            textValue={
              colors.clientSkuText !== DEFAULTS.clientSkuText ? colors.clientSkuText : undefined
            }
            textFallback={DEFAULTS.clientSkuText}
            onFillChange={(hex) => set("clientSkuBg", hex)}
            onFillClear={() => set("clientSkuBg", undefined)}
            onTextChange={(hex) => set("clientSkuText", hex)}
            onTextClear={() => set("clientSkuText", undefined)}
          />
        </div>

        <div className="border-t border-gray-100" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-500">SKU Count</span>
            <Toggle value={skuMode} onChange={setSkuMode} />
          </div>
          <SectionRow
            mode={skuMode}
            fillValue={colors.skuBg !== DEFAULTS.skuBg ? colors.skuBg : undefined}
            fillFallback={DEFAULTS.skuBg}
            textValue={colors.skuText !== DEFAULTS.skuText ? colors.skuText : undefined}
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
          className="mt-3 w-full text-center text-[10px] font-medium text-gray-400 transition-colors hover:text-red-500"
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
      <div className="flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white/90 py-1 pl-2.5 pr-1 shadow-md ring-1 ring-black/5 backdrop-blur-md">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
          Legend
        </span>

        <div className="flex items-center gap-2.5 border-l border-gray-200/80 pl-2.5">
          <div className="flex items-center gap-1" title="Client SKU">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: colors.clientSkuBg }}
            />
            <span className="text-[10px] text-gray-500">Client</span>
          </div>
          <div className="flex items-center gap-1" title="SKU Count">
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: colors.skuBg }}
            />
            <span className="text-[10px] text-gray-500">SKU</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
            editOpen
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
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
    <div className="w-64 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 h-9 border-b border-gray-100">
        <span className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">
          Legend
        </span>
        <button
          type="button"
          onClick={() => onColorsChange(DEFAULTS)}
          disabled={!hasOverrides}
          className={`text-[11px] transition-colors ${
            hasOverrides
              ? "text-red-400 hover:text-red-500"
              : "text-gray-300 cursor-not-allowed"
          }`}
        >
          Reset
        </button>
      </header>

      {/* Body */}
      <div className="px-3 py-3 space-y-4">
        {/* Client SKU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-medium">Client SKU</span>
            <Toggle value={clientMode} onChange={setClientMode} />
          </div>
          <SectionRow
            mode={clientMode}
            fillValue={colors.clientSkuBg !== DEFAULTS.clientSkuBg ? colors.clientSkuBg : undefined}
            fillFallback={DEFAULTS.clientSkuBg}
            textValue={colors.clientSkuText !== DEFAULTS.clientSkuText ? colors.clientSkuText : undefined}
            textFallback={DEFAULTS.clientSkuText}
            onFillChange={(hex) => set("clientSkuBg", hex)}
            onFillClear={() => set("clientSkuBg", undefined)}
            onTextChange={(hex) => set("clientSkuText", hex)}
            onTextClear={() => set("clientSkuText", undefined)}
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* SKU Count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-medium">SKU Count</span>
            <Toggle value={skuMode} onChange={setSkuMode} />
          </div>
          <SectionRow
            mode={skuMode}
            fillValue={colors.skuBg !== DEFAULTS.skuBg ? colors.skuBg : undefined}
            fillFallback={DEFAULTS.skuBg}
            textValue={colors.skuText !== DEFAULTS.skuText ? colors.skuText : undefined}
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
