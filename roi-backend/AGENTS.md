# Codex Instructions

This repository is Codex-first. Before making code changes, read the Codex handbook:

1. `docs/codex/README.md`
2. `docs/codex/business-context.md`
3. `docs/codex/architecture.md`
4. `docs/codex/engineering-standards.md`
5. `docs/codex/testing-and-validation.md`

Use the task playbooks in `docs/codex/task-playbooks.md` for common work such as API changes, workflow changes, ingestion changes, Celery task updates, and docs-only changes.

## Operating Rules

- Preserve user work. Do not revert, delete, or rewrite unrelated changes in the worktree.
- Treat `docs/codex/` as the source of truth for business and engineering context.
- Keep README as the high-level project overview. Put durable agent context in `docs/codex/`.
- Update the Codex handbook when domain behavior, API contracts, workflow logic, env vars, deployment assumptions, or operational constraints change.
- Prefer existing Django, DRF, Celery, Redis, and workflow-service patterns over new abstractions.
- Keep changes scoped to the requested behavior and the smallest practical set of files.
- Do not access production or staging services unless the user explicitly provides scoped instructions for that task.
- Do not read, print, commit, or summarize real secrets from `.env`, `.env-dev`, `.env-prod`, logs, certificates, private keys, Azure connection strings, Redis passwords, or database credentials.
- Use safe local or mocked tests by default. Report clearly when tests cannot run without external services.

## Validation Expectations

For docs-only changes, validate links and check that no secrets were introduced.

For code changes, run targeted offline tests for the touched area. Prefer focused Django tests or small unit tests over broad commands that require Azure, Redis, or production database access.

Before handing work back, report:

- What changed.
- What validation ran.
- Any skipped validation and why.
- Any remaining repo drift or follow-up risk.
