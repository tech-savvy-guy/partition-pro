import {
  MAX_HEATMAP_DECIMAL_PLACES,
  MIN_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
} from "@/components/heatmap";

type Props = {
  value: number;
  onChange: (decimalPlaces: number) => void;
  label?: string;
};

export function HeatmapDecimalPlacesSelect({
  value,
  onChange,
  label = "Decimals",
}: Props) {
  const safeValue = clampHeatmapDecimalPlaces(value);
  const canDecrease = safeValue > MIN_HEATMAP_DECIMAL_PLACES;
  const canIncrease = safeValue < MAX_HEATMAP_DECIMAL_PLACES;

  const sample = (1.23456789).toFixed(safeValue);

  const stepBtn =
    "inline-flex h-6 w-6 items-center justify-center text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <span className="inline-flex items-center gap-2 text-gray-600">
      <span className="font-medium text-gray-700">{label}</span>

      <span className="inline-flex items-center overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
        <button
          type="button"
          className={stepBtn}
          onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue - 1))}
          disabled={!canDecrease}
          aria-label="Decrease decimal places"
          title="Fewer decimals"
        >
          <i className="pi pi-minus text-[10px]" />
        </button>

        <span
          className="flex h-6 min-w-[1.75rem] items-center justify-center border-x border-gray-200 px-1 text-[12px] font-semibold tabular-nums text-gray-900"
          aria-live="polite"
        >
          {safeValue}
        </span>

        <button
          type="button"
          className={stepBtn}
          onClick={() => onChange(clampHeatmapDecimalPlaces(safeValue + 1))}
          disabled={!canIncrease}
          aria-label="Increase decimal places"
          title="More decimals"
        >
          <i className="pi pi-plus text-[10px]" />
        </button>
      </span>
    </span>
  );
}
