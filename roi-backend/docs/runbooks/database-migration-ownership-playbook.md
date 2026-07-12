# Database Migration Ownership Playbook

This runbook captures the process for bringing a Django/PostgreSQL database back
under repo-controlled migration ownership after schema changes were made manually
through pgAdmin or another database UI.

## Manager Summary

The problem is not that the database stopped working. The problem is that the
live database became the only reliable record of some tables, routines, views,
indexes, or schemas. That makes future changes risky because a new environment,
another developer, or a deployment cannot replay the same database structure
from the repository.

The safer operating model is:

- Preserve the existing database and its data.
- Back it up before changing migration ownership.
- Capture the current application-owned schema as reviewed SQL in the repo.
- Add a Django baseline migration that represents the existing schema.
- Mark that baseline as already applied on the existing database.
- Require all future schema changes to go through reviewed Django migrations.

After this, pgAdmin remains useful for inspection and debugging, but it is not
the system of record for schema changes.

## When To Use This

Use this process when:

- Tables, functions, views, triggers, or indexes were created manually in
  pgAdmin or another database tool.
- Django migrations no longer fully describe the database.
- The existing database has data that must be preserved.
- The team wants future schema changes reviewed and applied consistently.

Do not use this as a shortcut for production changes without a backup, rollback
plan, and environment-specific approval.

## Step 1: Take A Full Backup

Create a full backup outside the repository before changing anything. The backup
may contain real data, so it must not be committed to Git.

Example using pgAdmin:

- Right-click the database.
- Choose `Backup...`.
- Use a custom or plain format appropriate for your restore process.
- Store the file outside the repository.

Example using `pg_dump`:

```powershell
pg_dump `
  --format custom `
  --blobs `
  --verbose `
  --no-owner `
  --no-privileges `
  --file "<backup-folder>\<app>_full_<date>.dump" `
  "<connection-string>"
```

## Step 2: Create A Schema-Only Dump

Create a second dump that contains structure only: schemas, tables, views,
functions, indexes, constraints, and related DDL. It must not include row data.

In pgAdmin:

- Use database-level `Backup...`.
- Set format to `Plain`.
- Turn on schema-only behavior, such as `Only schemas`.
- Keep data export off.
- Exclude owners and privileges when possible.

Store the schema-only dump outside the repository first. Review it before
copying any SQL into the repo.

## Step 3: Classify Database Ownership

Separate database objects into ownership groups.

### Django-Managed Tables

Django-managed tables are owned by normal Django model migrations. Their models
do not set `managed = False`, and Django is responsible for creating or altering
the table.

Use this path when changing a Django-managed table:

```powershell
python manage.py makemigrations
python manage.py migrate
```

Examples include Django auth/session tables and custom app tables such as
`users` and `roles` when they are represented by managed Django models.

### SQL-Managed Application Tables

SQL-managed application tables belong to the app, but Django model migrations do
not create or alter them. They may be represented by unmanaged Django models
with `managed = False`, or they may be used by routines/views/direct SQL.

Use this path when changing a SQL-managed table:

```powershell
python manage.py makemigrations db_schema --empty --name describe_table_change
```

Then add a reviewed `migrations.RunSQL` operation with the actual DDL, such as
`ALTER TABLE`, `CREATE INDEX`, partition attachment DDL, or related constraint
changes. Run the migration normally:

```powershell
python manage.py migrate
```

If an unmanaged Django model maps to the changed table, update the model fields
manually so ORM code matches the real database table. The model update documents
the shape for Python code, but the `RunSQL` migration performs the database
change.

Application-owned objects should be tracked by the application repository. These
usually include:

- Application schemas such as `core`, `analytics`, `billing`, or similar.
- Application tables not created by Django's built-in apps.
- PostgreSQL routines/functions used by application code.
- Application views, triggers, special indexes, and partition DDL.

Django-owned public objects should usually remain managed by normal Django app
migrations. These often include:

- `auth_*`
- `django_*`
- `django_session`
- `token_blacklist_*`
- custom user or role tables already represented by Django models.

System-owned objects should not be managed by application migrations:

- `pg_catalog`
- `information_schema`
- server roles/globals
- cloud-provider internal schemas or settings.

If an object is unclear, document the uncertainty before adding it to the
baseline.

## Step 4: Remove Unsafe Or Unowned SQL

Before committing schema SQL, exclude:

- Row data, such as `COPY` or `INSERT INTO`.
- Passwords, keys, tokens, connection strings, owners, grants, and ACLs.
- Django-owned public tables already handled by Django migrations.
- Stray/manual tables that code does not use and the team has not confirmed as
  application-owned.

## Step 5: Split SQL Into Immutable Migration Files

Avoid committing one giant SQL dump as the migration source. Split application
SQL into readable files that are versioned with the migration that uses them.
After a migration is merged, do not edit, rename, or delete its SQL payload.
Future schema changes must use a new migration and a new SQL payload.

Example structure:

```text
db_schema/
  migrations/
    0001_baseline_existing_db.py
    sql/
      0001_baseline_existing_db/
        00_schemas.sql
        core/
          10_tables.sql
          20_indexes_constraints_partitions.sql
          30_views.sql
          functions/
            get_basemath_full.sql
            get_overall_coverage.sql
        security/
          10_tables.sql
          20_constraints.sql
