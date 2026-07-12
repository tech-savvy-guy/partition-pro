import redis
from django.conf import settings

_redis_client = None


def get_redis_client():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None,
            ssl=settings.REDIS_SSL,
            socket_keepalive=True,
            health_check_interval=30,
            retry_on_timeout=True,
            decode_responses=True,
        )
    return _redis_client
