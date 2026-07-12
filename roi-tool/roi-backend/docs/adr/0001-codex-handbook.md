# ADR 0001: Use A Codex-First Repository Handbook

## Status

Accepted

## Context

The ROI Backend contains substantial business and architectural context: PartitionPro domain concepts, unmanaged `core` schema tables, Azure Blob dataset ingestion, Redis/Celery workflow orchestration, multi-step analytical calculations, and deployment-specific worker concerns.

Without persistent agent instructions, each Codex session needs repeated business context and risks rediscovering the same constraints.

## Decision

Use a Codex-first documentation structure:

- `AGENTS.md` is the root entrypoint for Codex operating instructions.
- `docs/codex/` is the source of truth for durable business, architecture, engineering, testing, and task-playbook context.
- Compatibility files for other assistants may exist, but they point back to the Codex handbook.
- README remains a project overview and does not become the full agent handbook.

## Consequences

- Codex sessions can start with a consistent reading path and safety posture.
- Business rules can be captured once and updated as docs-as-code.
- Docs must be maintained when domain behavior, APIs, workflow logic, env vars, or operational assumptions change.
- New contributors and other agents can still use the same handbook without duplicating context.
