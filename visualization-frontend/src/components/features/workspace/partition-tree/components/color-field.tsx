import React, { useEffect, useRef, useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { isValidHex } from "@/lib/partition-tree/utils/validation";
import { cn } from "@/lib/utils";
import { panelLabelClass } from "./panel-styles";

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
  const textRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = (hex: string) => {
    if (isValidHex(hex)) onChange(hex);
  };

  const resolved = value && isValidHex(value) ? value : fallback;
  const isOverridden = value != null;
  const invalid = Boolean(draft) && !isValidHex(draft);

  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn(panelLabelClass, "truncate")} title={label}>
        {label}
      </span>

      <div className="flex items-center gap-1.5">
        {/* Single pill: swatch + hex input share one bordered control */}
        <div
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-transparent pr-2 pl-1.5 transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
            invalid
              ? "border-destructive/50 focus-within:ring-destructive/20"
              : "border-input"
          )}
        >
          {/* Swatch — triggers the native colour picker */}
          <button
            type="button"
            onClick={() => colorRef.current?.click()}
            className="relative size-5 shrink-0 cursor-pointer rounded-[5px] ring-1 ring-inset ring-black/15 transition-transform active:scale-95 dark:ring-white/20"
            style={{ backgroundColor: resolved }}
            aria-label={`Pick colour for ${label}`}
            title="Pick colour"
          >
            <input
              ref={colorRef}
              type="color"
              value={resolved}
              onChange={(e) => {
                onChange(e.target.value);
                setDraft(e.target.value);
              }}
              tabIndex={-1}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </button>

          <input
            ref={textRef}
            type="text"
            value={draft}
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value);
              commit(e.target.value);
            }}
            onBlur={() => {
              if (!isValidHex(draft)) setDraft(value ?? "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") textRef.current?.blur();
            }}
            placeholder={fallback}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs uppercase outline-none placeholder:text-muted-foreground placeholder:normal-case"
          />
        </div>

        {isOverridden && (
          <button
            type="button"
            onClick={onClear}
            title="Reset to default"
            aria-label="Reset to default"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        )}

        {action}
      </div>
    </div>
  );
}
