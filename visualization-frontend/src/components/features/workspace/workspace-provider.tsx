import * as React from "react"

import type {
  VisualizationResult,
  VisualizationWorkflowStatus,
} from "@/core/api"
import { CaseMethodology, type WorkflowConfig } from "@/core/workflow"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"

/**
 * The visualization workflow as a single discriminated union instead of three
 * loosely-coupled fields (taskId / status / result). This makes impossible
 * states unrepresentable: a `completed` run always carries a result, a
 * `running` run is the only state that owns a poll `taskId`.
 */
export type VisualizationState =
  | { status: "idle" }
  | { status: "running"; phase: VisualizationWorkflowStatus; taskId: string | null }
  | { status: "completed"; result: VisualizationResult }
  | { status: "failed"; error?: string }

type RunModalState = { node: WorkflowNodeObject | null; title?: string } | null

type WorkspaceState = {
  primaryTab: string
  secondaryTab: string
  selectedSkus: string[]
  skuSelectionDirty: boolean
  search: string
  runModal: RunModalState
  visualization: VisualizationState
}

type WorkspaceAction =
  | { type: "selectPrimaryTab"; value: string }
  | { type: "selectSecondaryTab"; value: string }
  | { type: "setSearch"; value: string }
  | { type: "setSkuSelection"; value: React.SetStateAction<string[]> }
  | { type: "markSkuDirty"; value: boolean }
  | { type: "openRunModal"; node: WorkflowNodeObject | null; title?: string }
  | { type: "closeRunModal" }
  | { type: "startVisualization" }
  | {
      type: "setVisualizationRunning"
      phase: VisualizationWorkflowStatus
      taskId: string | null
    }
  | { type: "completeVisualization"; result: VisualizationResult }
  | { type: "failVisualization"; error?: string }
  | { type: "resetVisualization" }

type WorkspaceActions = {
  selectPrimaryTab: (value: string) => void
  selectSecondaryTab: (value: string) => void
  setSearch: (value: string) => void
  setSkuSelection: (value: React.SetStateAction<string[]>) => void
  markSkuDirty: (value: boolean) => void
  openRunModal: (node: WorkflowNodeObject | null, title?: string) => void
  closeRunModal: () => void
  startVisualization: () => void
  setVisualizationRunning: (
    phase: VisualizationWorkflowStatus,
    taskId: string | null
  ) => void
  completeVisualization: (result: VisualizationResult) => void
  failVisualization: (error?: string) => void
  resetVisualization: () => void
}

type WorkspaceMeta = {
  isVisualization: boolean
  visualizationUnlocked: boolean
  secondaryTabs: NonNullable<WorkflowConfig["secondaryTabsByPrimary"][string]>
}

type WorkspaceContextValue = {
  state: WorkspaceState
  actions: WorkspaceActions
  meta: WorkspaceMeta
}

/** Status string for presentational components that render a flat status. */
export function visualizationDisplayStatus(
  visualization: VisualizationState
): VisualizationWorkflowStatus | null {
  switch (visualization.status) {
    case "idle":
      return null
    case "running":
      return visualization.phase
    case "completed":
      return "COMPLETED"
    case "failed":
      return "FAILED"
  }
}

export function visualizationResultOf(
  visualization: VisualizationState
): VisualizationResult | null {
  return visualization.status === "completed" ? visualization.result : null
}

export function visualizationTaskIdOf(
  visualization: VisualizationState
): string | null {
  return visualization.status === "running" ? visualization.taskId : null
}

function reducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "selectPrimaryTab":
      return state.primaryTab === action.value
        ? state
        : { ...state, primaryTab: action.value }
    case "selectSecondaryTab":
      return state.secondaryTab === action.value
        ? state
        : { ...state, secondaryTab: action.value }
    case "setSearch":
      return { ...state, search: action.value }
    case "setSkuSelection": {
      const next =
        typeof action.value === "function"
          ? action.value(state.selectedSkus)
          : action.value
      return { ...state, selectedSkus: next }
    }
    case "markSkuDirty":
      return state.skuSelectionDirty === action.value
        ? state
        : { ...state, skuSelectionDirty: action.value }
    case "openRunModal":
      return { ...state, runModal: { node: action.node, title: action.title } }
    case "closeRunModal":
      return state.runModal === null ? state : { ...state, runModal: null }
    case "startVisualization":
      return {
        ...state,
        visualization: { status: "running", phase: "QUEUED", taskId: null },
      }
    case "setVisualizationRunning": {
      const current = state.visualization
      if (
        current.status === "running" &&
        current.phase === action.phase &&
        current.taskId === action.taskId
      ) {
        // Avoid re-render churn while polling returns the same RUNNING status.
        return state
      }
      return {
        ...state,
        visualization: {
          status: "running",
          phase: action.phase,
          taskId: action.taskId,
        },
      }
    }
    case "completeVisualization":
      return {
        ...state,
        visualization: { status: "completed", result: action.result },
      }
    case "failVisualization":
      return {
        ...state,
        visualization: { status: "failed", error: action.error },
      }
    case "resetVisualization":
      return state.visualization.status === "idle"
        ? state
        : { ...state, visualization: { status: "idle" } }
    default:
      return state
  }
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  workflow,
  methodology,
  children,
}: {
  workflow: WorkflowConfig
  methodology: string
  children: React.ReactNode
}) {
  const initialPrimaryTab = workflow.primaryTabs[0]?.value ?? ""
  const initialSecondaryTab =
    workflow.secondaryTabsByPrimary[initialPrimaryTab]?.[0]?.value ?? ""

  const [state, dispatch] = React.useReducer(reducer, undefined, () => ({
    primaryTab: initialPrimaryTab,
    secondaryTab: initialSecondaryTab,
    selectedSkus: [],
    skuSelectionDirty: false,
    search: "",
    runModal: null,
    visualization: { status: "idle" } as VisualizationState,
  }))

  // Setters from useReducer's dispatch are stable, so these actions never change
  // identity and never trigger re-renders on their own.
  const actions = React.useMemo<WorkspaceActions>(
    () => ({
      selectPrimaryTab: (value) => dispatch({ type: "selectPrimaryTab", value }),
      selectSecondaryTab: (value) =>
        dispatch({ type: "selectSecondaryTab", value }),
      setSearch: (value) => dispatch({ type: "setSearch", value }),
      setSkuSelection: (value) => dispatch({ type: "setSkuSelection", value }),
      markSkuDirty: (value) => dispatch({ type: "markSkuDirty", value }),
      openRunModal: (node, title) =>
        dispatch({ type: "openRunModal", node, title }),
      closeRunModal: () => dispatch({ type: "closeRunModal" }),
      startVisualization: () => dispatch({ type: "startVisualization" }),
      setVisualizationRunning: (phase, taskId) =>
        dispatch({ type: "setVisualizationRunning", phase, taskId }),
      completeVisualization: (result) =>
        dispatch({ type: "completeVisualization", result }),
      failVisualization: (error) =>
        dispatch({ type: "failVisualization", error }),
      resetVisualization: () => dispatch({ type: "resetVisualization" }),
    }),
    []
  )

  const secondaryTabs = React.useMemo(
    () => workflow.secondaryTabsByPrimary[state.primaryTab] ?? [],
    [state.primaryTab, workflow.secondaryTabsByPrimary]
  )
  const isVisualization =
    methodology.trim().toLowerCase() === CaseMethodology.Visualization
  const visualizationUnlocked = state.visualization.status === "completed"

  const meta = React.useMemo<WorkspaceMeta>(
    () => ({ isVisualization, visualizationUnlocked, secondaryTabs }),
    [isVisualization, visualizationUnlocked, secondaryTabs]
  )

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({ state, actions, meta }),
    [state, actions, meta]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider")
  }
  return context
}
