import json
import redis
from django.conf import settings

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            ssl=settings.REDIS_SSL,
            # socket_connect_timeout=5,
            # socket_timeout=5,
            socket_keepalive=True,
            health_check_interval=30,
            retry_on_timeout=True,
            decode_responses=True
        )
    return _redis_client


def enqueue_dataset_ingest_task(payload: dict):
    """
    Push a task onto the Redis queue as a JSON string.
    """
    client = get_redis_client()
    task_json = json.dumps(payload)
    client.lpush("dataset_ingest_queue", task_json)