```

Keep each routine/function in its own file when practical. That makes future
function changes searchable and reviewable. Do not reuse an old migration's SQL
folder for a later change.

## Step 6: Add A Migration-Only Django App

Create a Django app whose only job is to own database schema migrations that do
not fit cleanly into an existing business app.

Example:

```text
db_schema/
  __init__.py
  apps.py
  migrations/
    __init__.py
    0001_baseline_existing_db.py
    sql/
      0001_baseline_existing_db/
```

Add the app to `INSTALLED_APPS`.

Use this app for `RunSQL` migrations that manage application-owned schemas,
routines, views, partitioning DDL, and special indexes.

## Step 7: Add The Baseline Migration

Create a baseline migration that reads and applies the reviewed SQL files with
`migrations.RunSQL`. Keep those files under a migration-specific folder so the
historical migration remains immutable.

Example pattern:

```python
from pathlib import Path

from django.db import migrations


BASELINE_DIR = Path(__file__).resolve().parent / "sql" / "0001_baseline_existing_db"


def read_sql(relative_path: str) -> str:
    return (BASELINE_DIR / relative_path).read_text(encoding="utf-8")


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.RunSQL(read_sql("00_schemas.sql"), reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(read_sql("core/10_tables.sql"), reverse_sql=migrations.RunSQL.noop),
    ]
```

Use `reverse_sql=migrations.RunSQL.noop` when reversing the baseline would be
dangerous or misleading. That is common for a baseline that represents an
existing data-bearing database.

## Step 8: Fake The Baseline On The Existing Database

The existing database already has the baseline objects, so do not run the
baseline SQL against it. Mark the migration as applied:

```powershell
python manage.py check
python manage.py migrate --plan
python manage.py migrate db_schema 0001_baseline_existing_azure_dev --fake
python manage.py showmigrations db_schema
```

Expected result after faking:

```text
db_schema
 [X] 0001_baseline_existing_azure_dev
```

Then confirm no further operations are planned:

```powershell
python manage.py migrate --plan
```

## Step 9: Use Normal Migrations Going Forward

After the baseline is faked on the existing database:

- Use normal Django model migrations for model/table changes Django can express.
- Use `RunSQL` migrations for PostgreSQL routines, views, partition DDL, special
  indexes, or database-specific behavior.
- Do not make pgAdmin-only schema changes.

If someone experiments in pgAdmin, they must convert the final approved change
into a Django migration before handoff.

## When To Use Each Tool

Use `python manage.py migrate` normally when applying new migrations that have
not already been applied to the target database.

Use `python manage.py migrate <app> <migration> --fake` only when the migration
represents objects already present in that database and you only need to align
Django's migration history.

Use `RunSQL` when Django model operations cannot clearly represent the change,
such as:

- `CREATE OR REPLACE FUNCTION`
- views
- triggers
- partition attachments
- specialized indexes
- schema-level DDL.

Use model migrations when changing Django-owned model fields, constraints, or
tables that Django should create and alter directly.

Use pgAdmin for inspection, query testing, backups, and debugging. Do not use it
as the permanent system of record for schema changes.

## Safety Checks

Run these checks before committing the baseline SQL:

```powershell
rg -n "^COPY |^INSERT INTO |^CREATE TABLE public\." db_schema/migrations/sql/0001_baseline_existing_db
```

Run a secret scan. To avoid the command matching itself in this document, build
the URL fragments as strings:

```powershell
$secretPattern = "BE" + "GIN .*PRIVATE|Account" + "Key=|SharedAccess" + "Signature|postgres:/" + "/|postgresql:/" + "/|redis:/" + "/|PASS" + "WORD|OWNER" + " TO|GRA" + "NT "
rg -n $secretPattern db_schema/migrations/sql/0001_baseline_existing_db
```

Run a whitespace check:

```powershell
git diff --check
```

The expected output for the row-data scan is no matches. The expected output for
the secret scan is no real secrets, connection strings, owners, or grants.

## Common Failure Modes

- Running the baseline normally on the existing database causes `already exists`
  errors.
- Faking a baseline before verifying the objects exist creates misleading
  migration history.
- Including Django-owned public tables causes conflicts with normal Django
  migrations.
- Including row data in schema SQL can leak data and make migrations unsafe.
- Updating routines in pgAdmin without adding a migration recreates drift.
- Editing SQL files used by an already-applied migration changes historical
  replay behavior and can make fresh environments diverge.

## Checklist

- Full backup exists outside the repo.
- Schema-only dump was reviewed.
- Application-owned objects were identified.
- Django-owned public objects were excluded.
- Row data and secrets were excluded.
- SQL was split into readable, migration-specific immutable files.
- Migration-only Django app was added to `INSTALLED_APPS`.
- Baseline migration was created with `RunSQL`.
- Existing database baseline was faked, not run normally.
- Future change process is documented for the team.
