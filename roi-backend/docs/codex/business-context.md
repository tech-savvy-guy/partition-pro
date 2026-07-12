# Business Context

PartitionPro is an ROI analytics backend for managing cases, uploading datasets, and running analytical workflows that produce SKU selections, base math outputs, partition trees, OBM updates, and virtual rollup previews.

The backend is multi-tenant, API-first, and asynchronous. Users authenticate with RS256 JWTs, operate on cases and partitions, upload CSV datasets through Azure Blob Storage SAS URLs, and trigger Celery-backed workflows whose progress is exposed through Redis and persisted workflow state.

## Core Domain Terms

- Case: A business analysis container. Cases include owner/contact metadata, status, product/category metadata, tenant ownership, assignments, datasets, and partitions.
- Partition: A case-specific analytical workspace. Partitions can be locked, closed, edited, mapped to selected dataset versions, and associated with workflow state.
- Dataset: Uploaded CSV input. Case-level datasets include `POS`, `ATTRIBUTES`, and `CROSSPURCHASE`. Partition-level datasets include `GROUPING`.
- Dataset metadata: Versioned records that track file names, blob names, status, selected version, and tags for uploaded data.
- Preprocessed metadata: Links selected case datasets into preprocessed workflow outputs.
- Workflow: A persisted `core.workflows` row keyed by case and partition. Its JSON `data` field stores step results, partition tree output, OBM output, status data, and related metadata.
- SKU selection: Workflow step that identifies relevant SKUs from uploaded and preprocessed data.
- Base math: Workflow step that calculates the base analytical metrics used by later workflow steps.
- Partition tree: Workflow step and editable tree structure used to organize attributes, values, SKU counts, and downstream calculations.
- OBM: Optimized Base Math recomputation that runs after partition tree edits.
- Virtual rollup: A preview calculation that evaluates proposed regrouping without persisting the result to the database.
- Auto-break tree: In-progress or partially integrated logic for automatically expanding partition tree nodes using candidate attributes and level testing.
- Changelogs: API-managed change announcements or audit-style records exposed under the reports API.
- User assignment: Case-level access link between a user and a case-specific role such as publisher, editor, or viewer.

## User And Access Model

- Users authenticate with email and password through `/security/v1.0/login`.
- Access tokens are short-lived and refresh tokens rotate and blacklist on refresh/logout.
- Users have a `Role` with JSON permissions, tenant metadata, and flags such as super user/admin.
- Case access is role-sensitive. Admin-style roles can see broader case sets; other users depend on explicit `UserAssignment` records.
- All new access-control behavior must be checked against existing role and assignment logic before changing API responses.

## Main Business Flows

### Authentication

1. User logs in with email/password.
2. API issues RS256 JWT access and refresh tokens.
3. Authenticated API requests use `Authorization: Bearer <access_token>`.
4. Refresh and logout endpoints rotate or blacklist refresh tokens.

### Dataset Upload And Ingestion

1. Client requests a SAS upload URL for a case or partition dataset.
2. Client uploads the CSV directly to Azure Blob Storage.
3. Client confirms the upload with the API.
4. API creates or updates dataset metadata and enqueues a Celery ingestion task.
5. Worker streams the blob, validates columns/data, writes rows into `core.raw_*` tables, and updates dataset status.

### Analytical Workflow

1. Client triggers `process_workflow`.
2. Celery runs `sku_selection`, then `base_math`, then `partition_tree`.
3. Progress is published to Redis.
4. Step results and overall state are persisted in `core.workflows.data`.
5. Client polls workflow endpoints for progress and results.

### Tree Editing And Preview

1. Client fetches node attributes and SKUs for a partition tree node.
2. Client updates or deletes node children.
3. API enqueues OBM recomputation and publishes progress.
4. Client can request virtual rollup previews for proposed grouping changes without persisting those changes.

## Business Rules Codex Must Not Guess

If a task depends on any of these, ask the user or add a documented open question instead of inventing behavior:

- Exact ROI, base math, level testing, and OBM formulas when code and tests do not make intent clear.
- Canonical lifecycle statuses for cases, partitions, datasets, and workflows.
- Complete permission matrix for each role and tenant scenario.
- Required CSV schemas and accepted column aliases for each data type beyond what ingestion code enforces.
- Expected behavior for duplicate uploads, stale selected dataset versions, and partition dataset replacement.
- Data retention, audit, deletion, archival, and compliance requirements.
- Production service-level objectives, retry policy, and operational alerting policy.
- User-facing wording for business errors.
- Auto-break tree product expectations and whether the current partial implementation is approved for release.

## Business Context Maintenance

When a business rule is confirmed, update this file with:

- The rule.
- The source of confirmation.
- The relevant API, model, service, or workflow step.
- Any tests or examples that protect the behavior.
