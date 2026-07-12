# ROI Backend — PartitionPro API

A Django REST API backend for the **PartitionPro** ROI analytics platform. It provides multi-tenant case management, dataset ingestion pipelines via Azure Blob Storage, and a multi-step analytical workflow engine (SKU selection → base math → partition tree), all secured with RS256 JWT authentication and powered by Celery + Redis for async processing.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Setup](#local-setup)
- [Running the Project](#running-the-project)
- [Celery Workers](#celery-workers)
- [API Reference](#api-reference)
- [Core Workflows & Business Logic](#core-workflows--business-logic)
- [Database Schema](#database-schema)
- [Deployment (Azure)](#deployment-azure)
- [Key Conventions & Notes](#key-conventions--notes)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients / Frontend                    │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTPS  (Bearer JWT – RS256)
┌────────────────────────▼────────────────────────────────────┐
│              Django REST Framework (Waitress / IIS)          │
│   /security/v1.0/  ──  Auth, Users, Roles                   │
│   /reports/v1.0/   ──  Cases, Partitions, Datasets,         │
│                        Workflows, Partition Tree             │
└──────┬───────────────────────┬──────────────────────────────┘
       │                       │
  PostgreSQL               Redis (SSL)
  (core schema)      ┌─────┴────────────────────────┐
                     │  Celery Broker/Backend/Cache  │
                     └─────┬────────────────────────┘
                           │  Async Tasks
              ┌────────────┼──────────────┬───────────────┐
          calc_workflow  calc_tree     ingest         compute_obm
          (workflow)   (part. tree)  (CSV ingest)   (OBM / virtual rollup)
                           │
                     Azure Blob Storage
                     (dataset uploads / SAS URLs)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.13 |
| Web Framework | Django 5.2 + Django REST Framework 3.16 |
| Authentication | SimpleJWT 5.5 (RS256, token blacklist, refresh rotation) |
| Database | PostgreSQL (`psycopg2-binary`, SSL required) |
| Async Tasks | Celery (broker + result backend via Redis) |
| Cache | `django-redis` (Redis DB 2) |
| Azure | Azure Blob Storage (dataset upload/download via SAS), Azure Key Vault (optional secrets), Azure Identity |
| Data Processing | Pandas 2.2, NumPy 2.2, Matplotlib 3.10 |
| WSGI Server | Waitress 3.0 (Windows/production) or `manage.py runserver` (dev) |
| CORS | `django-cors-headers` |

---

## Project Structure

```
roi-backend/
├── manage.py                        # Django CLI entry point
├── Pipfile / Pipfile.lock           # Dependency management (pipenv)
├── start_workers.sh                 # Linux: starts Celery workers (supervisory loop)
├── start_pratitionpro_backend.bat   # Windows: activates venv, runs Waitress on port 5011
│
├── Security_api_settings/           # Django project package
│   ├── settings.py                  # All config (reads .env via django-environ)
│   ├── urls.py                      # Root URL router
│   ├── celery.py                    # Celery app instance
│   └── wsgi.py                      # WSGI entry point
│
├── Security_api/                    # Auth app
│   ├── models.py                    # Custom User, Role models
│   ├── views.py                     # Login, logout, user/role CRUD, /me, /health
│   ├── urls.py                      # /security/v1.0/ routes
│   ├── serializers.py               # Auth serializers
│   ├── permissions.py               # Custom DRF permission classes
│   └── sanitize_input.py            # InputSanitizerMiddleware
│
├── reports/                         # Domain app
│   ├── models.py                    # Cases, Partitions, Workflows, DatasetMetadata, etc.
│   ├── views.py                     # Cases, Partitions, Datasets, Workflow API views
│   ├── urls.py                      # /reports/v1.0/ routes
│   ├── tasks.py                     # Celery task definitions
│   ├── serializers.py               # Domain serializers
│   └── services/
│       ├── ingestion/               # CSV ingestion pipeline (validate → bulk-load → Postgres)
│       └── workflow/                # Workflow engine
│           ├── processes.py         # Orchestrates workflow steps
│           ├── base.py              # StepCalculator base class & registry
│           ├── sku_selection/       # SKU selection step
│           ├── base_math/           # Base math step
│           ├── partition_tree/      # Partition tree step + OBM
│           └── progress.py          # Redis-based progress publishing
│
├── utilities/                       # Shared helpers
│   ├── common_functions.py          # Azure Key Vault helper, encryption utils
│   ├── logging.py                   # Structured logging helpers
│   └── pagination.py / filters.py  # DRF pagination and filter helpers
│
└── webjobs/calc_worker/             # Azure WebJob wrapper to start a Celery worker
```

---

## Prerequisites

- **Python 3.13** (matches `Pipfile [requires]`)
- **pipenv** (`pip install pipenv`)
- **PostgreSQL** instance (SSL-enabled; a `core` schema must exist with the expected tables)
- **Redis** instance (SSL-enabled, Azure Cache for Redis recommended; used on DBs 0, 1, 2)
- **Azure Blob Storage** account with an upload container
- An **RS256 key pair** (PEM format) for JWT signing

---

## Environment Configuration

Create a `.env` file in the repo root. The file is git-ignored and loaded automatically during local development.

```dotenv
# ── Django ────────────────────────────────────────────────
DJANGO_SECRET=your-django-secret-key
DEBUG=True

# ── RS256 JWT Keys (escape newlines as \n) ────────────────
PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# ── Database (PostgreSQL) ─────────────────────────────────
ENGINE=django.db.backends.postgresql
NAME=your_db_name
USER=your_db_user
PASSWORD=your_db_password
HOST=your_db_host
PORT=5432

# ── Azure Blob Storage ────────────────────────────────────
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_ACCOUNT_NAME=your_account_name
AZURE_STORAGE_ACCOUNT_KEY=your_account_key
AZURE_UPLOAD_CONTAINER_NAME=your_container_name

# ── Redis (Azure Cache for Redis uses SSL on port 6380) ───
REDIS_HOST=your-redis-host.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your_redis_password

# ── Azure Key Vault (optional) ────────────────────────────
# Set KEYMETHOD=AZURE_KEY_VAULT to pull secrets from Key Vault instead of env vars
KEYMETHOD=ENVIRONMENT
VAULT_CLIENT_ID=your-client-id
VAULT_CLIENT_SECRET=your-client-secret
VAULT_TENANT_ID=your-tenant-id
AZURE_KEY_VAULT=https://your-vault.vault.azure.net/
```

> **Generating an RS256 key pair (if you don't have one):**
> ```bash
> openssl genrsa -out private.pem 2048
> openssl rsa -in private.pem -pubout -out public.pem
> # Then flatten each file to a single \n-escaped line for .env
> ```

### JWT Token Lifetime

| Token | Lifetime |
|---|---|
| Access token | 5 minutes |
| Refresh token | 7 days (rotated + blacklisted on each use) |

---

## Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd roi-backend

# 2. Install dependencies via pipenv
pipenv install

# 3. Activate the virtual environment
pipenv shell

# 4. Install packages not yet tracked in Pipfile (required at runtime)
pip install celery django-environ django-redis

# 5. Create .env (see Environment Configuration above)
cp /dev/null .env   # create empty, then fill in values

# 6. Run migrations
python manage.py migrate

# 7. (Optional) Create a Django superuser for /admin/
python manage.py createsuperuser
```

---

## Running the Project

### Development Server

```bash
python manage.py runserver 0.0.0.0:8000
```

The API will be available at `http://localhost:8000/`.

### Production Server (Windows / Waitress)

```bash
python -m waitress --port=5011 Security_api_settings.wsgi:application
```

Or run the provided batch file (after adjusting paths):

```bat
start_pratitionpro_backend.bat
```

### Environment Variable Required at Runtime

```powershell
$env:DJANGO_SETTINGS_MODULE = "Security_api_settings.settings"
```

---

## Celery Workers

The project uses **four Celery queues**. Each maps to a specific task category:

| Queue | Task | Purpose |
|---|---|---|
| `calc_workflow` | `process_workflow_task` | Runs the full 3-step workflow (SKU selection → base math → partition tree) |
| `calc_tree` | `process_partition_tree_task` | Re-runs the partition tree step only |
| `ingest` | `ingest_dataset_task` | Ingests an uploaded CSV into Postgres |
| `compute_obm` | `compute_obm_task`, `compute_virtual_rollup_task` | Computes OBM values and virtual rollup previews |

### Starting Workers (Linux/macOS)

```bash
# Start all workers with auto-restart supervisory loop
bash start_workers.sh

# Or start individual workers manually
celery -A Security_api_settings.celery:app worker -Q calc_workflow -n calc_workflow@%h -c 4 -l info -E
celery -A Security_api_settings.celery:app worker -Q calc_tree      -n calc_tree@%h      -c 4 -l info -E
celery -A Security_api_settings.celery:app worker -Q ingest         -n ingest@%h         -c 1 -l info -E
celery -A Security_api_settings.celery:app worker -Q compute_obm    -n compute_obm@%h    -c 2 -l info -E
```

### Starting Workers (Windows)

```powershell
$env:DJANGO_SETTINGS_MODULE = "Security_api_settings.settings"

# One PowerShell window per queue
python -m celery -A Security_api_settings.celery:app worker -Q calc_workflow -n calc_workflow@%h -c 4 -l info
python -m celery -A Security_api_settings.celery:app worker -Q ingest         -n ingest@%h         -c 1 -l info
```

### Environment Variables for Workers

| Variable | Default | Purpose |
|---|---|---|
| `CELERY_LOG_LEVEL` | `INFO` | Log verbosity |
| `CELERY_CALC_CONCURRENCY` | `4` | Worker concurrency for `calc` queue |
| `CELERY_INGEST_CONCURRENCY` | `1` | Worker concurrency for `ingest` queue |

> **Note:** `start_workers.sh` uses queue names `calc` and `ingest`. The Django settings route tasks to `calc_workflow`, `calc_tree`, `ingest`, and `compute_obm`. For production, start explicit workers for all four queues.

---

## API Reference

### Base URLs

| Prefix | Module |
|---|---|
| `/security/v1.0/` | Authentication, Users, Roles |
| `/reports/v1.0/` | Cases, Partitions, Datasets, Workflows |
| `/admin/` | Django admin |

All endpoints (except `login` and `health`) require:

```
Authorization: Bearer <access_token>
```

---

### Security API — `/security/v1.0/`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `login` | Public | Email + password login; returns `access` + `refresh` tokens |
| `GET` | `me` | JWT | Current authenticated user info |
| `POST` | `logout` | JWT | Blacklist the current refresh token |
| `POST` | `logout-all` | JWT | Blacklist all refresh tokens for the user |
| `POST` | `token/refresh` | Refresh token | Rotate refresh token, get new access token |
| `GET` | `users` | JWT | List all users |
| `POST` | `users/create` | JWT | Create a new user |
| `PUT/PATCH` | `users/<uuid>/update` | JWT | Update a user |
| `DELETE` | `users/<uuid>/delete` | JWT | Delete a user |
| `GET` | `roles` | JWT | List all roles |
| `POST` | `roles/create` | JWT | Create a role |
| `PUT/PATCH` | `roles/<uuid>/update` | JWT | Update a role |
| `DELETE` | `roles/<uuid>/delete` | JWT | Delete a role |
| `GET` | `health` | Public | Health check ping |

---

### Reports API — `/reports/v1.0/`

#### Changelogs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `changelogs` | List all changelogs |
| `GET/PUT/DELETE` | `changelogs/<uuid>/` | Get, update, or delete a specific changelog |

#### Cases

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `cases` | List accessible cases (filtered by role/assignments) |
| `GET/PUT/DELETE` | `cases/<uuid>` | Get, update, or delete a case |
| `GET/POST` | `cases/<uuid>/assignments` | List or create user assignments for a case |
| `GET/POST` | `cases/<uuid>/assignments/role` | Manage role-based assignments |

#### Partitions

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `cases/<uuid>/partitions` | List or create partitions for a case |
| `GET/PUT/DELETE` | `cases/<uuid>/partitions/<uuid>` | Get, update, or delete a partition |
| `POST` | `cases/<uuid>/partitions/<uuid>/close` | Close a partition |
| `POST` | `cases/<uuid>/partitions/<uuid>/lock` | Lock a partition |
| `POST` | `cases/<uuid>/partitions/<uuid>/unlock` | Unlock a partition |

#### Case-Level Datasets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `cases/<uuid>/datasets/<data_type>/upload-url` | Get a SAS upload URL for Azure Blob |
| `POST` | `cases/<uuid>/datasets/<data_type>/confirm` | Confirm upload; triggers ingestion task |
| `GET` | `cases/<uuid>/datasets` | List all datasets for a case |
| `GET/DELETE` | `cases/<uuid>/datasets/<dataset_id>` | Get or delete a specific dataset |
| `POST` | `cases/<uuid>/datasets/select` | Select the active dataset |
| `GET` | `cases/<uuid>/datasets/<data_type>/versions` | List historical versions |
| `POST` | `cases/<uuid>/datasets/versions/<dataset_id>/select` | Activate a historical version |

Dataset types: `POS`, `ATTRIBUTES`, `CROSSPURCHASE`

#### Partition-Level Datasets

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `cases/<uuid>/partitions/<uuid>/datasets/<data_type>/upload-url` | Get SAS URL |
| `POST` | `cases/<uuid>/partitions/<uuid>/datasets/<data_type>/confirm` | Confirm + ingest |
| `GET` | `cases/<uuid>/partitions/<uuid>/datasets` | List partition datasets |
| `GET/DELETE` | `cases/<uuid>/partitions/<uuid>/datasets/<dataset_id>` | Get or delete |
| `GET` | `cases/<uuid>/partitions/<uuid>/raw-datasets` | List raw dataset mappings |

Dataset type: `GROUPING`

#### Workflow

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `workflows/<case_id>/<partition_id>/<process_name>/run` | Trigger async workflow (`process_workflow` or `process_partition_tree`) |
| `GET` | `workflows/<case_id>/<partition_id>` | Get workflow state and step statuses |
| `GET` | `workflows/<case_id>/<partition_id>/node/<node_id>` | Get partition tree node details |
| `POST` | `workflows/<case_id>/<partition_id>/node/<node_id>` | Update node (triggers OBM recompute queue) |
| `DELETE` | `workflows/<case_id>/<partition_id>/node/<node_id>` | Delete a node |
| `GET` | `workflows/<case_id>/<partition_id>/node-attributes-skus` | Get node attribute/SKU data (Redis-cached) |
| `POST` | `workflows/<case_id>/<partition_id>/preview-rollup/` | Enqueue a virtual rollup preview |
| `GET` | `workflows/<case_id>/<partition_id>/preview-rollup-status/<task_id>/` | Poll virtual rollup status |

#### Staging Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `workflows/<case_id>/<partition_id>/sku-selection` | Read or write SKU selection staging data |
| `GET/POST` | `workflows/<case_id>/<partition_id>/base-math` | Read or write base math staging data |

---

## Core Workflows & Business Logic

### 1. Authentication Flow

```
POST /security/v1.0/login
  ↓
Validate credentials (email + password)
  ↓
Issue RS256 JWT:
  - access token (5 min)
  - refresh token (7 days, rotated on each use)
  ↓
All subsequent requests → Authorization: Bearer <access_token>
  ↓
POST /security/v1.0/token/refresh → rotate refresh → new access token
  ↓
POST /security/v1.0/logout → blacklist refresh token
```

Custom JWT claims include: `email`, `role_id`, `tenant_id`.

### 2. Role-Based Access Control (RBAC)

Users have a `Role` with a `permissions` JSON field and a `tenant_id` for multi-tenancy. Case access is controlled by two tiers:

- **`TECH_ADMIN` / `BBA_ADMIN`** — see all cases across tenants
- **Other roles** — can only access cases they have an explicit `UserAssignment` record for

### 3. Dataset Upload & Ingestion Pipeline

```
Client requests SAS URL
  ↓
GET .../datasets/<data_type>/upload-url
  → Azure Blob Storage generates a time-limited SAS URL
  ↓
Client uploads CSV directly to Azure Blob (PUT to SAS URL)
  ↓
POST .../datasets/<data_type>/confirm
  → Creates/updates DatasetMetadata record in Postgres
  → Enqueues ingest_dataset_task (Celery → "ingest" queue)
  ↓
[Celery Worker — ingest queue]
  → Streams CSV from Azure Blob
  → Validates required columns per data type
  → Bulk-loads rows into core.raw_* tables:
      POS          → core.raw_pos_data
      ATTRIBUTES   → core.raw_attributes_data
      CROSSPURCHASE → core.raw_cross_purchase_data
      GROUPING     → core.raw_grouping_data
  → Updates DatasetMetadata status
```

### 4. Workflow Engine

The analytical workflow is a three-step pipeline, run asynchronously via Celery:

```
POST workflows/<case_id>/<partition_id>/process_workflow/run
  ↓
[Celery Worker — calc_workflow queue]
  ↓
Step 1: sku_selection
  → Identifies relevant SKUs based on POS + Attributes data
  → Writes results to core.preprocessed_sku_selection
  → Updates step status → "completed" (or "failed")
  ↓
Step 2: base_math
  → Calculates base metrics (volume, revenue indices, etc.)
  → Writes results to core.preprocessed_base_math
  → Updates step status
  ↓
Step 3: partition_tree
  → Builds the partition tree structure from grouping + base math
  → Stores tree JSON in core.workflows.data
  → Updates overall workflow status

Progress for each step is published to Redis in real-time.
```

To re-run only the partition tree step:

```
POST workflows/<case_id>/<partition_id>/process_partition_tree/run
  ↓
[Celery Worker — calc_tree queue]
  ↓
Runs partition_tree step only
```

Each step is implemented as a registered `StepCalculator` subclass in `reports/services/workflow/`.

### 5. Partition Tree Editing & OBM

Once a workflow completes, the partition tree can be edited interactively:

```
GET  workflows/.../node/<node_id>   → Load node data
POST workflows/.../node/<node_id>   → Update node attributes/values
                                      → Enqueues compute_obm_task
  ↓
[Celery Worker — compute_obm queue]
  → Recomputes OBM (Optimized Base Math) for affected nodes
  → Updates workflow data in Postgres

DELETE workflows/.../node/<node_id> → Remove a node from the tree
```

### 6. Virtual Rollup Preview

```
POST workflows/.../preview-rollup/
  → Enqueues compute_virtual_rollup_task (compute_obm queue)
  → Returns Celery task_id

GET workflows/.../preview-rollup-status/<task_id>/
  → Polls AsyncResult for task status
  → Returns preview data when complete
```

### 7. Input Sanitization

All incoming requests pass through `InputSanitizerMiddleware`, which sanitizes:
- Query parameters
- Form data  
- JSON request bodies
- File upload filenames

---

## Database Schema

The project uses two schema areas:

### Django-managed tables (`public` schema)

| Table | Description |
|---|---|
| `Security_api_user` | Custom user model (email-based, UUID PK, tenant_id, role FK) |
| `Security_api_role` | Roles with `permissions` JSON field |
| `token_blacklist_*` | SimpleJWT token blacklist tables |

### Unmanaged tables (`core` schema)

> These tables must be pre-created in the database. Django models reference them but do not manage their migrations.

| Table | Description |
|---|---|
| `core.cases` | Case records |
| `core.changelogs` | Audit changelog entries |
| `core.user_assignments` | User-to-case RBAC assignments |
| `core.partitions` | Partitions within a case |
| `core.workflows` | Workflow state + JSON `data` (steps, tree) |
| `core.preprocessed_metadata` | Preprocessed dataset metadata |
| `core.dataset_metadata` | Case-level dataset tracking |
| `core.partition_dataset_metadata` | Partition-level dataset tracking |
| `core.partitions_raw_dataset_mapping` | Maps partitions to raw datasets |
| `core.raw_attributes_data` | Raw attributes CSV data |
| `core.raw_cross_purchase_data` | Raw cross-purchase CSV data |
| `core.raw_grouping_data` | Raw grouping CSV data |
| `core.working_attributes_data` | Processed attributes data |
| `core.preprocessed_sku_selection` | Output of SKU selection step |
| `core.preprocessed_base_math` | Output of base math step |

---

## Deployment (Azure)

The CI/CD pipeline is defined in `.github/workflows/roi-azure-deployment.yml`.

| Branch | Target App Service |
|---|---|
| `dev` | `wal-cproibac-eu-d-1-development` |
| `main` | `wal-cproipro-eu-p-2-production` |

### Deployment Steps

1. Push to `dev` or `main` branch
2. GitHub Actions zips the project (excluding `.git`, `Pipfile`, `__pycache__`, etc.)
3. Deploys the zip to the target Azure App Service via publish profile

### Required GitHub Secrets

| Secret | Usage |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Publish profile for dev App Service |
| `AZURE_WEBAPP_PUBLISH_PROFILE_PROD` | Publish profile for production App Service |

### Azure App Service Environment Variables

All variables from the `.env` section above must be set as **Application Settings** in the Azure App Service configuration panel (they replace the `.env` file in production).

Additionally, set:

```
DJANGO_SETTINGS_MODULE=Security_api_settings.settings
```

### Celery Workers on Azure

Workers are run as **Azure WebJobs** using the scripts in `webjobs/calc_worker/`. Deploy these as continuous WebJobs alongside the main App Service, or run them as separate App Service instances.

---

## Key Conventions & Notes

- **All IDs are UUIDs** — users, cases, partitions, roles all use UUID primary keys.
- **Email as user identifier** — the custom `User` model uses email (not username) as the login field; JWT `USER_ID_FIELD` and `USER_ID_CLAIM` are both `email`.
- **SSL is required for PostgreSQL** — `sslmode: require` is hardcoded in `DATABASES.OPTIONS`. Ensure your Postgres instance supports SSL.
- **Redis SSL** — `REDIS_SSL = True` is hardcoded; port `6380` is the Azure Cache for Redis SSL port. Adjust if using a non-SSL local Redis for development.
- **CORS is fully open** — `CORS_ORIGIN_ALLOW_ALL = True` and `ALLOWED_HOSTS = ['*']` are set for development flexibility. **Restrict these in production.**
- **Large file uploads** — `DATA_UPLOAD_MAX_MEMORY_SIZE` is set to ~5 GB to support large CSV datasets.
- **Celery task limits** — hard limit: 60 seconds, soft limit: 55 seconds per task. Long-running ingestion/workflow tasks should be designed to fit within these bounds.
- **Logging** — structured JSON logging to stdout; Django and `partition_tree` logger both set to `INFO`. Output is captured by Azure App Service's log stream.
