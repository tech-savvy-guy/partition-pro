// workflow.api.ts
import { http } from "../http";
import { Endpoints } from "@/core/config";
import {
  WorkflowStagingQueryParams,
  WorkflowStagingResponse,
  RunWorkflowResponse,
  WorkflowStatusResponse,
} from "./workflow.types";

export const WorkflowApi = {
  getSkuSelection: (caseId: string, partitionId: string, params?: WorkflowStagingQueryParams) =>
    http.get<WorkflowStagingResponse>(Endpoints.workflows.skuSelection(caseId, partitionId), params),

  runProcess: (caseId: string, partitionId: string, processName: string, payload?: any) =>
    http.post<RunWorkflowResponse>(Endpoints.workflows.run(caseId, partitionId, processName), payload),

  getStatus: (caseId: string, partitionId: string) =>
    http.get<WorkflowStatusResponse>(Endpoints.workflows.status(caseId, partitionId)),
 
  runPartitionTree: (caseId: string, partitionId: string, nodeObj: any) =>
    http.post<any>(
      Endpoints.workflows.run(caseId, partitionId, "process_partition_tree"),
      { node_obj: nodeObj } ),

  attributeSelection: (caseId: string, partitionId: string, payload?: any) =>
    http.post<any>(Endpoints.workflows.attributeSelection(caseId, partitionId), payload),

  pollPartitionTreeNode: (caseId: string, partitionId: string, nodeId: string) =>
    http.get<any>(Endpoints.workflows.partitionTreeNode(caseId, partitionId, nodeId)),
  
  selectPartitionTreeAttribute: (
    caseId: string,
    partitionId: string,
    nodeId: string,
    attributeName: string
  ) =>
    http.post<any>(Endpoints.workflows.partitionTreeNode(caseId, partitionId, nodeId), {
      attribute_name: attributeName,
    }),

  deletePartitionTreeNode: (
    caseId: string,
    partitionId: string,
    nodeId: string,
  ) =>
    http.delete<any>(
      Endpoints.workflows.partitionTreeNode(caseId, partitionId, nodeId),
    ),

  previewRollup: (
    caseId: string,
    partitionId: string,
    body: {
      node_id: string;
      attribute_name: string;
      new_grouping_spec: Record<string, string[]>;
    },
  ) =>
    http.post<any>(Endpoints.workflows.previewRollup(caseId, partitionId), body),

  previewRollupStatus: (
    caseId: string,
    partitionId: string,
    previewId: string,
  ) =>
    http.get<any>(
      Endpoints.workflows.previewRollupStatus(caseId, partitionId, previewId),
    ),
};
