#!/bin/bash
set -eo pipefail

log(){ echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
cd "$(dirname "$0")" || exit 1
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-Security_api_settings.settings}"
PYTHON_BIN="${PYTHON_BIN:-python}"

log "[boot] Starting Celery workers..."
log "[boot] Python: $($PYTHON_BIN -V 2>&1)"
log "[boot] Working dir: $(pwd)"
log "[boot] DJANGO_SETTINGS_MODULE=$DJANGO_SETTINGS_MODULE"

# Optional: improves celery log richness without CLI logformat/dateformat
export CELERYD_LOG_LEVEL="${CELERY_LOG_LEVEL:-INFO}"

run_worker () {
  local name="$1"
  local queue="$2"
  local conc="$3"

  while true; do
    log "[$name] Starting worker queue=$queue concurrency=$conc host=$(hostname)"

    set +e
    $PYTHON_BIN -m celery -A Security_api_settings.celery:app worker \
      -l "${CELERY_LOG_LEVEL:-info}" \
      -E \
      -Q "$queue" \
      -n "${name}@%h" \
      -c "$conc" \
      2>&1 | sed -u "s/^/[$name] /"
    exit_code=${PIPESTATUS[0]}
    set -e

    log "[$name] Worker exited code=$exit_code; restarting in 5s..."
    sleep 5
  done
}

run_worker "calc"   "calc"   "${CELERY_CALC_CONCURRENCY:-4}" &
calc_sup=$!
run_worker "ingest" "ingest" "${CELERY_INGEST_CONCURRENCY:-1}" &
ingest_sup=$!

log "[boot] calc supervisor PID=$calc_sup"
log "[boot] ingest supervisor PID=$ingest_sup"

trap 'log "[boot] SIGTERM/SIGINT received, stopping..."; kill $calc_sup $ingest_sup 2>/dev/null || true; wait || true' SIGTERM SIGINT

wait
