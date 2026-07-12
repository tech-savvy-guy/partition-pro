import React from "react";
import type { WorkflowMode } from "./WorkflowHeader";

type Props = {
  workflowMode: WorkflowMode;
  availableWorkflowModes: WorkflowMode[];
  onWorkflowModeChange?: (mode: WorkflowMode) => void;
  /** Light background (secondary tab row) vs dark hero */
  variant?: "dark" | "light";
};

export default function WorkflowModeSwitch({
  workflowMode,
  availableWorkflowModes,
  onWorkflowModeChange,
  variant = "dark",
}: Props) {
  if (availableWorkflowModes.length <= 1) return null;

  return (
    <div
      className={[
        "workflow-mode-switch",
        variant === "light" ? "workflow-mode-switch--light" : "",
      ].join(" ")}
      aria-label="Workflow mode"
    >
      <button
        type="button"
        className={[
          "workflow-mode-switch__item",
          workflowMode === "roi" ? "is-active" : "",
        ].join(" ")}
        disabled={!availableWorkflowModes.includes("roi")}
        onClick={() => onWorkflowModeChange?.("roi")}
      >
        ROI
      </button>
      <button
        type="button"
        className={[
          "workflow-mode-switch__item",
          workflowMode === "visual" ? "is-active" : "",
        ].join(" ")}
        disabled={!availableWorkflowModes.includes("visual")}
        onClick={() => onWorkflowModeChange?.("visual")}
      >
        2D / 3D
      </button>
    </div>
  );
}
