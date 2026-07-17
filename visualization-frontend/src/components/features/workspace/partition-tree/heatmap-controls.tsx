import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import {
  MAX_HEATMAP_DECIMAL_PLACES,
  MIN_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
} from "@/lib/partition-tree/heatmap";

type HeatmapStartStepEditorProps = {
  startLabel: string;
  stepLabel: string;
  startValue: number | null | undefined;
  stepValue: number | null | undefined;
  onSubmit: (next: { start: number; step: number }) => void;
  onReset?: () => void;
  inputStep?: number | "any";
};

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function HeatmapStartStepEditor({
  startLabel,
  stepLabel,
  startValue,
  stepValue,
  onSubmit,
  onReset,
}: HeatmapStartStepEditorProps) {
  const [startInput, setStartInput] = React.useState("");
  const [stepInput, setStepInput] = React.useState("");

  React.useEffect(() => {
    setStartInput(startValue == null || !Number.isFinite(startValue) ? "" : startValue.toFixed(2));
    setStepInput(stepValue == null || !Number.isFinite(stepValue) ? "" : stepValue.toFixed(2));
  }, [startValue, stepValue]);

  const handleBlurOrEnter = (valStart: string, valStep: string) => {
    const startNum = parseNumber(valStart);
    const stepNum = parseNumber(valStep);
    if (startNum != null && stepNum != null && stepNum > 0) {
      if (startNum !== startValue || stepNum !== stepValue) {
        onSubmit({ start: startNum, step: stepNum });
      }
    } else {
      // Revert if invalid
      setStartInput(startValue == null || !Number.isFinite(startValue) ? "" : startValue.toFixed(2));
      setStepInput(stepValue == null || !Number.isFinite(stepValue) ? "" : stepValue.toFixed(2));
    }
  };

  const cleanStartLabel = startLabel.split("(")[0].trim();

  return (
    <div className="inline-flex items-center gap-3 text-xs text-muted-foreground">
      <div className="inline-flex items-center gap-1">
        <span>{cleanStartLabel}</span>
        <input
          type="text"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          onBlur={() => handleBlurOrEnter(startInput, stepInput)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleBlurOrEnter(startInput, stepInput);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-10 bg-transparent text-foreground border-b border-border/80 focus:border-foreground/80 text-center outline-hidden h-6 p-0 font-semibold transition-colors"
        />
      </div>

      <div className="inline-flex items-center gap-1">
        <span>{stepLabel}</span>
        <input
          type="text"
          value={stepInput}
          onChange={(e) => setStepInput(e.target.value)}
          onBlur={() => handleBlurOrEnter(startInput, stepInput)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleBlurOrEnter(startInput, stepInput);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-10 bg-transparent text-foreground border-b border-border/80 focus:border-foreground/80 text-center outline-hidden h-6 p-0 font-semibold transition-colors"
        />
      </div>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export function HeatmapDecimalPlacesSelect({
  value,
  onChange,
  label = "Decimals",
}: {
  value: number;
  onChange: (decimalPlaces: number) => void;
  label?: string;
}) {
  const safeValue = clampHeatmapDecimalPlaces(value);
  const canDecrease = safeValue > MIN_HEATMAP_DECIMAL_PLACES;
  const canIncrease = safeValue < MAX_HEATMAP_DECIMAL_PLACES;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <button
        type="button"
        className="size-5 inline-flex cursor-pointer items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-medium"
        onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue - 1))}
        disabled={!canDecrease}
        aria-label="Decrease decimal places"
      >
        <MinusIcon className="size-3" />
      </button>
      <span className="w-4 text-center font-semibold text-foreground tabular-nums">
        {safeValue}
      </span>
      <button
        type="button"
        className="size-5 inline-flex cursor-pointer items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-medium"
        onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue + 1))}
        disabled={!canIncrease}
        aria-label="Increase decimal places"
      >
        <PlusIcon className="size-3" />
      </button>
    </span>
  );
}

