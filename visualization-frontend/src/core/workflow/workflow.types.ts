export type TabConfig = { label: string; value: string }

export const CaseMethodology = {
  Roi: "roi",
  Visualization: "visualization",
  Combined: "combined",
} as const

export type CaseMethodology =
  (typeof CaseMethodology)[keyof typeof CaseMethodology]

export type WorkflowConfig = {
  primaryTabs: TabConfig[]
  secondaryTabsByPrimary: Partial<Record<string, TabConfig[]>>
}
