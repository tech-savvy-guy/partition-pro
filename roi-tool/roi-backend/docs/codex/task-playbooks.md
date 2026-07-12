# Task Playbooks

Use these playbooks as checklists. They do not replace reading the relevant code.

## Add Or Change An API Endpoint

1. Inspect existing routes in `Security_api/urls.py` or `reports/urls.py`.
2. Read nearby views and serializers for response shape and permission patterns.
3. Define validation, status codes, auth requirements, and async behavior before editing.
4. Add or update serializers when payload shape is stable or reused.
5. Keep route naming consistent with existing versioned paths.
6. Add focused tests for route resolution, validation, permissions, and response shape.
7. Update Bruno examples and Codex docs if the contract changes.

## Add Or Change A Workflow Step

1. Read `reports/services/workflow/base.py`, `processes.py`, `state.py`, and the existing step module.
2. Identify required inputs from case, partition, selected datasets, preprocessed rows, and workflow data.
3. Keep calculation logic in a service function registered as a step calculator.
4. Persist outputs through existing workflow state helpers.
5. Publish progress consistently and handle failure states.
6. Add focused unit tests for calculation logic and orchestration behavior.
7. Update `business-context.md`, `architecture.md`, and Bruno examples if external behavior changes.

## Add Or Change Dataset Ingestion

1. Read `reports/services/ingestion/` and dataset views before editing.
2. Identify the dataset type, required columns, metadata records, target raw table, and selected-version behavior.
3. Validate input before bulk writes.
4. Keep status transitions and error tags accurate.
5. Avoid logging raw data or secrets.
6. Add tests for valid input, missing columns, bad values, and failure status handling.
7. Update `.env.example`, docs, and API examples if storage or confirm behavior changes.

## Add Or Change A Celery Task

1. Check `reports/tasks.py` and `CELERY_TASK_ROUTES` in settings.
2. Choose the queue intentionally and document any new queue.
3. Pass IDs and small payloads to tasks; fetch heavy data inside the worker.
4. Make retry, timeout, status, and progress behavior explicit.
5. Ensure Redis failure does not destroy the only source of truth.
6. Add tests around task helper logic and queueing behavior where practical.
7. Update worker/deployment docs when routing changes.

## Change Data Models Or Schema Assumptions

1. Determine whether the model is Django-managed or unmanaged.
2. For Django-managed tables, change the model first and use normal Django migration practices.
3. For SQL-managed application tables such as unmanaged `core` tables, use a reviewed `db_schema` `RunSQL` migration for the database DDL and update matching unmanaged model fields manually.
4. Confirm real database schema assumptions before changing fields or constraints.
5. Update serializers, views, tests, Bruno examples, and docs together.

## Fix A Bug

1. Reproduce or isolate the failing behavior with the smallest practical test or inspection.
2. Identify whether the bug is in API validation, data access, workflow calculation, async orchestration, or docs.
3. Add or update a focused regression test when feasible.
4. Keep the fix narrow.
5. Report any behavior that could not be validated locally because it depends on Azure, Redis, or production-like Postgres.

## Docs-Only Change

1. Keep docs factual and aligned with code.
2. Mark unknown business rules as open questions instead of guessing.
3. Link to existing README, docs, and Bruno examples where that avoids duplication.
4. Search new docs for secret-like strings before handoff.
5. No Django runtime tests are required unless code also changed.
