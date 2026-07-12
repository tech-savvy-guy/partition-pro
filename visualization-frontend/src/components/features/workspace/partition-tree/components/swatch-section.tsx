import { useState } from "react";
import { cn } from "@/lib/utils";
import { SegmentedToggle } from "./section";

type SwatchSectionProps = {
  title: string;
  colors: { hex: string; name: string }[];
  activeFill: string | undefined;
  activeText: string | undefined;
  onSetFill: (hex: string) => void;
  onSetText: (hex: string) => void;
  textOnly?: boolean;
  size?: "sm" | "lg";
};

export function SwatchSection({
  title,
  colors,
  activeFill,
  activeText,
  onSetFill,
  onSetText,
  textOnly = false,
  size = "sm",
}: SwatchSectionProps) {
  const [mode, setMode] = useState<"fill" | "text">("fill");
  const effectiveMode = textOnly ? "text" : mode;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {!textOnly && (
          <SegmentedToggle
            options={[
              { value: "fill", label: "Fill" },
              { value: "text", label: "Text" },
            ]}
            value={mode}
            onChange={setMode}
          />
        )}
      </div>
      <div
        className={cn(
          "grid gap-2",
          size === "lg" ? "grid-cols-5" : "grid-cols-6 gap-1.5"
        )}
      >
        {colors.map(({ hex, name }) => {
          const active =
            effectiveMode === "fill" ? activeFill === hex : activeText === hex;
          return (
            <button
              key={hex}
              type="button"
              onClick={() =>
                effectiveMode === "fill" ? onSetFill(hex) : onSetText(hex)
              }
              className={cn(
                "aspect-square w-full rounded-md border transition-all hover:scale-105",
                size === "lg" && "min-h-8",
                active
                  ? "border-foreground ring-2 ring-ring/30"
                  : "border-border"
              )}
              style={{ backgroundColor: hex }}
              title={`${name} — set as ${effectiveMode}`}
            />
          );
        })}
      </div>
    </div>
  );
}
