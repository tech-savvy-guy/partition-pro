import {
  Circle,
  Diamond,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  Move,
  MousePointer2,
  Plus,
  RotateCcw,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";

import { SHAPES } from "../external-node-pane";
import type { ExternalNodeShape } from "../node";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type CanvasMode = "move" | "select";

const TOOLBAR_CONTROL_HEIGHT = "h-7";

const shapeIcons: Record<ExternalNodeShape, LucideIcon> = {
  callout: MessageSquare,
  label: Type,
  circle: Circle,
  box: Square,
  diamond: Diamond,
};

export interface PartitionTreeToolbarProps {
  canvasMode: CanvasMode;
  onCanvasModeChange: (mode: CanvasMode) => void;
  onCreateRollups: () => void;
  onReset: () => void;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
  obmProcessing: boolean;
}

function ToolbarSeparator() {
  return (
    <Separator
      orientation="vertical"
      className={cn("shrink-0 self-center", TOOLBAR_CONTROL_HEIGHT)}
    />
  );
}

const canvasModes = [
  { value: "move" as const, icon: Move, label: "Move" },
  { value: "select" as const, icon: MousePointer2, label: "Select" },
];

function CanvasModeToggle({
  value,
  onChange,
}: {
  value: CanvasMode;
  onChange: (mode: CanvasMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Canvas interaction mode"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5",
        TOOLBAR_CONTROL_HEIGHT
      )}
    >
      {canvasModes.map(({ value: mode, icon: Icon, label }) => {
        const isActive = value === mode;

        return (
          <Tooltip key={mode}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={label}
                  onClick={() => onChange(mode)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-[5px] transition-all",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              }
            />
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function PartitionTreeToolbar({
  canvasMode,
  onCanvasModeChange,
  onCreateRollups,
  onReset,
  onToggleFullScreen,
  isFullScreen,
  obmProcessing,
}: PartitionTreeToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex h-11 w-full shrink-0 select-none items-center justify-between border-b border-border bg-background px-3">
        <div className={cn("ml-4 flex min-w-0 items-center gap-2", TOOLBAR_CONTROL_HEIGHT)}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCreateRollups}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Rollups
                </Button>
              }
            />
            <TooltipContent>Create rollups</TooltipContent>
          </Tooltip>

          <ToolbarSeparator />

          <CanvasModeToggle
            value={canvasMode}
            onChange={onCanvasModeChange}
          />

          <ToolbarSeparator />

          <div className={cn("flex items-center gap-1", TOOLBAR_CONTROL_HEIGHT)}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onReset}
                    className="rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Reset to default"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Reset to defaults</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onToggleFullScreen}
                    className="rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={
                      isFullScreen ? "Exit full screen" : "Full screen"
                    }
                  >
                    {isFullScreen ? (
                      <Minimize2 className="size-3.5" />
                    ) : (
                      <Maximize2 className="size-3.5" />
                    )}
                  </Button>
                }
              />
              <TooltipContent>
                {isFullScreen ? "Exit full screen" : "Full screen"}
              </TooltipContent>
            </Tooltip>
          </div>

          <ToolbarSeparator />

          <div className={cn("flex items-center gap-0.5", TOOLBAR_CONTROL_HEIGHT)}>
            {SHAPES.map(({ type, label }) => (
              <ShapeDragButton key={type} label={label} type={type} />
            ))}
          </div>
        </div>

        {obmProcessing && (
          <div className="flex items-center pr-1 text-muted-foreground">
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-label="Processing"
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function ShapeDragButton({
  label,
  type,
}: {
  label: string;
  type: ExternalNodeShape;
}) {
  const Icon = shapeIcons[type];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/reactflow", type);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag to add ${label} node`}
          >
            <Icon className="size-3.5" />
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
