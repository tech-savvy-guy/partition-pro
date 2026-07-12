import * as React from "react";

type Props = {
  startLabel: string;
  stepLabel: string;

  startValue: number | null | undefined;
  stepValue: number | null | undefined;

  onSubmit: (next: { start: number; step: number }) => void;

  /** Optional: allow decimals (default: "any") */
  inputStep?: number | "any";
};

function toDisplay(v: number | null | undefined) {
  return v == null || !Number.isFinite(v) ? "-" : v.toFixed(2);
}

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Inline editor:
 * - default view shows Start/Step + pencil icons
 * - click pencil -> inputs + Submit/Cancel
 * - Submit calls parent, parent updates meta/preset and heatmap updates automatically
 */
export function HeatmapStartStepEditor({
  startLabel,
  stepLabel,
  startValue,
  stepValue,
  onSubmit,
  inputStep = "any",
}: Props) {
  const [editing, setEditing] = React.useState(false);
  const [draftStart, setDraftStart] = React.useState<string>("");
  const [draftStep, setDraftStep] = React.useState<string>("");

  const openEditor = React.useCallback(() => {
    setDraftStart(startValue == null ? "" : String(startValue));
    setDraftStep(stepValue == null ? "" : String(stepValue));
    setEditing(true);
  }, [startValue, stepValue]);

  const closeEditor = React.useCallback(() => {
    setEditing(false);
  }, []);

  const startNum = parseNum(draftStart);
  const stepNum = parseNum(draftStep);
  const isValid = startNum != null && stepNum != null && stepNum > 0;

  const submit = React.useCallback(() => {
    if (!isValid || startNum == null || stepNum == null) return;
    onSubmit({ start: startNum, step: stepNum });
    setEditing(false);
  }, [isValid, onSubmit, startNum, stepNum]);

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") closeEditor();
  };

  const iconBtn =
    "inline-flex items-center justify-center h-6 w-6 rounded hover:bg-gray-100 text-gray-600";

  const inputCls =
    "h-7 w-[90px] rounded border border-gray-300 px-2 text-[12px] text-gray-900";

  const submitCls =
    "h-7 rounded-md px-2 text-[12px] font-semibold text-white bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";

  const cancelCls =
    "h-7 rounded-md px-2 text-[12px] font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50";

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-600">
        <span>
          {startLabel}: <b className="text-gray-900">{toDisplay(startValue)}</b>
        </span>
        <button type="button" className={iconBtn} onClick={openEditor} aria-label="Edit start">
          <i className="pi pi-pencil text-[12px]" />
        </button>

        <span className="text-gray-400">|</span>

        <span>
          {stepLabel}: <b className="text-gray-900">{toDisplay(stepValue)}</b>
        </span>
        <button type="button" className={iconBtn} onClick={openEditor} aria-label="Edit step">
          <i className="pi pi-pencil text-[12px]" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-gray-600">
      <span className="text-gray-600">{startLabel}:</span>
      <input
        className={inputCls}
        type="number"
        step="any"
        value={draftStart}
        onChange={(e) => setDraftStart(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Start value"
      />

      <span className="text-gray-600">{stepLabel}:</span>
      <input
        className={inputCls}
        type="number"
        step={inputStep === "any" ? "any" : String(inputStep)}
        min={0}
        value={draftStep}
        onChange={(e) => setDraftStep(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Step value"
      />

      <button type="button" className={submitCls} disabled={!isValid} onClick={submit}>
        Submit
      </button>

      <button type="button" className={cancelCls} onClick={closeEditor}>
        Cancel
      </button>

      {!isValid ? (
        <span className="text-[11px] text-gray-500">
          (Enter valid numbers; Step must be &gt; 0)
        </span>
      ) : null}
    </span>
  );
}
