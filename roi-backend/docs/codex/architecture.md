# Architecture

The ROI Backend is a Django REST Framework service with a Celery/Redis async layer, Azure Blob Storage for dataset transfer, and PostgreSQL for application and analytical state. Most domain tables live in a pre-existing `core` schema and are represented by unmanaged Django models.

## Runtime Components

- Django API: Serves `/security/v1.0/` and `/reports/v1.0/`.
- PostgreSQL: Stores users/roles plus unmanaged `core` schema records for cases, partitions, datasets, workflows, and raw/preprocessed data.
- Redis: Used as Celery broker/result backend and Django cache/progress channel.
- Celery workers: Run ingestion, workflow, partition tree, OBM, and virtual rollup tasks.
- Azure Blob Storage: Stores uploaded CSV datasets. Clients upload directly through SAS URLs.
- Azure App Service and WebJobs: Current deployment model for API and worker execution.

## Django Apps

### `Security_api_settings`

Project-level settings, root URL routing, WSGI entrypoint, and Celery app configuration. Settings currently read `.env` when present, configure RS256 JWT keys, Postgres SSL, Redis SSL, CORS, Celery queues, cache, and logging.

### `Security_api`

Authentication and identity app. It owns custom `User` and `Role` models, login/logout/refresh/me/user/role APIs, JWT behavior, and input sanitization middleware.

### `reports`

Main PartitionPro domain app. It owns case, partition, dataset, workflow, staging, and partition tree APIs. It also contains Celery task definitions and domain services for ingestion and workflows.

### `db_schema`

Migration-only app for application-owned PostgreSQL schemas, routines, views, partition DDL, and special indexes that are tracked through Django migrations but not represented as normal Django model operations.

## Data Model Boundaries

- Django-managed tables include auth, roles, users, and token blacklist tables.
- Unmanaged `core` schema tables include cases, partitions, workflows, dataset metadata, raw datasets, preprocessed outputs, and assignment tables.
- Do not create Django migrations for unmanaged `core` tables unless the task explicitly changes database ownership and deployment strategy.
- ADR 0002 records the team decision that application-owned database objects are tracked by Django migrations. PostgreSQL routines, views, partitioned tables, and partition-management DDL should use reviewed `RunSQL` migrations when model migrations are not expressive enough.
- When editing unmanaged model fields, verify the real database schema expectation with the user or existing schema docs.

### Table Ownership Types

There are two practical table types in this codebase:

- Django-managed tables are owned by Django model migrations. Their models do not set `managed = False`, and future schema changes should normally start in the Django model, then use `makemigrations` and `migrate`. Examples include Django auth tables and the `Security_api` `users` and `roles` tables.
- SQL-managed application tables are represented in Django with unmanaged models or direct SQL usage, but Django model migrations do not create or alter them. Their schema is owned through `db_schema` `RunSQL` migrations. Most `core` schema tables currently fall into this group.

For SQL-managed application tables, update both sides when the shape changes: add a `db_schema` `RunSQL` migration for the actual database DDL, and update any matching unmanaged Django model field definitions so ORM reads and writes stay aligned with the real table.

## Main Data Flows

### Auth Flow

`/security/v1.0/login` validates credentials and issues RS256 tokens. Authenticated requests use SimpleJWT authentication. Refresh/logout flows rotate or blacklist refresh tokens.

### Dataset Flow

`DatasetUploadUrlView` and partition dataset upload views generate SAS URLs. Confirm endpoints create or update metadata records and enqueue ingestion tasks. Ingestion services stream CSV data from Blob Storage, validate it, write rows to raw tables, and update status/tags.

### Workflow Flow

`RunWorkflowStepView` queues workflow tasks:

- `process_workflow`: runs `sku_selection`, `base_math`, and `partition_tree`.
- `process_partition_tree`: reruns only the partition tree step.

Step calculators are registered through `reports/services/workflow/base.py` and orchestrated through `reports/services/workflow/processes.py`. Workflow status is written to `core.workflows.data` and progress is published through Redis helpers in `reports/services/workflow/progress.py`.

### Partition Tree Edit Flow

`UpdatedPartitionTreeView` loads the existing workflow tree, validates node operations, updates tree JSON, and queues OBM recomputation through Celery. The API publishes progress for frontend polling.

### Virtual Rollup Flow

Virtual rollup preview requests normalize grouping specs, enqueue `compute_virtual_rollup_task`, compute a preview using selected SKUs and node filters, cache progress/results, and return task polling state through `AsyncResult`.

## Celery Queues

Current task routing in settings:

- `calc_workflow`: `reports.tasks.process_workflow_task`
- `calc_tree`: `reports.tasks.process_partition_tree_task`
- `ingest`: `reports.tasks.ingest_dataset_task`
- `compute_obm`: `reports.tasks.compute_obm_task`
- `compute_obm`: `reports.tasks.compute_virtual_rollup_task`

If queue names change, update settings, worker scripts, deployment docs, README, and this handbook together.

## API And Request Examples

The route definitions live in:

- `Security_api/urls.py`
- `reports/urls.py`
- `Security_api_settings/urls.py`

Use `bruno/PartitionPro/` for request examples, payload shapes, polling URLs, and local environment examples. Keep Bruno examples synchronized when API contracts change.

## Existing Architecture Docs

Additional architecture artifacts exist in `docs/`:

- `docs/azure-celery-durable-manager-review.pdf`
- `docs/azure-celery-durable-technical-appendix.pdf`
- `docs/assets/current_architecture.png`
- `docs/assets/target_architecture.png`

Use those as supporting references, but keep agent-facing operating context in `docs/codex/`.
