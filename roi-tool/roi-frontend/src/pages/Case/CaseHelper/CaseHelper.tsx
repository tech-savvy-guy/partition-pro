import { CaseStatus, TagType } from "@/core/api";

export const toUiStatus = (backendStatus: unknown): CaseStatus => {
  const s = String(backendStatus ?? "").toUpperCase();

  // map common backend statuses to your UI statuses
  if (s === "CLOSED" || s === "ARCHIVED") return "Closed";
  if (s === "PAUSED") return "Paused";
  // default bucket

  return "Active";
};
// ---- Helpers ----
export const statusToTagType = (s: CaseStatus): TagType =>
  s === "Active" ? "green" : s === "Closed" ? "red" : "gray";
