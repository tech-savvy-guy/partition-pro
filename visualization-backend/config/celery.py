import os
import ssl
import sys

from celery import Celery
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Celery's default prefork (billiard) pool is not supported on Windows: the
# spawned pool workers crash on startup with "OSError: [WinError 6] The handle
# is invalid". Fall back to the solo pool there so the worker can run locally.
# An explicit `--pool=...` on the command line still overrides this.
if sys.platform == "win32":
    os.environ.setdefault("FORKED_BY_MULTIPROCESSING", "1")

app = Celery("config")

if sys.platform == "win32":
    app.conf.worker_pool = "solo"


def _build_redis_url(db: int = 0) -> str:
    scheme = "rediss" if getattr(settings, "REDIS_SSL", False) else "redis"
    host = getattr(settings, "REDIS_HOST", "localhost")
    port = getattr(settings, "REDIS_PORT", 6379)
    password = getattr(settings, "REDIS_PASSWORD", "")
    auth_part = f":{password}@" if password else ""
    query = "?ssl_cert_reqs=CERT_NONE" if getattr(settings, "REDIS_SSL", False) else ""
    return f"{scheme}://{auth_part}{host}:{port}/{db}{query}"


app.conf.broker_url = _build_redis_url(getattr(settings, "CELERY_BROKER_DB", 0))
app.conf.result_backend = _build_redis_url(getattr(settings, "CELERY_RESULT_DB", 1))

if getattr(settings, "REDIS_SSL", False):
    app.conf.broker_transport_options = {"ssl_cert_reqs": ssl.CERT_NONE}
    app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
