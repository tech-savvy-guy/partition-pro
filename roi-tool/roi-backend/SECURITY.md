# Security Policy

## Agent And Contributor Safety Rules

- Do not commit real secrets, credentials, private keys, certificates, tokens, connection strings, or customer data.
- Do not print, summarize, or paste sensitive values from `.env`, `.env-dev`, `.env-prod`, logs, key files, Azure, Redis, or Postgres.
- Do not use production or shared staging services during agent work unless the user explicitly provides scoped instructions for that task.
- Treat auth, RBAC, tenant filtering, dataset access, SAS URL generation, and workflow data exposure as security-sensitive.
- Use synthetic data, mocks, and local-only tests by default.

## Sensitive Files And Data

The following must be treated as sensitive or generated local artifacts:

- `.env`, `.env-dev`, `.env-prod`
- `*.pem`, `*.key`, `*.p12`
- `Security_logs/`
- Database dumps and customer CSV exports
- Azure publish profiles and connection strings
- Redis and Postgres credentials
- JWT access and refresh tokens

## Reporting Security Issues

Do not open public issues containing secrets, exploits, customer data, or vulnerability details. Report security issues through the project's private security process or directly to the repository owner.

Include:

- Affected endpoint, task, model, or service.
- Impact and likely exploit path.
- Reproduction steps using synthetic data.
- Suggested mitigation if known.

## Review Expectations

Security-sensitive changes should include focused tests or a clear manual validation note for:

- Authentication and token behavior.
- Authorization and tenant filtering.
- Dataset ownership/access.
- Secret loading and logging.
- SAS URL scope and lifetime.
- Error messages that could leak sensitive implementation details.
