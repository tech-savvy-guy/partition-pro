import { CaseMethodology, type WorkflowConfig } from "./workflow.types"

const roiWorkflow: WorkflowConfig = {
  primaryTabs: [
    { label: "SKU Selection", value: "sku-selection" },
    { label: "SKU Math", value: "sku-math" },
    { label: "Partition Tree", value: "partition-tree" },
    { label: "OBM", value: "obm" },
  ],
  secondaryTabsByPrimary: {
    "sku-selection": [
      { label: "Overview", value: "overview" },
      { label: "Compare Coverage", value: "compare-coverage" },
    ],
  },
}

const WORKFLOW_REGISTRY: Record<CaseMethodology, WorkflowConfig> = {
  [CaseMethodology.Roi]: roiWorkflow,
  [CaseMethodology.Visualization]: {
    primaryTabs: [
      { label: "SKU Selection", value: "sku-selection" },
      { label: "Partition Tree", value: "partition-tree" },
    ],
    secondaryTabsByPrimary: {
      "sku-selection": [
        { label: "Overview", value: "overview" },
        { label: "Multi Dimensional Scaling", value: "multi-dimensional-scaling" },
        { label: "Compare Coverage", value: "compare-coverage" },
      ],
    },
  },
  // Combined methodology is intentionally mapped to ROI until its workflow is defined.
  [CaseMethodology.Combined]: roiWorkflow,
}

export function resolveWorkflow(methodology: string): WorkflowConfig {
  const normalizedMethodology = methodology.trim().toLowerCase()

  if (isCaseMethodology(normalizedMethodology)) {
    return WORKFLOW_REGISTRY[normalizedMethodology]
  }

  return WORKFLOW_REGISTRY[CaseMethodology.Roi]
}

function isCaseMethodology(value: string): value is CaseMethodology {
  return Object.values(CaseMethodology).includes(value as CaseMethodology)
}
