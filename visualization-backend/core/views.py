import logging
import re
from datetime import timedelta

from celery.result import AsyncResult
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import (
    Case,
    CaseUserAssignment,
    Dataset,
    Metadata,
    Partition,
    User,
    WorkflowRun,
)
from core.services.storage import (
    AzureError,
    BlobSasPermissions,
    ResourceNotFoundError,
    ensure_azure_storage_configured,
    generate_blob_sas_url,
    get_blob_client,
)
from core.services.case import (
    can_edit_workflow,
    can_create_partition,
    can_manage_case_locks,
    create_case_assignments,
    get_active_case,
    get_active_dataset,
    purge_case,
    serialize_case,
)
from core.services.datasets import (
    build_dataset_blob_name,
    build_dataset_upload_response,
    get_next_dataset_version,
    serialize_dataset,
)
from core.services.ingestion import DatasetIngestionError, ingest_dataset
from core.services.sku_selection import (
    get_sku_selection_payload,
    normalize_selected_skus,
    validate_selected_skus,
)
from core.services.visualization.progress import get_visualization_progress
from core.services.visualization.workflow import (
    latest_visualization_run,
    prepare_visualization_workflow,
    visualization_run_for_task,
    workflow_status_payload,
    workflow_visualization_payload,
)
from core.services.roi.progress import (
    get_node_testing_progress,
    get_roi_progress,
    publish_node_testing_progress,
)
from core.services.preprocessing.progress import (
    get_preprocessing_progress,
    publish_preprocessing_progress,
)
from core.services.preprocessing.guard import CaseNotReadyError, require_case_ready
from core.services.preprocessing.read import metadata_for_current_selection_any_status
from core.services.roi.workflow import (
    latest_roi_run,
    prepare_roi_workflow,
    roi_run_for_task,
    roi_status_payload,
    workflow_roi_payload,
)
from core.services import workflow_store
from core.services.partition_tree import (
    add_child,
    attribute_value_counts,
    find_node,
    get_attribute_colors,
    get_or_seed_graph,
    has_attribute_child,
    load_context,
    load_graph,
    make_attribute_node,
    make_value_node,
    remove_children,
    save_attribute_colors,
    save_graph,
    selectable_attributes,
)
from core.tasks import (
    compute_node_testing_task,
    compute_obm_task,
    compute_roi_task,
    compute_visualization_task,
    preprocess_case_task,
)
from core.services.users import (
    get_display_name,
    get_image_data_url,
    serialize_user_summary,
)
from core.services.utils import (
    clean_text,
    dedupe,
    is_valid_uuid,
    parse_positive_int,
)
from security.permissions import HasAnyPermission, HasPermission
from security.rbac import Permission, get_permissions_for_role, normalize_role

logger = logging.getLogger(__name__)


def _active_partition_lock(partition, *, now=None) -> dict | None:
    """Return the effective lease, treating incomplete or expired rows as unlocked."""
    now = now or timezone.now()
    if (
        partition.locked_by_id is None
        or partition.lock_expires_at is None
        or partition.lock_expires_at <= now
    ):
        return None

    return {
        "locked_by": str(partition.locked_by_id),
        "locked_by_display_name": partition.locked_by_display_name,
        "lock_expires_at": partition.lock_expires_at.isoformat(),
    }


def _partition_lock_conflict_response(partition, *, lock=None) -> Response:
    lock = lock or _active_partition_lock(partition)
    payload = {
        "code": "partition_locked",
        "detail": "Partition is locked by another user.",
        "locked_by": None,
        "locked_by_display_name": None,
        "lock_expires_at": None,
    }
    if lock is not None:
        payload.update(lock)
    return Response(payload, status=status.HTTP_409_CONFLICT)


def _partition_edit_lock_error(partition, user) -> Response | None:
    """Require a current lease owned by ``user`` before a partition mutation."""
    partition.refresh_from_db(fields=["locked_by", "lock_expires_at"])
    lock = _active_partition_lock(partition)
    if lock is not None and partition.locked_by_id == user.id:
        return None
    if lock is not None:
        return _partition_lock_conflict_response(partition, lock=lock)
    return Response(
        {
            "code": "partition_lock_required",
            "detail": "An active partition lock owned by the current user is required.",
            "locked_by": None,
            "locked_by_display_name": None,
            "lock_expires_at": None,
        },
        status=status.HTTP_409_CONFLICT,
    )


class MeView(APIView):
    """Return the authenticated caller's identity.

    Requires a valid Entra ID Bearer token (enforced by the default
    authentication + IsAuthenticated permission in settings.REST_FRAMEWORK).
    """

    def get(self, request):
        user = request.user
        return Response(
            {
                "email": user.email,
                "display_name": get_display_name(user),
                "first_name": user.first_name,
                "last_name": user.last_name,
                "job_title": user.job_title,
                "department": user.department,
                "role": normalize_role(user.role),
                "permissions": get_permissions_for_role(user.role),
                "image": get_image_data_url(request),
            }
        )


