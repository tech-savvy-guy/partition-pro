# Contributing

This repository is Codex-first and uses docs-as-code for business and engineering context. Read `AGENTS.md` and `docs/codex/README.md` before making non-trivial changes.

## Workflow

1. Inspect the current worktree before editing.
2. Keep changes scoped to the requested behavior.
3. Preserve unrelated user or teammate changes.
4. Add or update tests for behavior changes.
5. Update `docs/codex/` when business rules, API contracts, workflow behavior, environment variables, or operational assumptions change.
6. Run focused offline validation.
7. Open a PR with a clear summary, tests, docs impact, and risks.

## Branches

- Use short descriptive branch names.
- For Codex-created branches, prefer the `codex/` prefix unless another convention is requested.
- Do not mix unrelated changes in one branch.

## Tests

Prefer targeted tests for the touched area. Avoid using production or shared cloud resources for validation.

Examples:

```powershell
python manage.py test reports.tests.test_virtual_rollup
python manage.py test reports.tests.test_auto_break_tree
```

If a test requires unavailable external services, report the blocker instead of using real credentials.

## Documentation

Update the Codex handbook for:

- Business or domain rule changes.
- API payload, route, auth, or response changes.
- Workflow, Celery, Redis progress, or ingestion changes.
- Environment variable or deployment changes.
- New known issues or resolved repo drift.

## Pull Requests

Each PR should include:

- Summary of changes.
- Validation performed.
- Docs updated or reason docs were not needed.
- Migration/schema impact.
- Security impact.
- Any known limitations or follow-up work.
