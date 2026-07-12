#!/bin/bash
set -e

echo "Starting Celery calc worker..."
cd /home/site/wwwroot

# Optional: verify env
python -V
celery --version

# Start worker (tune -c based on cores/RAM)
exec celery -A Security_api_settings worker -l info -Q calc -n calc@%h -c 4