class CasesView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [HasPermission(Permission.CREATE_CASES.value)()]
        return [
            HasAnyPermission(
                Permission.VIEW_CASES.value,
                Permission.CREATE_CASES.value,
            )()
        ]

    def get(self, request):
        cases = (
            Case.objects.filter(is_deleted=False)
            .select_related("created_by", "updated_by")
            .prefetch_related("user_assignments__user")
            .order_by("-updated_at", "-created_at")
        )
        return Response([serialize_case(case, request.user) for case in cases])

    def post(self, request):
        data = request.data or {}
        errors = validate_case_payload(data, partial=False)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        code = clean_text(data.get("code"))
        if Case.objects.filter(code=code, is_deleted=False).exists():
            return Response(
                {"code": ["A case with this code already exists."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                status_value = clean_text(data.get("status")) or Case.Status.DRAFT
                case = Case.objects.create(
                    name=clean_text(data.get("name")),
                    code=code,
                    description=clean_text(data.get("description")),
                    methodology=clean_text(data.get("methodology")).lower(),
                    category=clean_text(data.get("category")),
                    status=status_value,
                    is_archived=status_value == Case.Status.ARCHIVED,
                    tags=data.get("tags") or {},
                    created_by=request.user,
                    updated_by=request.user,
                )
                create_case_assignments(case, data.get("assignments") or [])
        except IntegrityError:
            return Response(
                {"code": ["A case with this code already exists."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_case(case, request.user),
            status=status.HTTP_201_CREATED,
        )


class CaseDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "PATCH":
            return [HasPermission(Permission.CREATE_CASES.value)()]
        if self.request.method == "DELETE":
            return [HasPermission(Permission.DELETE_CASES.value)()]
        return [
            HasAnyPermission(
                Permission.VIEW_CASES.value,
                Permission.CREATE_CASES.value,
            )()
        ]

    def get(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(serialize_case(case, request.user))

    def patch(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = request.data or {}
        errors = validate_case_payload(data, partial=True, case=case)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        updated_fields = []
        for field_name in CASE_PATCH_FIELDS:
            if field_name not in data:
                continue

            if field_name in CASE_TEXT_FIELDS:
                value = clean_text(data.get(field_name))
                if field_name == "methodology":
                    value = value.lower()
                setattr(case, field_name, value)
            elif field_name == "tags":
                setattr(case, field_name, data.get(field_name) or {})
            elif field_name == "status":
                status_value = clean_text(data.get("status"))
                case.status = status_value
                case.is_archived = status_value == Case.Status.ARCHIVED
                updated_fields.append("is_archived")

            updated_fields.append(field_name)

        if not updated_fields:
            return Response(serialize_case(case, request.user))

        case.updated_by = request.user
        updated_fields.extend(["updated_by", "updated_at"])

        try:
            case.save(update_fields=dedupe(updated_fields))
        except IntegrityError:
            return Response(
                {"code": ["A case with this code already exists."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serialize_case(case, request.user))

    def delete(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        purge_case(case)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CasePartitionsView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [
            HasAnyPermission(
                Permission.VIEW_PARTITIONS.value,
                Permission.VIEW_CASES.value,
            )()
        ]

    def get(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partitions = (
            Partition.objects.filter(case=case, is_deleted=False)
            .select_related("base_partition", "locked_by", "created_by", "updated_by")
            .order_by("-updated_at", "-created_at")
        )
        return Response([serialize_partition(partition) for partition in partitions])

    def post(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_create_partition(request.user, case):
            return Response(
                {"detail": "User cannot create partitions for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        data = request.data or {}
        errors = validate_partition_payload(data, case)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        name = clean_text(data.get("name"))
        if Partition.objects.filter(case=case, name=name, is_deleted=False).exists():
            return Response(
                {"name": ["A partition with this name already exists for this case."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            partition = Partition.objects.create(
                case=case,
                name=name,
                description=clean_text(data.get("description")),
                status=clean_text(data.get("status")) or Partition.Status.DRAFT,
                is_shared=bool(data.get("is_shared")),
                tags=data.get("tags") or {},
                base_partition_id=clean_text(data.get("base_partition")) or None,
                created_by=request.user,
                updated_by=request.user,
            )
        except IntegrityError:
            return Response(
                {"name": ["A partition with this name already exists for this case."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(serialize_partition(partition), status=status.HTTP_201_CREATED)


class CaseDatasetsView(APIView):
    permission_classes = [
        HasAnyPermission(
            Permission.VIEW_DATASETS.value,
            Permission.VIEW_FILES.value,
        )
    ]

    def get(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        datasets = (
            Dataset.objects.filter(case=case, is_deleted=False)
            .select_related("created_by")
            .order_by("type", "-version", "-created_at")
        )
        return Response([serialize_dataset(dataset) for dataset in datasets])


class CaseDatasetDetailView(APIView):
    permission_classes = [HasPermission(Permission.EDIT_DATASETS.value)]

    def patch(self, request, case_id, dataset_id):
        dataset = get_active_dataset(case_id, dataset_id)
        if dataset is None:
            return Response(
                {"detail": "Dataset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = request.data or {}
        errors = validate_dataset_update_payload(data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        updated_fields = []
        should_ingest = "is_selected" in data and bool(data.get("is_selected"))
        with transaction.atomic():
            if "description" in data:
                dataset.description = clean_text(data.get("description"))
                updated_fields.append("description")

            if "status" in data:
                dataset.status = clean_text(data.get("status"))
                updated_fields.append("status")

            if "is_selected" in data and not should_ingest:
                dataset.is_selected = False
                updated_fields.append("is_selected")

            if "tags" in data:
                dataset.tags = data.get("tags") or {}
                updated_fields.append("tags")

            if updated_fields:
                updated_fields.append("updated_at")
                dataset.save(update_fields=dedupe(updated_fields))

        if should_ingest:
            try:
                _select_and_ingest_dataset(dataset)
            except DatasetIngestionError as exc:
                return Response(
                    {
                        "detail": str(exc),
                        "dataset": serialize_dataset(dataset),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            # Preprocessing is deliberately NOT triggered here — it's
            # dispatched exactly once by the atomic CaseDatasetSelectionView,
            # which replaces this per-dataset toggle as the "save selection"
            # path.

        return Response(serialize_dataset(dataset))


class CaseDatasetUploadView(APIView):
    permission_classes = [HasPermission(Permission.UPLOAD_FILES.value)]

    def post(self, request, case_id):
        data = request.data or {}
        errors = validate_dataset_upload_payload(data)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                case = Case.objects.select_for_update().get(
                    id=case_id,
                    is_deleted=False,
                )
                dataset_type = clean_text(data.get("type"))
                dataset = Dataset.objects.create(
                    case=case,
                    type=dataset_type,
                    version=get_next_dataset_version(case, dataset_type),
                    file_name=clean_text(data.get("file_name")),
                    file_size=parse_positive_int(data.get("file_size")),
                    blob_name="",
                    description=clean_text(data.get("description")),
                    status=Dataset.Status.PROCESSING,
                    tags=data.get("tags") or {},
                    created_by=request.user,
                )
                dataset.blob_name = build_dataset_blob_name(
                    case.id,
                    dataset.id,
                    dataset.file_name,
                )
                dataset.save(update_fields=["blob_name", "updated_at"])
                upload = build_dataset_upload_response(
                    dataset,
                    clean_text(data.get("content_type")),
                )
        except Case.DoesNotExist:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except IntegrityError:
            return Response(
                {"detail": "Could not create a new dataset version."},
                status=status.HTTP_409_CONFLICT,
            )
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except AzureError as exc:
            logger.exception("Azure upload SAS generation failed: %s", exc)
            return Response(
                {"detail": "Could not create Azure upload URL."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(upload, status=status.HTTP_201_CREATED)


class CaseDatasetUploadCompleteView(APIView):
    permission_classes = [HasPermission(Permission.UPLOAD_FILES.value)]

    def post(self, request, case_id, dataset_id):
        dataset = get_active_dataset(case_id, dataset_id)
        if dataset is None:
            return Response(
                {"detail": "Dataset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            properties = get_blob_client(dataset.blob_name).get_blob_properties()
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except ResourceNotFoundError:
            return Response(
                {"detail": "Uploaded blob was not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except AzureError as exc:
            logger.exception("Azure blob verification failed: %s", exc)
            return Response(
                {"detail": "Could not verify uploaded blob."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        dataset.file_size = properties.size
        dataset.status = Dataset.Status.PROCESSING
        dataset.save(update_fields=["file_size", "status", "updated_at"])

        try:
            ingest_dataset(dataset)
        except DatasetIngestionError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "dataset": serialize_dataset(dataset),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Preprocessing is no longer triggered here — see CaseDatasetDetailView.patch.

        return Response(serialize_dataset(dataset))


class CaseDatasetDownloadView(APIView):
    permission_classes = [HasPermission(Permission.DOWNLOAD_FILES.value)]

    def get(self, request, case_id, dataset_id):
        dataset = get_active_dataset(case_id, dataset_id)
        if dataset is None:
            return Response(
                {"detail": "Dataset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            ensure_azure_storage_configured()
            download_url, expires_at = generate_blob_sas_url(
                dataset.blob_name,
                BlobSasPermissions(read=True),
                settings.AZURE_DOWNLOAD_SAS_TTL_SECONDS,
            )
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except AzureError as exc:
            logger.exception("Azure download SAS generation failed: %s", exc)
            return Response(
                {"detail": "Could not create Azure download URL."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "dataset": serialize_dataset(dataset),
                "download_url": download_url,
                "expires_at": expires_at.isoformat(),
            }
        )


class CaseDatasetPreviewView(APIView):
    permission_classes = [
        HasAnyPermission(
            Permission.VIEW_DATASETS.value,
            Permission.VIEW_FILES.value,
        )
    ]

    def get(self, request, case_id, dataset_id):
        dataset = get_active_dataset(case_id, dataset_id)
        if dataset is None:
            return Response(
                {"detail": "Dataset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            ensure_azure_storage_configured()
            preview_url, expires_at = generate_blob_sas_url(
                dataset.blob_name,
                BlobSasPermissions(read=True),
                settings.AZURE_DOWNLOAD_SAS_TTL_SECONDS,
            )
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except AzureError as exc:
            logger.exception("Azure preview SAS generation failed: %s", exc)
            return Response(
                {"detail": "Could not create Azure preview URL."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "dataset": serialize_dataset(dataset),
                "preview_url": preview_url,
                "expires_at": expires_at.isoformat(),
            }
        )


class PartitionDetailView(APIView):
    permission_classes = [
        HasAnyPermission(
            Permission.VIEW_PARTITIONS.value,
            Permission.VIEW_CASES.value,
        )
    ]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            partition = Partition.objects.select_related(
                "base_partition",
                "locked_by",
                "created_by",
                "updated_by",
            ).get(id=partition_id, case=case, is_deleted=False)
        except (Partition.DoesNotExist, ValueError):
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(serialize_partition(partition))


class PartitionSkuSelectionView(APIView):
    permission_classes = [
        HasAnyPermission(
            Permission.VIEW_PARTITIONS.value,
            Permission.VIEW_CASES.value,
        )
    ]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(get_sku_selection_payload(case_id, partition_id))

    def patch(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot update workflow selections for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        data = request.data or {}
        if not isinstance(data, dict):
            return Response(
                {"detail": ["Payload must be a JSON object."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unknown_fields = sorted(set(data) - {"selected_skus"})
        if unknown_fields:
            return Response(
                {
                    "detail": [
                        "Unknown field(s): " + ", ".join(unknown_fields) + "."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        input_errors = validate_selected_skus_input(data.get("selected_skus"))
        if input_errors:
            return Response(input_errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            selected_skus = normalize_selected_skus(data.get("selected_skus"))
        except ValueError as exc:
            return Response(
                {"selected_skus": [str(exc)]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = get_sku_selection_payload(case_id, partition_id)
        errors = validate_selected_skus(payload, selected_skus)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        dataset_ids = (payload.get("meta") or {}).get("dataset_ids") or {}
        with transaction.atomic():
            workflow = (
                WorkflowRun.objects.select_for_update()
                .filter(partition=partition)
                .order_by("-started_at")
                .first()
            )
            now = timezone.now()
            if workflow is None:
                workflow = WorkflowRun(partition=partition)

            existing_skus = workflow_store.get_selected_skus(workflow)
            selection_changed = existing_skus != selected_skus

            workflow_store.set_selected_skus(workflow, selected_skus)
            workflow.datasets = dataset_ids
            workflow.status = WorkflowRun.Status.COMPLETED
            workflow.triggered_by = request.user
            workflow.finished_at = now
            workflow.error = ""
            if selection_changed:
                # Changing the SKU set invalidates both the MDS result and the
                # partition-tree counts; clear both (preserving the two-key shape).
                workflow_store.clear_visualization(workflow)
                workflow_store.clear_partition_tree(workflow)
            workflow.save()

        return Response(get_sku_selection_payload(case_id, partition_id))


class VisualizationRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot run visualization for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        try:
            task_params = build_visualization_task_params(request.data or {})
            decision = prepare_visualization_workflow(
                partition=partition,
                user=request.user,
                task_params=task_params,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        polling_url = (
            f"/api/cases/{case_id}/partitions/{partition_id}/visualization/"
            f"status/{decision.task_id}/"
        )
        if not decision.should_enqueue:
            payload = workflow_status_payload(decision.workflow, decision.task_id)
            payload["polling_url"] = polling_url
            response_status = (
                status.HTTP_200_OK
                if decision.reused_completed_result
                else status.HTTP_202_ACCEPTED
            )
            return Response(payload, status=response_status)

        task = compute_visualization_task.apply_async(
            args=[str(decision.workflow.id)],
            task_id=decision.task_id,
            queue="visualization",
        )
        return Response(
            {
                "status": "QUEUED",
                "task_id": task.id,
                "workflow_run_id": str(decision.workflow.id),
                "polling_url": (
                    f"/api/cases/{case_id}/partitions/{partition_id}/"
                    f"visualization/status/{task.id}/"
                ),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class VisualizationStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id, task_id):
        try:
            cached = get_visualization_progress(
                str(case_id),
                str(partition_id),
                str(task_id),
            )
            if cached:
                return Response(
                    cached,
                    status=_async_response_status(cached.get("status")),
                )
        except Exception:
            pass

        try:
            task_result = AsyncResult(str(task_id))
            if task_result.ready():
                if task_result.successful():
                    result = task_result.result or {}
                    return Response(
                        {
                            "status": result.get("status", "COMPLETED"),
                            "task_id": str(task_id),
                            "result": result.get("result"),
                        },
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    {
                        "status": "FAILED",
                        "task_id": str(task_id),
                        "error": str(task_result.info),
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception:
            pass

        workflow = visualization_run_for_task(case_id, partition_id, str(task_id))
        if workflow is not None:
            return Response(
                workflow_status_payload(workflow, str(task_id)),
                status=_async_response_status(workflow.status),
            )

        return Response(
            {"status": "RUNNING", "task_id": str(task_id)},
            status=status.HTTP_202_ACCEPTED,
        )


class VisualizationLatestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        workflow = latest_visualization_run(partition.id)
        if workflow is None or workflow_visualization_payload(workflow) is None:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "case_id": str(case_id),
                    "partition_id": str(partition_id),
                    "message": "No visualization result found for this partition",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "status": workflow.status.upper(),
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "workflow_run_id": str(workflow.id),
                "result": workflow_visualization_payload(workflow),
                "updated_on": (
                    workflow.finished_at.isoformat()
                    if workflow.finished_at
                    else workflow.started_at.isoformat()
                ),
            },
            status=status.HTTP_200_OK,
        )


class VisualizationMdsMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        workflow = latest_visualization_run(partition.id)
        result = workflow_visualization_payload(workflow) if workflow else None
        if not result:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "case_id": str(case_id),
                    "partition_id": str(partition_id),
                    "message": "No visualization result found for this partition",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        metrics = result.get("metrics")
        if not isinstance(metrics, dict):
            legacy_metric = str((result.get("metadata") or {}).get("metric") or "chi").lower()
            metrics = {legacy_metric: result}

        mds_metrics = {}
        for metric_name, metric_result in metrics.items():
            if not isinstance(metric_result, dict):
                continue
            mds_metrics[str(metric_name)] = {
                "metadata": metric_result.get("metadata") or {},
                "diagnostics": metric_result.get("diagnostics"),
                "mds_2d": metric_result.get("mds_2d"),
                "mds_3d": metric_result.get("mds_3d"),
            }

        diagnostics = {
            metric_name: metric_result.get("diagnostics")
            for metric_name, metric_result in mds_metrics.items()
        }

        return Response(
            {
                "status": workflow.status.upper(),
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "workflow_run_id": str(workflow.id),
                "metadata": result.get("metadata") or {},
                "diagnostics": diagnostics,
                "metrics": mds_metrics,
                "updated_on": (
                    workflow.finished_at.isoformat()
                    if workflow.finished_at
                    else workflow.started_at.isoformat()
                ),
            },
            status=status.HTTP_200_OK,
        )


class RoiRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot run ROI for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        try:
            task_params = build_roi_task_params(request.data or {})
            decision = prepare_roi_workflow(
                partition=partition,
                user=request.user,
                task_params=task_params,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        polling_url = (
            f"/api/cases/{case_id}/partitions/{partition_id}/roi/status/{decision.task_id}/"
        )
        if not decision.should_enqueue:
            payload = roi_status_payload(decision.workflow, decision.task_id)
            payload["polling_url"] = polling_url
            response_status = (
                status.HTTP_200_OK
                if decision.reused_completed_result
                else status.HTTP_202_ACCEPTED
            )
            return Response(payload, status=response_status)

        task = compute_roi_task.apply_async(
            args=[str(decision.workflow.id)],
            task_id=decision.task_id,
            queue="roi",
        )
        return Response(
            {
                "status": "QUEUED",
                "task_id": task.id,
                "workflow_run_id": str(decision.workflow.id),
                "polling_url": (
                    f"/api/cases/{case_id}/partitions/{partition_id}/roi/status/{task.id}/"
                ),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class RoiStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id, task_id):
        try:
            cached = get_roi_progress(str(case_id), str(partition_id), str(task_id))
            if cached:
                return Response(
                    cached,
                    status=_async_response_status(cached.get("status")),
                )
        except Exception:
            pass

        try:
            task_result = AsyncResult(str(task_id))
            if task_result.ready():
                if task_result.successful():
                    result = task_result.result or {}
                    return Response(
                        {
                            "status": result.get("status", "COMPLETED"),
                            "task_id": str(task_id),
                            "result": result.get("result"),
                        },
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    {
                        "status": "FAILED",
                        "task_id": str(task_id),
                        "error": str(task_result.info),
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception:
            pass

        workflow = roi_run_for_task(case_id, partition_id, str(task_id))
        if workflow is not None:
            return Response(
                roi_status_payload(workflow, str(task_id)),
                status=_async_response_status((workflow.tags or {}).get("roi_status")),
            )

        return Response(
            {"status": "RUNNING", "task_id": str(task_id)},
            status=status.HTTP_202_ACCEPTED,
        )


class RoiLatestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        workflow = latest_roi_run(partition.id)
        if workflow is None or workflow_roi_payload(workflow) is None:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "case_id": str(case_id),
                    "partition_id": str(partition_id),
                    "message": "No ROI result found for this partition",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "status": (workflow.tags or {}).get("roi_status", "").upper(),
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "workflow_run_id": str(workflow.id),
                "result": workflow_roi_payload(workflow),
                "updated_on": (
                    (workflow.tags or {}).get("roi_finished_at")
                    or (workflow.tags or {}).get("roi_started_at")
                    or workflow.started_at.isoformat()
                ),
            },
            status=status.HTTP_200_OK,
        )


class PreprocessingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            cached = get_preprocessing_progress(str(case_id))
            if cached:
                return Response(
                    cached,
                    status=_async_response_status(cached.get("status")),
                )
        except Exception:
            pass

        metadata = metadata_for_current_selection_any_status(case_id)
        if metadata is None:
            # Valid case with no preprocessing artifacts yet — not a missing
            # resource. 200 keeps the network tab / clients from treating the
            # idle state as an error (frontend already accepts NOT_FOUND).
            return Response(
                {"status": "NOT_FOUND", "case_id": str(case_id)},
                status=status.HTTP_200_OK,
            )
        return Response(
            {
                "status": metadata.status.upper(),
                "case_id": str(case_id),
                "metadata_id": str(metadata.id),
                "sku_count": metadata.sku_count,
                "error": metadata.error,
                "updated_on": metadata.updated_at.isoformat(),
            },
            status=_async_response_status(metadata.status),
        )


def _workflow_data(workflow) -> dict:
    """The unified workflow result exposed to the frontend."""
    result = workflow.result or {}
    tags = workflow.tags or {}
    obm = result.get(workflow_store.OBM_KEY)
    return {
        "visualization": result.get(workflow_store.VISUALIZATION_KEY),
        "partition_tree": result.get(workflow_store.PARTITION_TREE_KEY),
        "sku_math": result.get(workflow_store.SKU_MATH_KEY),
        "obm": obm,
        "level_testing": result.get(workflow_store.LEVEL_TESTING_KEY),
        "coverage": result.get(workflow_store.COVERAGE_KEY),
        # The tree dialog polls this step to know when a queued OBM recompute
        # (triggered by a tree mutation) has landed.
        "partition_obm": {
            "status": tags.get("obm_status"),
            "result": {"obm_holds": (obm or {}).get("obm_holds")},
        },
    }


class PartitionWorkflowStatusView(APIView):
    """GET the partition workflow.

    Returns ``data = { visualization, partition_tree }`` where ``partition_tree``
    is the flat ``{ nodes, edges }`` graph (root "Shopper's Partition" seeded on
    first access).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        workflow, _graph = get_or_seed_graph(partition, user=request.user)
        return Response(
            {
                "status": workflow.status.upper(),
                "workflow_status": workflow.status,
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "data": _workflow_data(workflow),
                "source": "db",
            },
            status=status.HTTP_200_OK,
        )


class PartitionTreeAttributeSelectionView(APIView):
    """POST: list the attributes (and per-value client-SKU counts) available to
    expand a partition-tree node, feeding the frontend "Attribute Selection" tab.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        params = request.data or {}
        node_obj = params.get("node_obj") or {}
        if not node_obj.get("id"):
            return Response(
                {"success": False, "error": "node_obj.id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ctx = load_context(partition)
        path = node_obj.get("path") or []

        workflow = workflow_store.get_partition_workflow(partition)
        saved_colors = (
            get_attribute_colors(workflow).get(node_obj["id"], {})
            if workflow is not None
            else {}
        )

        rows = []
        attribute_values = {}
        attribute_value_counts_map = {}
        for attribute_name in selectable_attributes(ctx, node_obj):
            value_counts = attribute_value_counts(ctx, path, attribute_name)
            if not value_counts:
                continue
            rows.append([False, attribute_name, None])
            # ``attribute_values`` keeps its legacy shape (value -> client_count)
            # for the existing Attribute Selection tab; the visualization modal's
            # right sidebar reads the richer ``attribute_value_counts`` instead.
            attribute_values[attribute_name] = {
                value: client_count
                for value, (_sku_count, client_count) in value_counts.items()
            }
            attribute_value_counts_map[attribute_name] = {
                value: {"sku_count": sku_count, "client_count": client_count}
                for value, (sku_count, client_count) in value_counts.items()
            }

        payload = {
            "attributes_for_test": {
                "columns": ["is_selected", "attribute_name", "values"],
                "rows": rows,
            },
            "attribute_values": attribute_values,
            "attribute_value_counts": attribute_value_counts_map,
            "attribute_colors": saved_colors,
        }
        return Response(payload, status=status.HTTP_200_OK)


class PartitionWorkflowProcessRunView(APIView):
    """POST ``workflow/<process_name>/run/`` — the partition-tree dialog's
    "Submit attribute selection" action (``process_partition_tree``): queues
    per-node Base/Level Testing for the submitted attributes; the dialog then
    polls the node (GET ``partition-tree/nodes/<id>/``) for results."""

    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id, process_name):
        if process_name != "process_partition_tree":
            return Response(
                {"detail": f"Unknown workflow process '{process_name}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)
        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response({"detail": "Partition not found."}, status=status.HTTP_404_NOT_FOUND)
        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot run the partition-tree workflow for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        params = request.data or {}
        node_obj = params.get("node_obj") or {}
        node_id = str(node_obj.get("id") or "").strip()
        if not node_id:
            return Response(
                {"detail": "node_obj.id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attributes = _selected_attributes_from_attrs_list(params.get("attrs_list"))
        if not attributes:
            return Response(
                {"detail": "Select at least one attribute to test."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workflow, graph = get_or_seed_graph(partition, user=request.user)
        if find_node(list(graph.get("nodes") or []), node_id) is None:
            return Response(
                {"detail": f"node_id={node_id} not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Seed both the persisted key and the Redis progress cache so a poll
        # that lands before the worker picks the task up sees QUEUED.
        workflow_store.set_node_testing(
            workflow,
            {
                "node_id": node_id,
                "status": "queued",
                "updated_on": timezone.now().isoformat(),
            },
        )
        workflow.save(update_fields=["result"])

        task = compute_node_testing_task.apply_async(
            args=[str(workflow.id), node_id, attributes],
            queue="roi",
        )
        try:
            publish_node_testing_progress(
                str(case_id),
                str(partition_id),
                node_id,
                {"status": "QUEUED", "node_id": node_id, "percent": 0.0},
            )
        except Exception:
            pass

        return Response(
            {"status": "QUEUED", "task_id": str(task.id), "node_id": node_id},
            status=status.HTTP_202_ACCEPTED,
        )


def _selected_attributes_from_attrs_list(attrs_list) -> list[str]:
    """Extract the checked attribute names from the Attribute Selection tab's
    submit payload: ``{columns: ["is_selected", "attribute_name", ...],
    rows: [[bool, name, ...], ...]}``."""
    if not isinstance(attrs_list, dict):
        return []
    columns = [str(c) for c in (attrs_list.get("columns") or [])]
    rows = attrs_list.get("rows") or []
    try:
        selected_index = columns.index("is_selected")
        name_index = columns.index("attribute_name")
    except ValueError:
        return []

    out: list[str] = []
    for row in rows:
        if not isinstance(row, list) or len(row) <= max(selected_index, name_index):
            continue
        if row[selected_index] and str(row[name_index] or "").strip():
            out.append(str(row[name_index]).strip())
    return out


class PartitionTreeNodeView(APIView):
    """POST expands a node into an attribute node + value children;
    DELETE clears a node's children. Persists the updated flat graph synchronously.
    GET polls the node's Base/Level Testing run (Redis progress first, then
    the persisted ``node_testing`` result).
    """

    permission_classes = [IsAuthenticated]

    def _context(self, request, case_id, partition_id, node_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot update the partition tree for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        try:
            require_case_ready(case_id)
        except CaseNotReadyError as exc:
            return _case_not_ready_response(exc)

        workflow, graph = get_or_seed_graph(partition, user=request.user)
        nodes = list(graph.get("nodes") or [])
        node = find_node(nodes, node_id)
        if node is None:
            return Response(
                {"success": False, "error": f"node_id={node_id} not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return partition, workflow, nodes, node

    def get(self, request, case_id, partition_id, node_id):
        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)
        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response({"detail": "Partition not found."}, status=status.HTTP_404_NOT_FOUND)

        node_id = str(node_id)
        try:
            cached = get_node_testing_progress(str(case_id), str(partition_id), node_id)
            if cached:
                return Response(
                    cached, status=_async_response_status(cached.get("status"))
                )
        except Exception:
            pass

        workflow = workflow_store.get_partition_workflow(partition)
        stored = (
            workflow_store.get_node_testing(workflow) if workflow is not None else None
        )
        if stored and str(stored.get("node_id")) == node_id:
            stored_status = str(stored.get("status", "")).upper()
            payload = {
                "status": stored_status,
                "node_id": node_id,
                "percent": 100.0 if stored_status in {"COMPLETED", "FAILED"} else 0.0,
            }
            if stored_status == "COMPLETED":
                payload["data"] = {
                    "base_testing": stored.get("base_testing"),
                    "level_testing": stored.get("level_testing"),
                }
            if stored.get("error"):
                payload["error"] = stored.get("error")
            return Response(payload, status=_async_response_status(stored_status))

        return Response(
            {"status": "NOT_FOUND", "node_id": node_id},
            status=status.HTTP_200_OK,
        )

    def post(self, request, case_id, partition_id, node_id):
        attribute_name = ((request.data or {}).get("attribute_name") or "").strip()
        if not attribute_name:
            return Response(
                {"success": False, "error": "attribute_name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        context = self._context(request, case_id, partition_id, node_id)
        if isinstance(context, Response):
            return context
        partition, workflow, nodes, node = context

        if has_attribute_child(nodes, node_id, attribute_name):
            return Response(
                {
                    "success": False,
                    "error": (
                        f"This node already has an attribute child for "
                        f"'{attribute_name}'."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Replace any existing expansion of this node, then add the attribute
        # node and one value node per attribute value with SKUs.
        nodes = remove_children(nodes, node_id)
        attr_node = make_attribute_node(node, node_id, attribute_name)
        nodes = add_child(nodes, node, attr_node)

        ctx = load_context(partition)
        value_counts = attribute_value_counts(
            ctx, node.get("path") or [], attribute_name
        )
        saved_colors = get_attribute_colors(workflow).get(node_id, {}).get(
            attribute_name, {}
        )
        for value in sorted(value_counts.keys()):
            sku_count, client_count = value_counts[value]
            if sku_count <= 0:
                continue
            value_node = make_value_node(
                attr_node, attr_node["id"], attribute_name, str(value)
            )
            value_node["sku_count"] = int(sku_count)
            value_node["client_sku_count"] = int(client_count)
            saved_color = saved_colors.get(str(value))
            if saved_color:
                value_node["color"] = saved_color
            nodes = add_child(nodes, attr_node, value_node)

        save_graph(workflow, nodes)
        obm_task_id = _dispatch_obm_recompute(workflow)
        return Response(
            {
                "success": True,
                "data": _workflow_data(workflow),
                "status": "COMPLETED",
                "obm_task_id": obm_task_id,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, case_id, partition_id, node_id):
        context = self._context(request, case_id, partition_id, node_id)
        if isinstance(context, Response):
            return context
        _partition, workflow, nodes, _node = context

        new_nodes = remove_children(nodes, node_id)
        if len(new_nodes) == len(nodes):
            return Response(
                {
                    "success": True,
                    "data": _workflow_data(workflow),
                    "message": "node has no children to remove",
                },
                status=status.HTTP_200_OK,
            )

        save_graph(workflow, new_nodes)
        obm_task_id = _dispatch_obm_recompute(workflow)
        return Response(
            {
                "success": True,
                "data": _workflow_data(workflow),
                "status": "COMPLETED",
                "task_id": obm_task_id,
            },
            status=status.HTTP_200_OK,
        )


def _dispatch_obm_recompute(workflow) -> str | None:
    """Queue an OBM recompute after a tree mutation (the tree's value leaves
    define the OBM matrix — mirrors roi-backend's ``compute_obm`` dispatch).
    Marks ``tags.obm_status = queued`` first so the mutation response's
    ``partition_obm`` block already reflects the pending recompute."""
    tags = dict(workflow.tags or {})
    tags["obm_status"] = "queued"
    tags["obm_error"] = ""
    workflow.tags = tags
    workflow.save(update_fields=["tags"])

    try:
        task = compute_obm_task.apply_async(args=[str(workflow.id)], queue="roi")
        return str(task.id)
    except Exception:
        logger.exception("Failed to enqueue OBM recompute for workflow %s", workflow.id)
        tags = dict(workflow.tags or {})
        tags["obm_status"] = "failed"
        tags["obm_error"] = "Could not queue the OBM recompute."
        workflow.tags = tags
        workflow.save(update_fields=["tags"])
        return None


_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class PartitionTreeNodeColorsView(APIView):
    """PUT: persist the per-value colour map a user chose for an attribute at a
    given node. Stored under ``partition_tree.attribute_colors[node_id][attribute]``
    so it is shared across users and survives later tree mutations.
    """

    permission_classes = [IsAuthenticated]

    def put(self, request, case_id, partition_id, node_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response(
                {"detail": "Partition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot update the partition tree for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        lock_error = _partition_edit_lock_error(partition, request.user)
        if lock_error is not None:
            return lock_error

        params = request.data or {}
        attribute_name = (params.get("attribute_name") or "").strip()
        if not attribute_name:
            return Response(
                {"success": False, "error": "attribute_name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        colors = params.get("colors")
        if not isinstance(colors, dict) or not colors:
            return Response(
                {"success": False, "error": "colors must be a non-empty object"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cleaned: dict[str, str] = {}
        for value, hex_color in colors.items():
            if not isinstance(hex_color, str) or not _HEX_COLOR_RE.match(hex_color):
                return Response(
                    {
                        "success": False,
                        "error": f"Invalid hex colour for value '{value}'.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cleaned[str(value)] = hex_color

        workflow, _graph = get_or_seed_graph(partition, user=request.user)
        nodes = list((load_graph(workflow) or {}).get("nodes") or [])
        if find_node(nodes, node_id) is None:
            return Response(
                {"success": False, "error": f"node_id={node_id} not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        save_attribute_colors(workflow, node_id, attribute_name, cleaned)
        return Response(
            {"success": True, "data": _workflow_data(workflow), "status": "COMPLETED"},
            status=status.HTTP_200_OK,
        )


class UsersView(APIView):
    def get_permissions(self):
        return [
            HasAnyPermission(
                Permission.CREATE_CASES.value,
                Permission.VIEW_USERS.value,
            )()
        ]

    def get(self, request):
        users = User.objects.filter(is_active=True).order_by(
            "first_name",
            "last_name",
            "email",
        )
        return Response([serialize_user_summary(user) for user in users])


CASE_TEXT_FIELDS = {
    "name",
    "code",
    "description",
    "methodology",
    "category",
}
CASE_PATCH_FIELDS = CASE_TEXT_FIELDS | {"status", "tags"}
CASE_CREATE_FIELDS = CASE_PATCH_FIELDS | {"assignments"}
DATASET_UPLOAD_FIELDS = {
    "type",
    "file_name",
    "file_size",
    "content_type",
    "description",
    "tags",
}
DATASET_UPDATE_FIELDS = {
    "description",
    "status",
    "is_selected",
    "tags",
}


DATASET_SELECTION_FIELD_TYPES = {
    "pos_dataset_id": Dataset.Type.POS,
    "attributes_dataset_id": Dataset.Type.ATTRIBUTES,
    "cross_purchase_dataset_id": Dataset.Type.CROSS_PURCHASE,
}


class CaseDatasetSelectionView(APIView):
    """Atomically confirm a case's POS/ATTRIBUTES/CROSSPURCHASE dataset
    combination and dispatch preprocessing exactly once (or skip dispatch
    entirely if that combination is already READY/RUNNING) — replaces firing
    one independent PATCH per changed dataset type."""

    permission_classes = [HasPermission(Permission.EDIT_DATASETS.value)]

    def post(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response(
                {"detail": "Case not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot change datasets for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}
        if not isinstance(data, dict):
            return Response(
                {"detail": "Payload must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                locked_partitions = _locked_partitions_summary(
                    case.id,
                    lock_rows=True,
                )
                if locked_partitions:
                    return Response(
                        {
                            "detail": (
                                f"{len(locked_partitions)} partition(s) are currently "
                                "being edited; cannot change datasets until they're "
                                "released."
                            ),
                            "locked_partitions": locked_partitions,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                for field_name, dataset_type in DATASET_SELECTION_FIELD_TYPES.items():
                    if field_name not in data or data.get(field_name) is None:
                        continue
                    dataset = get_active_dataset(case_id, data.get(field_name))
                    if dataset is None or dataset.type != dataset_type:
                        return Response(
                            {"detail": f"Invalid {field_name}."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    _select_and_ingest_dataset(dataset)

                preprocessing = _dispatch_preprocessing(case.id)
        except DatasetIngestionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(preprocessing, status=status.HTTP_202_ACCEPTED)


def _case_not_ready_response(exc: CaseNotReadyError) -> Response:
    return Response(
        {"status": exc.status, "detail": exc.message},
        status=status.HTTP_409_CONFLICT,
    )


def _locked_partitions_summary(case_id, *, lock_rows=False) -> list[dict]:
    """Return effective active leases, optionally locking every case partition row."""
    partitions = Partition.objects.filter(
        case_id=case_id,
        is_deleted=False,
    ).order_by("-lock_expires_at")
    if lock_rows:
        # Lock Partition rows alone. select_related("locked_by") adds a LEFT OUTER
        # JOIN that Postgres rejects with FOR UPDATE; of=("self",) also fails
        # because Meta.db_table is schema-qualified ("core"."partitions").
        partitions = partitions.select_for_update()
    else:
        partitions = partitions.select_related("locked_by")

    now = timezone.now()
    summary = []
    for partition in partitions:
        lock = _active_partition_lock(partition, now=now)
        if lock is None:
            continue
        summary.append(
            {
                "id": str(partition.id),
                "name": partition.name,
                **lock,
            }
        )
    return summary


def _select_and_ingest_dataset(dataset) -> None:
    """Flip ``is_selected`` on and (re-)ingest — the shared "select this
    dataset version" step used by both the atomic selection endpoint and
    (via ``CaseDatasetDetailView.patch``) the older per-dataset PATCH path."""
    dataset.is_selected = True
    dataset.status = Dataset.Status.PROCESSING
    dataset.save(update_fields=["is_selected", "status", "updated_at"])
    ingest_dataset(dataset)


def _dispatch_preprocessing(case_id) -> dict:
    """Enqueue ``preprocess_case_task`` for the case's current dataset
    combination — unless that exact signature is already READY or RUNNING,
    in which case return its status synchronously with no Celery dispatch
    (this is the "preserve combinations" reuse behavior).

    Seeds Redis with QUEUED immediately so a status poll that lands before
    the worker starts does not fall through to NOT_FOUND (same pattern as
    node-testing progress seeding).
    """
    case_id = str(case_id)
    existing = metadata_for_current_selection_any_status(case_id)
    if existing is not None and existing.status in (
        Metadata.Status.READY,
        Metadata.Status.RUNNING,
    ):
        return {
            "status": existing.status.upper(),
            "case_id": case_id,
            "metadata_id": str(existing.id),
        }

    try:
        preprocess_case_task.apply_async(args=[case_id], queue="preprocessing")
    except Exception:
        logger.exception("Failed to enqueue preprocessing for case %s", case_id)
        return {"status": "FAILED", "case_id": case_id, "detail": "Could not start preprocessing."}

    queued = {"status": "QUEUED", "case_id": case_id, "percent": 0.0}
    try:
        publish_preprocessing_progress(case_id, queued)
    except Exception:
        logger.exception(
            "Failed to publish QUEUED preprocessing progress for case %s", case_id
        )

    return queued


class CasePreprocessingRunView(APIView):
    """Explicitly (re-)dispatch preprocessing for the case's CURRENT dataset
    selection — unlike ``CaseDatasetSelectionView``, this never touches
    dataset selection or re-ingests anything. Covers two cases the atomic
    selection endpoint can't: first-time setup (each dataset auto-selects
    itself on upload, so there's no selection diff to "save") and manually
    re-triggering a stuck/failed run for the already-correct combination."""

    permission_classes = [HasPermission(Permission.EDIT_DATASETS.value)]

    def post(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot start preprocessing for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            locked_partitions = _locked_partitions_summary(
                case.id,
                lock_rows=True,
            )
            if locked_partitions:
                return Response(
                    {
                        "detail": (
                            f"{len(locked_partitions)} partition(s) are currently being "
                            "edited; cannot start preprocessing until they're released."
                        ),
                        "locked_partitions": locked_partitions,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            preprocessing = _dispatch_preprocessing(case.id)

        return Response(preprocessing, status=status.HTTP_202_ACCEPTED)


class CasePartitionLocksReleaseView(APIView):
    """Force-release every active lock on the case's partitions. Restricted
    to the case-level PUBLISHER (or a global admin/owner) — unblocks dataset
    changes/preprocessing when other users have left partitions locked."""

    permission_classes = [IsAuthenticated]

    def post(self, request, case_id):
        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)

        if not can_manage_case_locks(request.user, case):
            return Response(
                {"detail": "Only a case publisher can release partition locks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            released = _locked_partitions_summary(case.id, lock_rows=True)
            if released:
                Partition.objects.filter(
                    id__in=[item["id"] for item in released]
                ).update(
                    locked_by=None,
                    lock_expires_at=None,
                    updated_at=timezone.now(),
                )

        return Response(
            {"released_count": len(released), "released_partitions": released},
            status=status.HTTP_200_OK,
        )


class PartitionLockView(APIView):
    """Acquire/renew or release a partition's edit lock.

    Wires up the previously inert ``Partition.locked_by``/``lock_expires_at``
    fields: dataset-selection changes (``CaseDatasetSelectionView``) refuse to
    proceed while any partition under the case holds an active, unexpired
    lock.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)
        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response({"detail": "Partition not found."}, status=status.HTTP_404_NOT_FOUND)

        if not can_edit_workflow(request.user, case):
            return Response(
                {"detail": "User cannot edit workflows for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            partition = (
                Partition.objects.select_for_update()
                .get(id=partition.id)
            )
            active_lock = _active_partition_lock(partition)
            if (
                active_lock is not None
                and partition.locked_by_id != request.user.id
            ):
                return _partition_lock_conflict_response(
                    partition,
                    lock=active_lock,
                )

            partition.locked_by = request.user
            partition.lock_expires_at = timezone.now() + timedelta(
                seconds=settings.LOCK_TTL_SECONDS
            )
            partition.save(update_fields=["locked_by", "lock_expires_at", "updated_at"])
            lock = _active_partition_lock(partition)

        return Response(lock, status=status.HTTP_200_OK)

    def delete(self, request, case_id, partition_id):
        case = get_active_case(case_id)
        if case is None:
            return Response({"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND)
        partition = get_active_partition(case, partition_id)
        if partition is None:
            return Response({"detail": "Partition not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            partition = (
                Partition.objects.select_for_update()
                .get(id=partition.id)
            )
            active_lock = _active_partition_lock(partition)
            if (
                active_lock is not None
                and partition.locked_by_id != request.user.id
            ):
                return _partition_lock_conflict_response(
                    partition,
                    lock=active_lock,
                )

            if (
                partition.locked_by_id is not None
                or partition.lock_expires_at is not None
            ):
                partition.locked_by = None
                partition.lock_expires_at = None
                partition.save(
                    update_fields=["locked_by", "lock_expires_at", "updated_at"]
                )

        return Response(status=status.HTTP_204_NO_CONTENT)


def build_roi_task_params(payload):
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object.")

    return {
        "include_attributes": parse_task_bool(payload.get("include_attributes"), default=True),
        "include_obm": parse_task_bool(payload.get("include_obm"), default=True),
        "include_level_testing": parse_task_bool(payload.get("include_level_testing"), default=True),
        "include_coverage": parse_task_bool(payload.get("include_coverage"), default=True),
    }


def build_visualization_task_params(payload):
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object.")

    raw_metrics = payload.get("metrics")
    metrics = None
    if raw_metrics is not None:
        if not isinstance(raw_metrics, list):
            raise ValueError("metrics must be a list of 'chi' and/or 'phi'")
        metrics = []
        for raw_metric in raw_metrics:
            metric = str(raw_metric).strip().lower()
            if metric not in {"chi", "phi"}:
                raise ValueError("metrics must contain only 'chi' or 'phi'")
            if metric not in metrics:
                metrics.append(metric)
        if not metrics:
            raise ValueError("metrics must include at least one metric")
    else:
        metric = str(payload.get("metric") or "chi").strip().lower()
        if metric not in {"chi", "phi"}:
            raise ValueError("metric must be 'chi' or 'phi'")

    try:
        random_state = int(payload.get("random_state") or 1234)
    except (TypeError, ValueError) as exc:
        raise ValueError("random_state must be an integer") from exc

    task_params = {
        "include_attributes": parse_task_bool(
            payload.get("include_attributes"),
            default=True,
        ),
        "include_roi_matrix": parse_task_bool(
            payload.get("include_roi_matrix"),
            default=False,
        ),
        "random_state": random_state,
    }
    if metrics is not None:
        task_params["metrics"] = metrics
    else:
        task_params["metric"] = metric
    return task_params


def parse_task_bool(value, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return True
        if normalized in {"false", "0", "no", "n"}:
            return False
    raise ValueError("Expected a boolean value")


def _async_response_status(status_value):
    """200 for terminal/idle states, 202 for in-flight ones. COMPLETED/FAILED
    are the visualization/ROI vocabulary, READY/NOT_FOUND the preprocessing
    ones — they never overlap, so one mapper serves all three pipelines."""
    normalized = str(status_value or "").upper()
    if normalized in {"COMPLETED", "FAILED", "READY", "NOT_FOUND"}:
        return status.HTTP_200_OK
    return status.HTTP_202_ACCEPTED


def validate_case_payload(data, partial=False, case=None):
    errors = {}
    if not isinstance(data, dict):
        return {"detail": ["Payload must be a JSON object."]}

    allowed_fields = CASE_PATCH_FIELDS if partial else CASE_CREATE_FIELDS
    unknown_fields = sorted(set(data) - allowed_fields)
    if unknown_fields:
        errors["detail"] = [
            "Unknown field(s): " + ", ".join(unknown_fields) + "."
        ]

    if partial and not data:
        errors["detail"] = ["At least one field is required."]

    if (not partial or "name" in data) and not clean_text(data.get("name")):
        errors["name"] = ["Name is required."]

    if (not partial or "code" in data) and not clean_text(data.get("code")):
        errors["code"] = ["Code is required."]

    if not partial or "status" in data:
        status_value = clean_text(data.get("status"))
        if not status_value and not partial:
            status_value = Case.Status.DRAFT
        valid_statuses = {value for value, _label in Case.Status.choices}
        if status_value not in valid_statuses:
            errors["status"] = ["Status must be draft, active, archived, or completed."]

    if not partial or "methodology" in data:
        methodology_value = clean_text(data.get("methodology"))
        valid_methodologies = {"roi", "visualization", "combined"}
        if methodology_value and methodology_value.lower() not in valid_methodologies:
            errors["methodology"] = [
                "Methodology must be roi, visualization, or combined."
            ]
        elif not partial and not methodology_value:
            errors["methodology"] = ["Methodology is required."]

    if "tags" in data and not isinstance(data.get("tags"), dict):
        errors["tags"] = ["Tags must be a JSON object."]

    if not partial:
        assignments = data.get("assignments")
        if assignments is not None and not isinstance(assignments, list):
            errors["assignments"] = ["Assignments must be a list."]
        elif isinstance(assignments, list):
            errors.update(validate_assignments(assignments))

    code = clean_text(data.get("code"))
    if code:
        duplicate_codes = Case.objects.filter(code=code, is_deleted=False)
        if case is not None:
            duplicate_codes = duplicate_codes.exclude(id=case.id)
        if duplicate_codes.exists():
            errors["code"] = ["A case with this code already exists."]

    return errors


def validate_partition_payload(data, case):
    errors = {}
    if not isinstance(data, dict):
        return {"detail": ["Payload must be a JSON object."]}

    if not clean_text(data.get("name")):
        errors["name"] = ["Name is required."]

    status_value = clean_text(data.get("status")) or Partition.Status.DRAFT
    valid_statuses = {value for value, _label in Partition.Status.choices}
    if status_value not in valid_statuses:
        errors["status"] = ["Status must be draft, active, or archived."]

    if "tags" in data and not isinstance(data.get("tags"), dict):
        errors["tags"] = ["Tags must be a JSON object."]

    base_partition_id = clean_text(data.get("base_partition"))
    if base_partition_id and not is_valid_uuid(base_partition_id):
        errors["base_partition"] = ["Base partition must be a valid UUID."]
    elif base_partition_id and not Partition.objects.filter(
        id=base_partition_id,
        case=case,
        is_deleted=False,
    ).exists():
        errors["base_partition"] = ["Base partition must belong to this case."]

    for field_name in ("locked_by", "lock_expires_at"):
        if field_name in data:
            errors[field_name] = ["This field is managed by the server."]

    return errors


def get_active_partition(case, partition_id):
    try:
        return Partition.objects.get(
            id=partition_id,
            case=case,
            is_deleted=False,
        )
    except (Partition.DoesNotExist, ValueError):
        return None


def validate_selected_skus_input(value):
    if not isinstance(value, list):
        return {"selected_skus": ["selected_skus must be a list."]}

    normalized = [clean_text(item) for item in value]
    if any(not sku for sku in normalized):
        return {"selected_skus": ["selected_skus cannot contain blank values."]}

    seen = set()
    duplicates = []
    for sku in normalized:
        if sku in seen and sku not in duplicates:
            duplicates.append(sku)
        seen.add(sku)

    if duplicates:
        return {
            "selected_skus": [
                "Duplicate SKU(s): " + ", ".join(duplicates) + "."
            ]
        }

    return {}


def validate_dataset_upload_payload(data):
    errors = {}
    if not isinstance(data, dict):
        return {"detail": ["Payload must be a JSON object."]}

    unknown_fields = sorted(set(data) - DATASET_UPLOAD_FIELDS)
    if unknown_fields:
        errors["detail"] = [
            "Unknown field(s): " + ", ".join(unknown_fields) + "."
        ]

    dataset_type = clean_text(data.get("type"))
    valid_types = {value for value, _label in Dataset.Type.choices}
    if dataset_type not in valid_types:
        errors["type"] = [
            "Type must be pos, attributes, or cross_purchase."
        ]

    if not clean_text(data.get("file_name")):
        errors["file_name"] = ["File name is required."]

    file_size = parse_positive_int(data.get("file_size"))
    if file_size is None:
        errors["file_size"] = ["File size must be a positive integer."]
    elif file_size > settings.AZURE_MAX_UPLOAD_BYTES:
        errors["file_size"] = [
            f"File size must be less than or equal to "
            f"{settings.AZURE_MAX_UPLOAD_BYTES} bytes."
        ]

    if "tags" in data and not isinstance(data.get("tags"), dict):
        errors["tags"] = ["Tags must be a JSON object."]

    return errors


def validate_dataset_update_payload(data):
    errors = {}
    if not isinstance(data, dict):
        return {"detail": ["Payload must be a JSON object."]}

    unknown_fields = sorted(set(data) - DATASET_UPDATE_FIELDS)
    if unknown_fields:
        errors["detail"] = [
            "Unknown field(s): " + ", ".join(unknown_fields) + "."
        ]

    if not data:
        errors["detail"] = ["At least one field is required."]

    if "status" in data:
        status_value = clean_text(data.get("status"))
        valid_statuses = {value for value, _label in Dataset.Status.choices}
        if status_value not in valid_statuses:
            errors["status"] = [
                "Status must be processing, ready, failed, or archived."
            ]

    if "is_selected" in data and not isinstance(data.get("is_selected"), bool):
        errors["is_selected"] = ["Selected must be true or false."]

    if "tags" in data and not isinstance(data.get("tags"), dict):
        errors["tags"] = ["Tags must be a JSON object."]

    return errors


def validate_assignments(assignments):
    errors = {}
    valid_roles = {value for value, _label in CaseUserAssignment.Role.choices}
    seen_user_ids = set()

    for index, assignment in enumerate(assignments):
        key = f"assignments[{index}]"
        if not isinstance(assignment, dict):
            errors[key] = ["Assignment must be an object."]
            continue

        user_id = clean_text(assignment.get("user_id"))
        role = clean_text(assignment.get("role")) or CaseUserAssignment.Role.VIEWER

        if not user_id:
            errors[key] = ["User is required."]
            continue

        if not is_valid_uuid(user_id):
            errors[key] = ["User must be a valid UUID."]
            continue

        if user_id in seen_user_ids:
            errors[key] = ["User is assigned more than once."]
            continue

        seen_user_ids.add(user_id)

        if role not in valid_roles:
            errors[key] = ["Role must be publisher, editor, or viewer."]

    if seen_user_ids:
        found_count = User.objects.filter(id__in=seen_user_ids, is_active=True).count()
        if found_count != len(seen_user_ids):
            errors["assignments"] = ["One or more selected users could not be found."]

    return errors


def serialize_partition(partition):
    lock = _active_partition_lock(partition)
    return {
        "id": str(partition.id),
        "case_id": str(partition.case_id),
        "name": partition.name,
        "description": partition.description,
        "status": partition.status,
        "is_shared": partition.is_shared,
        "is_deleted": partition.is_deleted,
        "tags": partition.tags,
        "base_partition": (
            str(partition.base_partition_id) if partition.base_partition_id else None
        ),
        "locked_by": lock["locked_by"] if lock else None,
        "locked_by_display_name": (
            lock["locked_by_display_name"] if lock else None
        ),
        "lock_expires_at": lock["lock_expires_at"] if lock else None,
        "created_by": str(partition.created_by_id) if partition.created_by_id else None,
        "updated_by": str(partition.updated_by_id) if partition.updated_by_id else None,
        "created_at": partition.created_at.isoformat(),
        "updated_at": partition.updated_at.isoformat(),
    }
