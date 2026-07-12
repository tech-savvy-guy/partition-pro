# Known Issues And Repo Drift

This file tracks context that future Codex sessions should know before making assumptions. Update it when an item is fixed or when new drift is discovered.

## Current Drift

- Auto-break tree code appears partially integrated. There is an `auto_break_tree` service and tests referencing `AutoBreakPartitionTreeView`, `auto_break_partition_tree_task`, and `/tree/auto-break`, but the currently inspected `reports/urls.py`, `reports/views/workflow_api_views.py`, and `reports/tasks.py` did not expose the full route/view/task surface. Verify before building on this feature.
- Python version references differ. `Pipfile` requires Python 3.13, `README.md` says Python 3.13, while `.github/workflows/roi-azure-deployment.yml` configures Python 3.14. Align before relying on CI/runtime parity.
- Dependency manifests differ. `Pipfile`, `Pipfile.lock`, and `requirements.txt` do not appear perfectly synchronized. Confirm the intended install source before dependency work.
- The README includes some mojibake characters from box drawing/arrows. Avoid copying corrupted characters into new docs.
- Local `.env`, `.env-dev`, `.env-prod`, `Security_logs/`, and generated docs assets exist in the worktree. Treat them as sensitive or generated unless the user says otherwise.
- Celery task limits in settings and README may differ from long-running task decorators. Check both before changing timeouts.
- `start_workers.sh` and settings queue names should be verified together before worker deployment changes.
- The baseline dump includes `core.create_new_partition_vsy`, but that routine references `core.partitions_dataset_mapping`; the dumped table and Django model use `core.partitions_raw_dataset_mapping`. Keep the baseline unchanged for Azure dev parity, but fix or retire the routine in a later explicit migration after confirming whether it is still used.

## How To Handle Drift

- Do not silently "fix" unrelated drift during a focused task.
- If drift blocks the task, state the conflict and ask for direction.
- If drift is related to the task, fix it with tests/docs and note the change in this file.
- If drift is only discovered incidentally, leave it untouched and mention it in the handoff when relevant.
