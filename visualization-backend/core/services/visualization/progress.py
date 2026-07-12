import json
from typing import Any

from core.redis_client import get_redis_client


def visualization_progress_key(case_id: str, partition_id: str, task_id: str) -> str:
    return f"visualization_progress:case={case_id}:partition={partition_id}:task={task_id}"


def publish_visualization_progress(
    case_id: str,
    partition_id: str,
    task_id: str,
    payload: dict[str, Any],
    ttl_seconds: int = 3600,
) -> None:
    client = get_redis_client()
    client.setex(
        visualization_progress_key(case_id, partition_id, task_id),
        ttl_seconds,
        json.dumps(payload, default=str),
    )


def get_visualization_progress(
    case_id: str,
    partition_id: str,
    task_id: str,
) -> dict[str, Any] | None:
    client = get_redis_client()
    cached = client.get(visualization_progress_key(case_id, partition_id, task_id))
    if not cached:
        return None
    return json.loads(cached)
