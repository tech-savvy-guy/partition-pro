# Security_api/celery.py
import os
import ssl  # <-- important
from celery import Celery
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Security_api_settings.settings")

app = Celery("Security_api_settings")


def _build_redis_url(db: int = 0) -> str:
    """
    Build a Redis URL for Celery using the same settings
    as your existing Redis client.

    For SSL (rediss://), we MUST specify ssl_cert_reqs.
    """
    use_ssl = getattr(settings, "REDIS_SSL", False)
    scheme = "rediss" if use_ssl else "redis"

    host = getattr(settings, "REDIS_HOST", "localhost")
    port = getattr(settings, "REDIS_PORT", 6379)
    password = getattr(settings, "REDIS_PASSWORD", "")

    if password:
        auth_part = f":{password}@"
    else:
        auth_part = ""

    # If SSL, add the query parameter required by redis-py:
    # ssl_cert_reqs must be CERT_REQUIRED, CERT_OPTIONAL, or CERT_NONE
    if use_ssl:
        # You can switch to CERT_REQUIRED if you manage CA/certs.
        query = "?ssl_cert_reqs=CERT_NONE"
    else:
        query = ""

    return f"{scheme}://{auth_part}{host}:{port}/{db}{query}"


BROKER_DB = getattr(settings, "CELERY_BROKER_DB", 0)
RESULT_DB = getattr(settings, "CELERY_RESULT_DB", 1)

app.conf.broker_url = _build_redis_url(db=BROKER_DB)
app.conf.result_backend = _build_redis_url(db=RESULT_DB)

# Extra SSL options for Celery (recommended when using rediss)
if getattr(settings, "REDIS_SSL", False):
    app.conf.broker_transport_options = {
        "ssl_cert_reqs": ssl.CERT_NONE,  # or ssl.CERT_REQUIRED if you have CA certs
    }
    app.conf.redis_backend_use_ssl = {
        "ssl_cert_reqs": ssl.CERT_NONE,
    }

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
