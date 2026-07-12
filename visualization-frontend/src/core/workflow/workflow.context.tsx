import { createContext, useContext, useMemo } from "react"

import { resolveWorkflow } from "./workflow.registry"
import type { WorkflowConfig } from "./workflow.types"

const WorkflowContext = createContext<WorkflowConfig | null>(null)

export function WorkflowProvider({
  methodology,
  children,
}: {
  methodology: string
  children: React.ReactNode
}) {
  const config = useMemo(() => resolveWorkflow(methodology), [methodology])
  return <WorkflowContext.Provider value={config}>{children}</WorkflowContext.Provider>
}

export function useWorkflow(): WorkflowConfig {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error("useWorkflow must be used inside WorkflowProvider")
  return ctx
}
