import type { ExternalNodeShape } from "./node";
import {
  Chat,
  CircleOutline,
  SquareOutline,
  DiamondOutline,
  TextFont,
} from "./icons";

export const SHAPES: { type: ExternalNodeShape; label: string }[] = [
  { type: "callout", label: "Callout" },
  { type: "label", label: "Label" },
  { type: "circle", label: "Circle" },
  { type: "box", label: "Box" },
  { type: "diamond", label: "Diamond" },
];

export function ShapeIcon({ shape }: { shape: ExternalNodeShape }) {
  switch (shape) {
    case "callout":
      return <Chat />;
    case "label":
      return <TextFont />;
    case "circle":
      return <CircleOutline />;
    case "box":
      return <SquareOutline />;
    case "diamond":
      return <DiamondOutline />;
  }
}

export function ExternalNodePanel() {
  return (
    <div className="flex items-center h-8 gap-1 rounded-md bg-white shadow-xs border border-gray-200 overflow-hidden px-1 select-none">
      <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-2 py-0">
        Add
      </span>
      {SHAPES.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/reactflow", type);
            e.dataTransfer.effectAllowed = "move";
          }}
          className="flex items-center justify-center w-6 h-6 rounded-sm border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing"
          title={`Add ${label}`}
          aria-label={`Drag to add ${label} node`}
        >
          <ShapeIcon shape={type} />
        </button>
      ))}
    </div>
  );
}

