# Codex Handbook

This handbook is the durable context layer for Codex and other coding agents working on the ROI Backend. It captures the business context, architecture, conventions, safety rules, and repeatable playbooks that should not need to be re-explained in each task.

## Reading Order

Start here, then read the files that match the task:

1. `business-context.md` for PartitionPro domain concepts and vocabulary.
2. `architecture.md` for service boundaries, data flow, Celery queues, Redis progress, Azure Blob ingestion, and deployment context.
3. `engineering-standards.md` for coding, API, task, logging, migration, and docs expectations.
4. `testing-and-validation.md` for safe local validation.
5. `task-playbooks.md` for implementation checklists by task type.
6. `known-issues.md` for current repo drift and risks to keep in mind.

For API examples, use the Bruno collection in `bruno/PartitionPro/` instead of recreating request payloads from memory.

## Repository Map

- `Security_api_settings/`: Django project configuration, root URLs, WSGI, Celery app setup, settings.
- `Security_api/`: authentication, users, roles, JWT login/logout/refresh, health checks, input sanitization.
- `reports/`: PartitionPro domain APIs, unmanaged core models, datasets, cases, partitions, workflows, Celery tasks.
- `reports/services/ingestion/`: dataset ingestion and validation logic.
- `reports/services/workflow/`: SKU selection, base math, partition tree, OBM, virtual rollup, workflow state, and progress helpers.
- `utilities/`: shared logging, encryption, Azure Key Vault, and common helper functions.
- `bruno/PartitionPro/`: API request collection and local environment examples.
- `docs/`: project documentation, architecture assets, and this Codex handbook.
- `webjobs/`: Azure WebJob worker wrapper.

## Codex Working Loop

1. Inspect the current worktree and relevant files before planning edits.
2. Read the task-specific handbook pages and nearby code.
3. Preserve existing user changes, including untracked files.
4. Make the smallest coherent change that satisfies the task.
5. Update tests and docs when behavior, contracts, or operational assumptions change.
6. Run focused offline validation when possible.
7. Report changes, validation, skipped checks, and remaining risks.

## Non-Negotiables

- Do not use real production data, production Azure resources, production Redis, production Postgres, or real secrets during agent work.
- Do not expose `.env`, `.env-dev`, `.env-prod`, private keys, certificates, connection strings, log contents with sensitive values, or access tokens.
- Do not guess business rules that are not present in code or docs. Record them in `business-context.md` as open questions.
- Do not treat unmanaged `core` schema models as Django-owned migrations unless the task explicitly changes database ownership.
- Do not expand a focused task into broad refactors.

## Source Of Truth

Use this hierarchy when context conflicts:

1. Current user instructions for the task.
2. Code and tests in the current worktree.
3. `docs/codex/` handbook.
4. `README.md` and existing project docs.
5. Bruno collection examples.

When conflict remains, document the conflict and ask for clarification before making a risky change.
