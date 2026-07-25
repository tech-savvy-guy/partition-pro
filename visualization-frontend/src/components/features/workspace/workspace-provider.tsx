import * as React from "react"

import type { WorkflowConfig } from "@/core/workflow"
import type { PartitionLockLifecycle } from "./shared/use-partition-lock"

type WorkspaceState = {
  primaryTab: string
  secondaryTab: string
  selectedSkus: string[]
  skuSelectionDirty: boolean
  /** A SKU selection has been saved at least once for this partition. */
  skuSelectionSaved: boolean
  search: string
  /** Visualization methodology: unlocked once its workflow completes. */
  visualizationCompleted: boolean
}

type WorkspaceAction =
  | { type: "selectPrimaryTab"; value: string }
  | { type: "selectSecondaryTab"; value: string }
  | { type: "setSearch"; value: string }
  | { type: "setSkuSelection"; value: React.SetStateAction<string[]> }
  | { type: "markSkuDirty"; value: boolean }
  | { type: "markSkuSelectionSaved"; value: boolean }
  | { type: "markVisualizationCompleted"; value: boolean }

type WorkspaceActions = {
  selectPrimaryTab: (value: string) => void
  selectSecondaryTab: (value: string) => void
  setSearch: (value: string) => void
  setSkuSelection: (value: React.SetStateAction<string[]>) => void
  markSkuDirty: (value: boolean) => void
  markSkuSelectionSaved: (value: boolean) => void
  markVisualizationCompleted: (value: boolean) => void
}

type WorkspaceMeta = {
  /** Whether post-selection tabs (partition-tree, MDS, etc.) are unlocked. */
  postSelectionUnlocked: boolean
  secondaryTabs: NonNullable<WorkflowConfig["secondaryTabsByPrimary"][string]>
  canEditPartition: boolean
  partitionLock: PartitionLockLifecycle
  onRetryPartitionLock: () => void
}

type WorkspaceContextValue = {
  state: WorkspaceState
  actions: WorkspaceActions
  meta: WorkspaceMeta
  workflow: WorkflowConfig
}

function reducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
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
    case "markSkuSelectionSaved":
      return state.skuSelectionSaved === action.value
        ? state
        : { ...state, skuSelectionSaved: action.value }
    case "markVisualizationCompleted":
      return state.visualizationCompleted === action.value
        ? state
        : { ...state, visualizationCompleted: action.value }
    default:
      return state
  }
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  workflow,
  canEditPartition,
  partitionLock,
  onRetryPartitionLock,
  children,
}: {
  workflow: WorkflowConfig
  canEditPartition: boolean
  partitionLock: PartitionLockLifecycle
  onRetryPartitionLock: () => void
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
    skuSelectionSaved: false,
    search: "",
    visualizationCompleted: false,
  }))

  const actions = React.useMemo<WorkspaceActions>(
    () => ({
      selectPrimaryTab: (value) =>
        dispatch({ type: "selectPrimaryTab", value }),
      selectSecondaryTab: (value) =>
        dispatch({ type: "selectSecondaryTab", value }),
      setSearch: (value) => dispatch({ type: "setSearch", value }),
      setSkuSelection: (value) => dispatch({ type: "setSkuSelection", value }),
      markSkuDirty: (value) => dispatch({ type: "markSkuDirty", value }),
      markSkuSelectionSaved: (value) =>
        dispatch({ type: "markSkuSelectionSaved", value }),
      markVisualizationCompleted: (value) =>
        dispatch({ type: "markVisualizationCompleted", value }),
    }),
    []
  )

  const secondaryTabs = React.useMemo(
    () => workflow.secondaryTabsByPrimary[state.primaryTab] ?? [],
    [state.primaryTab, workflow.secondaryTabsByPrimary]
  )

  const postSelectionUnlocked =
    workflow.unlockOn === "visualization-completed"
      ? state.visualizationCompleted
      : state.skuSelectionSaved

  const meta = React.useMemo<WorkspaceMeta>(
    () => ({
      postSelectionUnlocked,
      secondaryTabs,
      canEditPartition,
      partitionLock,
      onRetryPartitionLock,
    }),
    [
      canEditPartition,
      onRetryPartitionLock,
      partitionLock,
      postSelectionUnlocked,
      secondaryTabs,
    ]
  )

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({ state, actions, meta, workflow }),
    [state, actions, meta, workflow]
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
