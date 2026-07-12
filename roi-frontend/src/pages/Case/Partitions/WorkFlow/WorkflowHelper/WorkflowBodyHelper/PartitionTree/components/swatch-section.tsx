import React, { useState } from "react";

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
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
          {title}
        </div>
        {!textOnly && (
          <div className="flex items-center rounded-full bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => setMode("fill")}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                mode === "fill"
                  ? "bg-white text-gray-800 shadow-xs"
                  : "text-gray-400 hover:text-gray-500"
              }`}
            >
              Fill
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                mode === "text"
                  ? "bg-white text-gray-800 shadow-xs"
                  : "text-gray-400 hover:text-gray-500"
              }`}
            >
              Text
            </button>
          </div>
        )}
      </div>
      <div
        className={`grid gap-2 ${
          size === "lg" ? "grid-cols-5" : "grid-cols-6 gap-1.5"
        }`}
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
              className={`w-full aspect-square rounded-md border transition-all hover:scale-105 ${
                size === "lg" ? "min-h-[32px]" : ""
              } ${
                active
                  ? "border-gray-900 ring-2 ring-[#dc2626]/40"
                  : "border-gray-200"
              }`}
              style={{ backgroundColor: hex }}
              title={`${name} — set as ${effectiveMode}`}
            />
          );
        })}
      </div>
    </div>
  );
}
