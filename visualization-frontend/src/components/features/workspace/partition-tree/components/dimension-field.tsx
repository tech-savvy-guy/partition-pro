import React, { useEffect, useRef, useState } from "react";
import { panelLabelClass, panelMonoInputClass } from "./panel-styles";

type DimensionFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
};

export function DimensionField({
  label,
  value,
  onChange,
  min = 1,
}: DimensionFieldProps) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current !== document.activeElement) {
      setDraft(String(Math.round(value)));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setDraft("");
      return;
    }
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly === "") {
      return;
    }
    setDraft(digitsOnly);
  };

  const commit = () => {
    const v = parseInt(draft, 10);
    if (draft === "" || Number.isNaN(v) || v < min) {
      setDraft(String(Math.round(value)));
      return;
    }
    onChange(v);
    setDraft(String(v));
  };

  return (
    <div>
      <span className={`${panelLabelClass} mb-1.5 block`}>{label}</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            inputRef.current?.blur();
          }
        }}
        placeholder={`min ${min}`}
        className={panelMonoInputClass}
      />
    </div>
  );
}

type NumericFieldProps = {
  label: string;
  value: number | undefined;
  fallback: number;
  unit?: string;
  min?: number;
  onChange: (v: number | undefined) => void;
};

export function NumericField({
  label,
  value,
  fallback,
  unit = "",
  min = 0,
  onChange,
}: NumericFieldProps) {
  const displayValue = value ?? fallback;
  const [draft, setDraft] = useState(String(displayValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current !== document.activeElement) {
      setDraft(String(value ?? fallback));
    }
  }, [value, fallback]);

  const commit = () => {
    if (draft === "") {
      onChange(undefined);
      setDraft(String(fallback));
      return;
    }
    const v = parseFloat(draft);
    if (Number.isNaN(v) || v < min) {
      setDraft(String(value ?? fallback));
      return;
    }
    onChange(v === fallback ? undefined : v);
    setDraft(String(v));
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={panelLabelClass}>{label}</span>
        {value != null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {value}
            {unit}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            inputRef.current?.blur();
          }
        }}
        className={panelMonoInputClass}
      />
    </div>
  );
}
