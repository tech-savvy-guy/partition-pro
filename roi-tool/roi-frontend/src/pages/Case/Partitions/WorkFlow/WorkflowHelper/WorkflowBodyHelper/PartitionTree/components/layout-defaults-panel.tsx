import React from "react";
import { TREE_DEFAULTS, type TreeLayoutDefaults } from "../treeDefaults";
import { CollapsibleSection } from "./section";
import { DimensionField } from "./dimension-field";

type Props = {
  layout: TreeLayoutDefaults;
  onChange: (layout: TreeLayoutDefaults) => void;
  onReset: () => void;
};

const LAYOUT_KEYS: (keyof TreeLayoutDefaults)[] = [
  "verticalGap",
  "horizontalGap",
  "edgeShoulder",
  "edgeBorderRadius",
  "partitionNodeWidth",
  "partitionNodeHeight",
  "attributeNodeWidth",
  "attributeNodeHeight",
  "partitionMinWidth",
  "partitionMinHeight",
];

function hasLayoutOverrides(layout: TreeLayoutDefaults): boolean {
  return LAYOUT_KEYS.some((key) => layout[key] !== TREE_DEFAULTS.layout[key]);
}

export function TreeLayoutDefaultsPanel({ layout, onChange, onReset }: Props) {
  const [openSection, setOpenSection] = React.useState<string>("spacing");

  const set = (key: keyof TreeLayoutDefaults, value: number) => {
    onChange({ ...layout, [key]: value });
  };

  const toggleSection = (key: string, nextOpen: boolean) => {
    setOpenSection(nextOpen ? key : "");
  };

  const hasOverrides = hasLayoutOverrides(layout);

  return (
    <div className="flex min-h-0 w-64 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-3">
        <span className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">
          Defaults
        </span>
        <button
          type="button"
          onClick={onReset}
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <CollapsibleSection
          title="Spacing"
          open={openSection === "spacing"}
          onOpenChange={(v) => toggleSection("spacing", v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <DimensionField
              label="Vertical gap"
              value={layout.verticalGap}
              onChange={(v) => set("verticalGap", v)}
              min={0}
            />
            <DimensionField
              label="Horizontal gap"
              value={layout.horizontalGap}
              onChange={(v) => set("horizontalGap", v)}
              min={0}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Node sizes"
          open={openSection === "node-sizes"}
          onOpenChange={(v) => toggleSection("node-sizes", v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <DimensionField
              label="Partition width"
              value={layout.partitionNodeWidth}
              onChange={(v) => set("partitionNodeWidth", v)}
            />
            <DimensionField
              label="Partition height"
              value={layout.partitionNodeHeight}
              onChange={(v) => set("partitionNodeHeight", v)}
            />
            <DimensionField
              label="Attribute width"
              value={layout.attributeNodeWidth}
              onChange={(v) => set("attributeNodeWidth", v)}
            />
            <DimensionField
              label="Attribute height"
              value={layout.attributeNodeHeight}
              onChange={(v) => set("attributeNodeHeight", v)}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Edges"
          open={openSection === "edges"}
          onOpenChange={(v) => toggleSection("edges", v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <DimensionField
              label="Shoulder"
              value={layout.edgeShoulder}
              onChange={(v) => set("edgeShoulder", v)}
              min={0}
            />
            <DimensionField
              label="Corner radius"
              value={layout.edgeBorderRadius}
              onChange={(v) => set("edgeBorderRadius", v)}
              min={0}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Resize limits"
          open={openSection === "resize-limits"}
          onOpenChange={(v) => toggleSection("resize-limits", v)}
        >
          <div className="grid grid-cols-2 gap-2">
            <DimensionField
              label="Min width"
              value={layout.partitionMinWidth}
              onChange={(v) => set("partitionMinWidth", v)}
              min={1}
            />
            <DimensionField
              label="Min height"
              value={layout.partitionMinHeight}
              onChange={(v) => set("partitionMinHeight", v)}
              min={1}
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
