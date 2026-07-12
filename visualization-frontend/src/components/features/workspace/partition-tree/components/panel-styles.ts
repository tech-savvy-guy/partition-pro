import { cn } from "@/lib/utils";

export const panelLabelClass = "text-[11px] font-medium text-muted-foreground";

export const panelMutedLabelClass =
  "text-[10px] font-medium text-muted-foreground";

export const panelInputClass =
  "w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export const panelMonoInputClass = cn(panelInputClass, "font-mono");

export function panelOptionClass(active: boolean) {
  return cn(
    "h-7 rounded-md border text-xs font-medium capitalize transition-colors",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}

export const panelResetClass =
  "text-[11px] font-medium text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-40";

export const panelHeaderClass =
  "flex h-10 shrink-0 items-center justify-between border-b border-border px-4";

export const panelHeaderTitleClass = "text-sm font-medium text-foreground";

export const panelFooterClass =
  "flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5";
