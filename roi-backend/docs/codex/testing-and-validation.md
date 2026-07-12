# Testing And Validation

Agent validation must be safe by default. Use local, mocked, or offline checks unless the user explicitly provides scoped staging instructions.

## Local-Only Defaults

Do not connect to:

- Production PostgreSQL.
- Production or shared Azure Blob Storage.
- Production or shared Redis.
- Azure Key Vault with real secrets.
- External customer or tenant data.

Do not print or summarize:

- `.env`, `.env-dev`, `.env-prod`.
- Private keys, certificates, tokens, passwords, or connection strings.
- Sensitive log contents.

## Recommended Checks

For docs-only changes:

```powershell
git diff --check
# Search added docs for PEM headers, cloud connection strings, SAS tokens, DB URLs, and Redis URLs.
$secretPattern = "BEGIN .*PRIVATE|Account" + "Key=|SharedAccess" + "Signature|postgres:/" + "/|redis:/" + "/:"
rg -n $secretPattern AGENTS.md CONTRIBUTING.md SECURITY.md .env.example docs/codex docs/adr .github/copilot-instructions.md CLAUDE.md GEMINI.md
```

For focused Django tests, prefer a specific module:

```powershell
python manage.py test reports.tests.test_virtual_rollup
python manage.py test reports.tests.test_auto_break_tree
```

Only run broader suites when local dependencies and safe dummy settings are available:

```powershell
python manage.py test
```

If local settings import requires secrets or external services, do not work around that by using real credentials. Report the blocker and suggest a safe test settings approach.

## What To Test By Change Type

- API views: route resolution, auth/permission behavior, payload validation, response shape, status codes.
- Serializers: required fields, invalid values, defaults, output shape.
- Workflow services: calculation inputs, result shape, failure behavior, workflow state updates.
- Celery orchestration: queueing behavior, task payloads, progress publication, durable fallback state.
- Ingestion: required columns, data validation, metadata status transitions, error tags.
- Security-sensitive changes: tenant filtering, user assignment rules, role checks, token behavior, SAS URL generation.
- Docs-only changes: links, factual consistency, no secret leakage.

## Reporting Validation

Every handoff should include:

- Commands run.
- Whether they passed.
- Commands intentionally skipped and why.
- External dependencies that prevented local validation.
- Any remaining risk.

## Safe Test Data

Use synthetic UUIDs, dummy users, mocks, and small in-memory dataframes where possible. Do not use real customer data or production exports in tests or docs.
