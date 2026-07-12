import React, { useState } from "react";
import { ChevronDown } from "@carbon/icons-react";

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

export function Section({ title, children }: SectionProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
        {title}
      </div>
      {children}
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

export function CollapsibleSection({ title, children, defaultOpen = true, badge, open: controlledOpen, onOpenChange }: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen == null) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className="border border-gray-100 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[9px] font-medium text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">{badge}</span>
          )}
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && <div className="px-3 py-3 space-y-3 bg-white">{children}</div>}
    </div>
  );
}
