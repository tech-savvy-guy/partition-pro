export type TabConfig = { label: string; value: string }

export const CaseMethodology = {
  Roi: "roi",
  Visualization: "visualization",
  Combined: "combined",
} as const

export type CaseMethodology =
  (typeof CaseMethodology)[keyof typeof CaseMethodology]

/** Methodologies offered in the create/edit UI. Combined is reserved for a future workflow. */
export const SELECTABLE_METHODOLOGIES = [
  { label: "ROI", value: CaseMethodology.Roi },
  { label: "Visualization", value: CaseMethodology.Visualization },
] as const

export type WorkflowUnlockOn =
  | "sku-selection-saved"
  | "visualization-completed"

export type WorkflowSkuSubmitPipeline = "none" | "run-visualization"

export type WorkflowNodeRunMode =
  | "roi-testing-dialog"
  | "visualization-modal"

export type WorkflowConfig = {
  methodology: CaseMethodology
  primaryTabs: TabConfig[]
  secondaryTabsByPrimary: Partial<Record<string, TabConfig[]>>
  unlockOn: WorkflowUnlockOn
  skuSubmitPipeline: WorkflowSkuSubmitPipeline
  nodeRunMode: WorkflowNodeRunMode
  /** Primary/secondary tab values that depend on the ROI result pipeline. */
  roiTabs: string[]
}
