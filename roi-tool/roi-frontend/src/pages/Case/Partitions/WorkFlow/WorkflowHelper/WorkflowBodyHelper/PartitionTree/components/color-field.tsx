import React, { useEffect, useRef, useState } from "react";
import { isValidHex } from "../utils/validation";

type ColorFieldProps = {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (hex: string) => void;
  onClear: () => void;
  action?: React.ReactNode;
};

export function ColorField({
  label,
  value,
  fallback,
  onChange,
  onClear,
  action,
}: ColorFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = (hex: string) => {
    if (isValidHex(hex)) onChange(hex);
  };

  const resolved = value && isValidHex(value) ? value : fallback;
  const isOverridden = value != null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-gray-500 font-medium">{label}</span>
        {isOverridden && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            title="Reset to default"
          >
            clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={resolved}
          onChange={(e) => {
            onChange(e.target.value);
            setDraft(e.target.value);
          }}
          className="w-8 h-8 rounded-sm cursor-pointer border border-gray-200 shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => {
            if (!isValidHex(draft)) setDraft(value ?? "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.blur();
          }}
          placeholder={fallback}
          className={`flex-1 min-w-0 px-2 py-1.5 text-[12px] font-mono rounded border bg-gray-50/50 outline-hidden transition-colors ${
            draft && !isValidHex(draft)
              ? "border-red-300 focus:border-red-400"
              : "border-gray-200 focus:border-gray-300 focus:bg-white"
          }`}
        />
        {action}
      </div>
    </div>
  );
}
