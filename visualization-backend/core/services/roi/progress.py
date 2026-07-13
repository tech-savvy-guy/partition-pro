import json
from typing import Any

from core.redis_client import get_redis_client


def roi_progress_key(case_id: str, partition_id: str, task_id: str) -> str:
    return f"roi_progress:case={case_id}:partition={partition_id}:task={task_id}"


def publish_roi_progress(
    case_id: str,
    partition_id: str,
    task_id: str,
    payload: dict[str, Any],
    ttl_seconds: int = 3600,
) -> None:
    client = get_redis_client()
    client.setex(
        roi_progress_key(case_id, partition_id, task_id),
        ttl_seconds,
        json.dumps(payload, default=str),
    )


def get_roi_progress(
    case_id: str,
    partition_id: str,
    task_id: str,
) -> dict[str, Any] | None:
    client = get_redis_client()
    cached = client.get(roi_progress_key(case_id, partition_id, task_id))
    if not cached:
        return None
    return json.loads(cached)


# --- per-node Base/Level Testing progress (polled by node id, not task id) ---


def node_testing_progress_key(case_id: str, partition_id: str, node_id: str) -> str:
    return (
        f"node_testing_progress:case={case_id}:partition={partition_id}:node={node_id}"
    )


def publish_node_testing_progress(
    case_id: str,
    partition_id: str,
    node_id: str,
    payload: dict[str, Any],
    ttl_seconds: int = 3600,
) -> None:
    client = get_redis_client()
    client.setex(
        node_testing_progress_key(case_id, partition_id, node_id),
        ttl_seconds,
        json.dumps(payload, default=str),
    )


def get_node_testing_progress(
    case_id: str,
    partition_id: str,
    node_id: str,
) -> dict[str, Any] | None:
    client = get_redis_client()
    cached = client.get(node_testing_progress_key(case_id, partition_id, node_id))
    if not cached:
        return None
    return json.loads(cached)
