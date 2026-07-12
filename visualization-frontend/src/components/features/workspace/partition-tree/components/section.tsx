import React, { useState } from "react";
import { ChevronDown } from "../icons";
import { cn } from "@/lib/utils";

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

type SegmentedToggleProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[5px] px-2 py-0.5 text-[10px] font-medium capitalize transition-all",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  open: controlledOpen,
  onOpenChange,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen == null) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2.5 text-left transition-colors"
      >
        <span className="text-xs font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && <div className="space-y-3 pb-4">{children}</div>}
    </div>
  );
}
