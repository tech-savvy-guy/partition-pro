# ADR 0002: Own Database Schema Through Django Migrations

## Status

Accepted

## Context

The ROI Backend uses PostgreSQL for both Django-owned authentication tables and PartitionPro domain tables in the pre-existing `core` schema. Some `core` tables are represented by unmanaged Django models today, which means Django can read and write rows through the ORM but does not automatically create or alter those tables.

The team needs one reliable source of truth for future database changes while protecting the existing Azure development database. That database already contains useful schema and data, and it must not be dropped, recreated, or replaced as part of this ownership change.

## Decision

Application-owned database objects will be tracked through Django migrations.

For a new-to-Django reader: a Django migration is a versioned file committed with the codebase that describes a database change. When an environment deploys the code, Django records which migrations have been applied so every environment can move forward in the same order.

The existing Azure development database is preserved. A full database backup has been created and stored outside the repository before changing the ownership model. The backup is not committed to Git and should not be referenced by secret-bearing path, connection string, or credential in repository docs.

The first migration that represents existing application-owned database objects will be treated as a baseline. On the existing Azure development database, that baseline migration will be marked as applied with Django's fake migration workflow because the objects already exist there. Creating a separate database is not part of this task; the baseline exists so migration history can be aligned now and replayed later if the team needs a fresh environment.

Future schema changes must go through reviewed Django migrations. Direct pgAdmin-only schema edits are disallowed because they bypass code review, cannot be replayed consistently, and leave other environments behind.

PostgreSQL routines, views, partitioned table definitions, and partition-management DDL that belong to the application will also live in Django migrations. Use `RunSQL` migrations for SQL that Django's model migration operations cannot express clearly.

Any external SQL payload read by a migration is part of that historical
migration. Store it under a migration-specific path, keep it immutable after
merge, and create a new migration with a new SQL payload for later changes.

The team distinguishes between two table ownership models:

- Django-managed tables are created and altered by normal Django model migrations. Change the model first, then run `makemigrations` and `migrate`.
- SQL-managed application tables are created and altered by reviewed `db_schema` `RunSQL` migrations. If an unmanaged Django model maps to one of these tables, update that model to match the SQL change, but do not expect Django model migrations to alter the table.

## Consequences

- The Azure development database keeps its current data and schema while gaining a migration history.
- Developers can review database changes in pull requests with the related code changes.
- Local, test, development, and future environments have a repeatable path for creating and updating app-owned database objects.
- pgAdmin remains useful for inspection and debugging, but not as the system of record for schema changes.
- Migration authors must make SQL migrations forward-safe, reviewable, and explicit about reverse behavior when reversal is not practical.
- Backups, exports, connection strings, and credentials stay outside the repository.

## Implementation Notes

- Do not check in the external full backup or any generated dump containing data, credentials, or environment-specific connection details.
- Keep Django migrations focused and ordered so the baseline can be faked only where the objects already exist.
- Keep migration SQL payloads colocated with the migration that reads them, such
  as `db_schema/migrations/sql/<migration_name>/`; do not point historical
  migrations at mutable schema artifact folders.
- When adding routines, views, partitioned tables, or partition-management DDL, prefer small `RunSQL` blocks with names that make the affected database object clear.
- If a database object is not application-owned, document that boundary before adding a migration for it.
- For a reusable step-by-step process that can be applied to other apps, see `docs/runbooks/database-migration-ownership-playbook.md`.
