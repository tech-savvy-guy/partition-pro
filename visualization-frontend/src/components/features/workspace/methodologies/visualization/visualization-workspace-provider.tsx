import * as React from "react"

import type {
  VisualizationResult,
  VisualizationWorkflowStatus,
} from "@/core/api"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"

/**
 * Visualization run state as a discriminated union so impossible states are
 * unrepresentable: a completed run always carries a result, a running run is
 * the only state that owns a poll taskId.
 */
export type VisualizationState =
  | { status: "idle" }
  | {
      status: "running"
      phase: VisualizationWorkflowStatus
      taskId: string | null
    }
  | { status: "completed"; result: VisualizationResult }
  | { status: "failed"; error?: string }

type RunModalState = { node: WorkflowNodeObject | null; title?: string } | null

type VisualizationWorkspaceState = {
  runModal: RunModalState
  visualization: VisualizationState
}

type VisualizationWorkspaceAction =
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

type VisualizationWorkspaceActions = {
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

type VisualizationWorkspaceContextValue = {
  state: VisualizationWorkspaceState
  actions: VisualizationWorkspaceActions
}

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

function reducer(
  state: VisualizationWorkspaceState,
  action: VisualizationWorkspaceAction
): VisualizationWorkspaceState {
  switch (action.type) {
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

const VisualizationWorkspaceContext =
  React.createContext<VisualizationWorkspaceContextValue | null>(null)

export function VisualizationWorkspaceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, dispatch] = React.useReducer(reducer, undefined, () => ({
    runModal: null as RunModalState,
    visualization: { status: "idle" } as VisualizationState,
  }))

  const actions = React.useMemo<VisualizationWorkspaceActions>(
    () => ({
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

  const value = React.useMemo(
    () => ({ state, actions }),
    [state, actions]
  )

  return (
    <VisualizationWorkspaceContext.Provider value={value}>
      {children}
    </VisualizationWorkspaceContext.Provider>
  )
}

export function useVisualizationWorkspace() {
  const context = React.useContext(VisualizationWorkspaceContext)
  if (!context) {
    throw new Error(
      "useVisualizationWorkspace must be used inside VisualizationWorkspaceProvider"
    )
  }
  return context
}
