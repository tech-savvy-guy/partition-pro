# Engineering Standards

These standards apply to Codex and human contributors. Prefer the existing codebase style when it is clear, and use these rules to resolve ambiguity.

## General Principles

- Make focused changes that solve the requested problem without unrelated refactors.
- Preserve backwards-compatible API behavior unless the task explicitly changes a contract.
- Prefer small functions and local helpers over broad new abstractions.
- Prefer shared utility functions for behavior that is reused across views, tasks, serializers, or workflow services.
- Use type hints for new and changed Python functions, especially service helpers, Celery task helpers, serializers, and workflow utilities.
- Minimize database calls within a set of workflow steps or related service operations. Fetch shared state once, pass it through typed helpers, and reuse in-memory results when consistency allows.
- Keep domain logic in services, not views, when behavior is shared or complex.
- Keep views responsible for request parsing, authentication/permission boundaries, status codes, and orchestration.
- Treat tests as executable documentation for behavior that matters.

## Python And Django

- Follow existing Django and DRF patterns in nearby files.
- Keep imports explicit and avoid wildcard imports.
- Keep shared utilities in the most specific reasonable module first. For example, use workflow-specific helpers under `reports/services/workflow/` before adding broad project-level utilities.
- Avoid duplicating parsing, normalization, validation, progress-publishing, or dataframe conversion logic. Extract and reuse typed helpers when a pattern appears in more than one place.
- Validate request payloads before queueing Celery tasks or mutating workflow state.
- Prefer serializers for structured API validation when payload shape is stable.
- Use `ObjectDoesNotExist` or specific model exceptions where behavior depends on missing rows.
- Avoid hidden database writes in helper functions unless the name and call site make the side effect clear.
- Avoid repeated ORM queries inside loops or sequential workflow steps. Prefer `select_related`, `prefetch_related`, `values`, bulk queries, cached intermediate data, or explicit context objects where they reduce query count without making correctness unclear.
- Be careful with unmanaged models. They represent existing database tables.

## API Conventions

- Keep route style consistent with current `/security/v1.0/` and `/reports/v1.0/` paths.
- For async operations, return `202 Accepted` with task or polling information.
- For polling endpoints, preserve existing response shapes unless the frontend contract is intentionally changing.
- Use `400 Bad Request` for invalid payloads, `403 Forbidden` for authorization or forbidden state transitions, `404 Not Found` for missing resources, and `500` only for unexpected failures.
- Return machine-readable error fields where practical, and keep user-facing text stable once clients depend on it.
- Update Bruno examples when endpoints, payloads, auth behavior, or polling URLs change.

## Workflow And Celery

- Keep Celery task names stable unless deployment and worker routing are updated together.
- Check queue routing in `Security_api_settings/settings.py` before adding or renaming tasks.
- Publish progress consistently through existing progress helpers.
- Persist source-of-truth workflow state in `Workflow.data`; use Redis as fast progress/cache state, not the only durable record.
- Do not assume Redis is always available. Existing code commonly falls back to database state.
- Keep long-running task behavior aligned with configured time limits and worker deployment constraints.
- Avoid passing large raw datasets through Celery payloads. Pass IDs and fetch data inside the worker.

## Ingestion And Data Handling

- Treat uploaded datasets as untrusted input.
- Validate required columns, data types, and row-level assumptions before writing raw or preprocessed data.
- Keep dataset status and error tags accurate for frontend and operational debugging.
- Do not log raw dataset contents, credentials, tokens, or personally sensitive values.
- Keep blob names, dataset IDs, case IDs, and partition IDs traceable in logs without exposing secrets.

## Logging And Observability

- Use structured, concise logs.
- Include identifiers that support debugging: case ID, partition ID, dataset ID, task ID, step name, node ID.
- Do not log access tokens, refresh tokens, private keys, passwords, connection strings, or full CSV payloads.
- When adding new async work, include success and failure paths that are observable through status fields or progress events.

## Security

- Default to least privilege and local-only execution during agent work.
- Never commit real `.env` files, certificates, private keys, or log files.
- Keep CORS, allowed hosts, token lifetime, and secret-loading changes explicit and reviewed.
- Treat any change to auth, RBAC, tenant filtering, dataset access, or SAS URL generation as security-sensitive.

## Documentation

Update `docs/codex/` when changes affect:

- Business/domain rules.
- API contracts or payloads.
- Workflow steps, progress behavior, or Celery queue behavior.
- Environment variables or local setup.
- Deployment, worker, Redis, Postgres, or Azure assumptions.
- Known issues or repo drift.

## Definition Of Done

A change is ready to hand back when:

- The code or docs satisfy the requested behavior.
- Related tests or docs are updated.
- Focused validation has run, or skipped validation is explained.
- No secrets are introduced.
- Remaining risks or follow-ups are stated clearly.
