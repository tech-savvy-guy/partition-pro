# Models

This document describes the current Django models and their database tables.

## `core.user`

Model: `core.User`

```json
{
  "id": "uuid",
  "entra_oid": "string",
  "tenant_id": "string",
  "email": "email",
  "first_name": "string",
  "last_name": "string",
  "job_title": "string",
  "department": "string",
  "image": "string",
  "is_active": true,
  "role": "string",
  "last_seen_at": "datetime | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- Referenced by cases, datasets, partitions, workflows, assignments, and refresh tokens.

Constraints and indexes:
- Unique: `entra_oid`, `email`
- Indexes: `entra_oid`, `email`, `is_active`

## `core.cases`

Model: `core.Case`

```json
{
  "id": "uuid",
  "name": "string",
  "code": "string",
  "description": "string",
  "methodology": "string",
  "status": "draft | active | archived | completed",
  "category": "string",
  "tags": {},
  "is_archived": false,
  "is_deleted": false,
  "created_by": "uuid | null",
  "updated_by": "uuid | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- `created_by`, `updated_by` -> `core.user`
- Has many `core.datasets`
- Has many `core.partitions`
- Has many `core.assignments`

Constraints and indexes:
- Unique active case code: `code` where `is_deleted = false`
- Indexes: `status`, `(is_archived, is_deleted)`, `created_by`

## `core.assignments`

Model: `core.CaseUserAssignment`

```json
{
  "case_id": "uuid",
  "user_id": "uuid",
  "role": "publisher | editor | viewer",
  "is_deleted": false,
  "tags": {},
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- `case_id` -> `core.cases`
- `user_id` -> `core.user`

Constraints and indexes:
- Primary key: `(user_id, case_id)`
- Indexes: `(user_id, is_deleted)`, `(case_id, is_deleted)`

## `core.datasets`

Model: `core.Dataset`

```json
{
  "id": "uuid",
  "case_id": "uuid",
  "type": "pos | attributes | cross_purchase",
  "version": 1,
  "file_name": "string",
  "file_size": "decimal | null",
  "blob_name": "string",
  "description": "string",
  "status": "processing | ready | failed | archived",
  "is_deleted": false,
  "is_selected": false,
  "tags": {},
  "created_by": "uuid | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- `case_id` -> `core.cases`
- `created_by` -> `core.user`

Constraints and indexes:
- Unique dataset version per case/type: `(case_id, type, version)`
- Check: `version >= 1`
- Indexes: `(case_id, type, -version)`, `status`, `is_deleted`, `is_selected`

## `core.partitions`

Model: `core.Partition`

```json
{
  "id": "uuid",
  "case_id": "uuid",
  "name": "string",
  "description": "string",
  "status": "draft | active | archived",
  "is_shared": false,
  "is_deleted": false,
  "tags": {},
  "base_partition": "uuid | null",
  "locked_by": "uuid | null",
  "lock_expires_at": "datetime | null",
  "created_by": "uuid | null",
  "updated_by": "uuid | null",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- `case_id` -> `core.cases`
- `base_partition` -> `core.partitions`
- `locked_by`, `created_by`, `updated_by` -> `core.user`
- Has many `core.workflows`

Derived values:
- `locked_by_display_name` is computed from `locked_by.first_name`, `locked_by.last_name`, or `locked_by.email`.

Constraints and indexes:
- Unique active partition name per case: `(case_id, name)` where `is_deleted = false`
- Indexes: `(case_id, is_deleted)`, `status`, `locked_by`, `is_shared`, `is_deleted`

## `core.workflows`

Model: `core.WorkflowRun`

```json
{
  "id": "uuid",
  "partition_id": "uuid",
  "status": "queued | running | completed | failed | cancelled",
  "triggered_by": "uuid | null",
  "started_at": "datetime",
  "finished_at": "datetime | null",
  "datasets": {},
  "parameters": {},
  "result": {},
  "error": "string",
  "tags": {}
}
```

Relationships:
- `partition_id` -> `core.partitions`
- `triggered_by` -> `core.user`
- Case is derived through `partition.case`.

Constraints and indexes:
- Indexes: `(partition_id, -started_at)`, `(partition_id, status)`, `status`

## `core.metadata`

Model: `core.Metadata`

One row per (case, dataset-combination signature). Holds the full-panel ROI
matrix directly as nested JSONB — no child row tables. A signature's row is
never deleted once created: re-selecting a previously-computed dataset
combination reuses it instantly instead of recomputing (see
`core.services.preprocessing.build.run_preprocessing`). Its `id` is the
`_metadata_id` argument to the `core.get_roi_matrix_rows_by_skuname` stored
function.

```json
{
  "id": "uuid",
  "case_id": "uuid",
  "pos_dataset_id": "uuid | null",
  "att_dataset_id": "uuid | null",
  "cp_dataset_id": "uuid | null",
  "signature": "string",
  "status": "pending | running | ready | failed",
  "base": "float | null",
  "sku_count": "integer",
  "row_max": {},
  "avg_roi": {},
  "roi_matrix": {},
  "error": "string",
  "tags": {},
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Relationships:
- `case_id` -> `core.cases`
- `pos_dataset_id` / `att_dataset_id` / `cp_dataset_id` -> `core.datasets` (the
  POS / ATTRIBUTES / CROSS_PURCHASE datasets the run was built from).

Derived values:
- `signature` is a sha256 of the case id + all three dataset id+version tuples;
  selecting a different combination produces (or reuses) a different row.
- `roi_matrix` is nested `{sku_l: {sku_r: roi}}` — the shape
  `core.get_roi_matrix_rows_by_skuname`'s two-level `jsonb_each`/`jsonb_each_text`
  unpivot reads.
- `row_max` is `{sku: row_max}`, used to derive `abs_pen%` at read time
  (`abs_pen% = row_max / base * 100`) without re-touching raw rows.
- `avg_roi` is `{sku: full-panel mean ROI}` (the SKU's row mean in
  `roi_matrix`, excluding the zero diagonal), persisted at preprocessing time
  by `core/services/preprocessing/build.py` (field added in migration
  `0029_add_avg_roi_to_metadata`) and read via `avg_roi_for_skus` — never
  recomputed from a selection-filtered subset.

Constraints and indexes:
- Unique: `(case_id, signature)`
- Indexes: `case_id`, `status`, `(case_id, status)`

## `security.refresh_token`

Model: `security.RefreshToken`

```json
{
  "id": "integer",
  "user": "uuid",
  "jti_hash": "string",
  "expires_at": "datetime",
  "revoked_at": "datetime | null",
  "created_at": "datetime",
  "last_used_at": "datetime | null"
}
```

Relationships:
- `user` -> `core.user`

Derived values:
- `is_revoked` is computed from `revoked_at`.
- `is_expired` is computed from `expires_at`.

Constraints and indexes:
- Unique: `jti_hash`
- Indexes: `jti_hash`, `expires_at`, `revoked_at`, `(user, revoked_at)`
