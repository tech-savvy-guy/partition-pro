from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from .base import run_step_calculation


@dataclass(frozen=True)
class WorkflowProcess:
    name: str
    steps: List[str]


PROCESS_WORKFLOW = WorkflowProcess(name="process_workflow", steps=['sku_selection','base_math','partition_tree'])
PROCESS_PARTITION_TREE = WorkflowProcess(name="process_partition_tree", steps=['partition_tree'])


def run_process_step(
    case_id: str,
    partition_id: str,
    step_name: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    # Keeps your existing calculators intact
    return run_step_calculation(case_id, partition_id, step_name, params)
