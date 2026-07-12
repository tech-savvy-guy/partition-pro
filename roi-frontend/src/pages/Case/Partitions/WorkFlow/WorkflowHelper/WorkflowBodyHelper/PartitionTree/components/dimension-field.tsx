import React, { useEffect, useRef, useState } from "react";

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
      <span className="text-[11px] text-gray-500 font-medium block mb-1.5">
        {label}
      </span>
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
        className="w-full px-2 py-1.5 text-[12px] font-mono rounded-sm border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-300 outline-hidden transition-colors"
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
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500 font-medium">{label}</span>
        {value != null && (
          <span className="text-[11px] font-mono text-gray-400">
            {value}{unit}
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
        className="w-full px-2 py-1.5 text-[12px] font-mono rounded-sm border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-300 outline-hidden transition-colors"
      />
    </div>
  );
}
