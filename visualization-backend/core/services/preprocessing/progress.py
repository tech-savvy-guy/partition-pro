import json
from typing import Any

from core.redis_client import get_redis_client


def preprocessing_progress_key(case_id: str) -> str:
    return f"preprocess_progress:case={case_id}"


def publish_preprocessing_progress(
    case_id: str,
    payload: dict[str, Any],
    ttl_seconds: int = 3600,
) -> None:
    client = get_redis_client()
    client.setex(
        preprocessing_progress_key(case_id),
        ttl_seconds,
        json.dumps(payload, default=str),
    )


def get_preprocessing_progress(case_id: str) -> dict[str, Any] | None:
    client = get_redis_client()
    cached = client.get(preprocessing_progress_key(case_id))
    if not cached:
        return None
    return json.loads(cached)
