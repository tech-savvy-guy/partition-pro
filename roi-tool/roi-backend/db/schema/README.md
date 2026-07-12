# Database Schema Artifacts

This folder is for schema export notes and reviewed database documentation.
Historical Django migrations must not read mutable SQL from this folder.
Migration-owned SQL lives with the migration that uses it.

Do not commit full database backups, data dumps, customer/dev data, credentials,
owners, ACLs, connection strings, or secrets.

## Current Baseline

- `db_schema/migrations/sql/0001_baseline_existing_azure_dev/` contains the
  immutable SQL payload used by the baseline migration.
- Future migrations must use their own versioned SQL payloads or inline SQL;
  do not edit the SQL files for an already-applied migration.

The baseline files include app-owned schemas and objects such as:

```sql
CREATE SCHEMA core;
CREATE FUNCTION core.some_function(...);
CREATE TABLE core.some_table (...);
```

The SQL must not contain row data statements such as:

```sql
COPY ...
INSERT INTO ...
```

## Existing Azure Dev

The existing Azure dev database already has these objects and data. Its first
`db_schema` baseline migration must be marked as applied with `--fake`; do not
run the baseline creation SQL against that database.

```powershell
python manage.py migrate db_schema 0001_baseline_existing_azure_dev --fake
```

## Future Changes

After the baseline is faked on Azure dev, database structure changes should be
normal Django migrations:

- Django-managed table/model changes start in the model, then use normal
  Django migration operations.
- SQL-managed application table changes use new `db_schema` `RunSQL`
  migrations, and any matching unmanaged model fields should be updated
  manually.
- PostgreSQL functions, views, partition DDL, and special indexes use `RunSQL`.
- Manual pgAdmin changes must be copied back into a reviewed migration before handoff.

For example, a routine update should add a new migration under
`db_schema/migrations/` and either inline the SQL in that migration or store it
under a new migration-specific folder such as
`db_schema/migrations/sql/0002_update_some_routine/`.

## Export From pgAdmin

Use database-level `Backup...`, not `Backup Server...`, when refreshing a
schema-only review snapshot.

- Format: `Plain`
- Only schemas: on
- Only data: off
- Owner: do not save
- Privileges: do not save

Save outside the repo first, for example:

```text
C:\backups\partitionpro_schema_only_YYYY-MM-DD.sql
```

Then review it for secrets and row data before creating any new migration-owned
SQL payload.
