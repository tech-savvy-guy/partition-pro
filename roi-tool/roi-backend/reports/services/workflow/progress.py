# reports/services/workflow/progress.py
import json
from typing import Any, Dict
from uuid import uuid4

from ...redis_client import get_redis_client


def workflow_progress_key(case_id: str, partition_id: str) -> str:
    # stable "current" key
    return f"workflow_progress:case={case_id}:partition={partition_id}"

def partition_tree_progress_key(case_id: str, partition_id: str, node_id:str) -> str:
    # stable "current" key
    return f"partition_tree_progress:case={case_id}:partition={partition_id}:node_id={node_id}"

def workflow_progress_run_key(case_id: str, partition_id: str, run_id: str) -> str:
    # optional run-specific storage
    return f"workflow_progress_run:{run_id}:case={case_id}:partition={partition_id}"

def workflow_progress_lock_key(case_id: str, partition_id: str) -> str:
    return f"workflow_progress_lock:case={case_id}:partition={partition_id}"

def clear_workflow_progress(case_id: str, partition_id: str) -> None:
    """
    Removes the current progress snapshot so reruns don't show stale progress.
    """
    client = get_redis_client()
    client.delete(workflow_progress_key(case_id, partition_id))

def clear_partition_tree_progress(case_id: str, partition_id: str, node_id: str) -> None:
    """
    Removes the current progress snapshot so reruns don't show stale progress.
    """
    client = get_redis_client()
    client.delete(partition_tree_progress_key(case_id, partition_id, node_id))


def clear_all_partition_tree_progress(case_id: str, partition_id: str) -> None:
    """
    Removes all partition-tree progress snapshots for a case+partition.
    """
    client = get_redis_client()
    pattern = f"partition_tree_progress:case={case_id}:partition={partition_id}:node_id=*"
    keys = list(client.scan_iter(match=pattern))
    if keys:
        client.delete(*keys)

def publish_progress(case_id: str, partition_id: str, payload: Dict[str, Any], ttl_seconds: int = 3600) -> None:
    client = get_redis_client()
    key = workflow_progress_key(case_id, partition_id)
    client.setex(key, ttl_seconds, json.dumps(payload))

def partition_tree_publish_progress(case_id: str, partition_id: str, node_id: str, payload: Dict[str, Any], ttl_seconds: int = 3600) -> None:
    client = get_redis_client()
    key = partition_tree_progress_key(case_id, partition_id, node_id)
    client.setex(key, ttl_seconds, json.dumps(payload))
