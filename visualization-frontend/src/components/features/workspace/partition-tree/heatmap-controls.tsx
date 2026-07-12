import * as React from "react";
import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react";

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
  inputStep?: number | "any";
};

function displayValue(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "-" : value.toFixed(2);
}

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
  inputStep = "any",
}: HeatmapStartStepEditorProps) {
  const [editing, setEditing] = React.useState(false);
  const [draftStart, setDraftStart] = React.useState("");
  const [draftStep, setDraftStep] = React.useState("");

  const openEditor = () => {
    setDraftStart(startValue == null ? "" : String(startValue));
    setDraftStep(stepValue == null ? "" : String(stepValue));
    setEditing(true);
  };

  const startNumber = parseNumber(draftStart);
  const stepNumber = parseNumber(draftStep);
  const valid = startNumber != null && stepNumber != null && stepNumber > 0;

  const submit = () => {
    if (!valid || startNumber == null || stepNumber == null) return;
    onSubmit({ start: startNumber, step: stepNumber });
    setEditing(false);
  };

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-600">
        <span>
          {startLabel}:{" "}
          <b className="text-gray-900">{displayValue(startValue)}</b>
        </span>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded hover:bg-gray-100"
          onClick={openEditor}
          aria-label="Edit heatmap start"
        >
          <PencilIcon className="size-3" />
        </button>
        <span className="text-gray-400">|</span>
        <span>
          {stepLabel}: <b className="text-gray-900">{displayValue(stepValue)}</b>
        </span>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded hover:bg-gray-100"
          onClick={openEditor}
          aria-label="Edit heatmap step"
        >
          <PencilIcon className="size-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-gray-600">
      <span>{startLabel}:</span>
      <input
        className="h-7 w-[90px] rounded border border-gray-300 px-2 text-[12px]"
        type="number"
        step="any"
        value={draftStart}
        onChange={(event) => setDraftStart(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
          if (event.key === "Escape") setEditing(false);
        }}
      />
      <span>{stepLabel}:</span>
      <input
        className="h-7 w-[90px] rounded border border-gray-300 px-2 text-[12px]"
        type="number"
        step={inputStep === "any" ? "any" : String(inputStep)}
        min={0}
        value={draftStep}
        onChange={(event) => setDraftStep(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
          if (event.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        className="h-7 rounded-md bg-gray-900 px-2 text-[12px] font-semibold text-white disabled:opacity-50"
        disabled={!valid}
        onClick={submit}
      >
        Submit
      </button>
      <button
        type="button"
        className="h-7 rounded-md border border-gray-300 px-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
    </span>
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
    <span className="inline-flex items-center gap-2 text-gray-600">
      <span className="font-medium text-gray-700">{label}</span>
      <span className="inline-flex items-center overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue - 1))}
          disabled={!canDecrease}
          aria-label="Decrease decimal places"
        >
          <MinusIcon className="size-3" />
        </button>
        <span className="flex h-6 min-w-7 items-center justify-center border-x border-gray-200 px-1 text-[12px] font-semibold tabular-nums text-gray-900">
          {safeValue}
        </span>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue + 1))}
          disabled={!canIncrease}
          aria-label="Increase decimal places"
        >
          <PlusIcon className="size-3" />
        </button>
      </span>
    </span>
  );
}
