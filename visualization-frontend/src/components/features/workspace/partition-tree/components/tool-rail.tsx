import React, { useEffect, useRef, useState } from "react";
import {
  Add,
  Download,
  Minimize,
  Move,
  Repeat,
  SelectWindow,
  Shapes,
} from "../icons";
import { SHAPES, ShapeIcon } from "../external-node-pane";

type CanvasMode = "move" | "select";

type ToolRailProps = {
  canvasMode: CanvasMode;
  onCanvasModeChange: (mode: CanvasMode) => void;
  onCreateRollups: () => void;
  onReset: () => void;
  onToggleFullScreen: () => void;
  onDownload: () => void;
  isFullScreen: boolean;
};

function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      role="tooltip"
    >
      {label}
    </span>
  );
}

function RailButton({
  label,
  onClick,
  active,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50"
      } ${className}`}
    >
      {children}
      <RailTooltip label={label} />
    </button>
  );
}

function RailDivider() {
  return <div className="my-1 h-px w-7 bg-gray-200" />;
}

export function ToolRail({
  canvasMode,
  onCanvasModeChange,
  onCreateRollups,
  onReset,
  onToggleFullScreen,
  onDownload,
  isFullScreen,
}: ToolRailProps) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shapesOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) {
        setShapesOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [shapesOpen]);

  return (
    <aside
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3"
      aria-label="Partition tree tools"
    >
      <RailButton label="Create Rollups" onClick={onCreateRollups}>
        <Add size={18} />
      </RailButton>

      <RailDivider />

      <RailButton
        label="Move mode (pan canvas)"
        active={canvasMode === "move"}
        onClick={() => onCanvasModeChange("move")}
      >
        <Move size={18} />
      </RailButton>
      <RailButton
        label="Select mode (drag to select)"
        active={canvasMode === "select"}
        onClick={() => onCanvasModeChange("select")}
      >
        <SelectWindow size={18} />
      </RailButton>

      <RailDivider />

      <div ref={shapesRef} className="relative flex flex-col items-center">
        <RailButton
          label="Add shapes"
          active={shapesOpen}
          onClick={() => setShapesOpen((v) => !v)}
        >
          <Shapes size={18} />
        </RailButton>
        {shapesOpen && (
          <div
            className="absolute left-full top-0 z-50 ml-2 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
            role="menu"
            aria-label="Drag shapes onto canvas"
          >
            {SHAPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow", type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                title={`Drag to add ${label}`}
                aria-label={`Drag to add ${label}`}
                className="flex h-9 w-9 cursor-grab items-center justify-center rounded-md border border-transparent text-gray-600 transition-colors hover:border-gray-200 hover:bg-gray-50 active:cursor-grabbing"
              >
                <ShapeIcon shape={type} />
              </button>
            ))}
          </div>
        )}
      </div>

      <RailDivider />

      <RailButton label="Reset to default" onClick={onReset}>
        <Repeat size={18} />
      </RailButton>
      <RailButton label="Download as PNG" onClick={onDownload}>
        <Download size={18} />
      </RailButton>

      <div className="flex-1" />

      <RailButton
        label={isFullScreen ? "Exit full screen" : "Full screen"}
        onClick={onToggleFullScreen}
        active={isFullScreen}
      >
        <Minimize size={18} />
      </RailButton>
    </aside>
  );
}
