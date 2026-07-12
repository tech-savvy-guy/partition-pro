import uuid
from decimal import Decimal

from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from django.utils import timezone
from django.utils.functional import partition
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.db import transaction
from reports.tasks import ingest_dataset_task
from reports.services.ingestion.ingest import ingest_partition_grouping_logic, build_partition_effective_attributes
from reports.services.ingestion.errors import IngestionDataError, format_ingestion_error
from reports.services.workflow.progress import clear_all_partition_tree_progress
from utilities.custom_logger import get_file_logger
from rest_framework.permissions import IsAuthenticated
from datetime import datetime, timedelta
from reports.models import Case, DatasetMetadata, UserAssignment, Partitions, PartitionsRawDatasetMapping, \
    PartitionDatasetMetadata

VALID_DATA_TYPES = ["POS", "ATTRIBUTES", "CROSSPURCHASE"]
VALID_PARTITION_DATA_TYPES = ["GROUPING"]
logger = get_file_logger()


class DatasetUploadUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, data_type):
        file_name = request.data.get("file_name")

        if not case_id or not data_type or not file_name:
            return Response(
                {"error": "case_id, data_type and file_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data_type not in VALID_DATA_TYPES:
            return Response(
                {"error": f"Invalid data_type. Must be one of {VALID_DATA_TYPES}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        latest = (
            DatasetMetadata.objects
            .filter(case=case, data_type=data_type, is_deleted=False)
            .order_by("-version")
            .first()
        )
        next_version = (latest.version + 1) if latest else 1

        blob_name = f"case/{case.id}/{data_type}/v{next_version}/{file_name}"

        sas_token = generate_blob_sas(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            container_name=settings.AZURE_UPLOAD_CONTAINER_NAME,
            account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
            blob_name=blob_name,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.utcnow() + timedelta(minutes=15),
            content_disposition=f'attachment; filename="{file_name}"'
        )
        blob_base_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{settings.AZURE_UPLOAD_CONTAINER_NAME}"
        c_blob_name = f"{blob_base_url}/{blob_name}"
        upload_url = f"{c_blob_name}?{sas_token}"

        return Response(
            {
                "upload_url": upload_url,
                "blob_name": blob_name,
                "version": next_version,
                "case_id": str(case.id),
                "data_type": data_type,
            },
            status=status.HTTP_200_OK,
        )


class DatasetFileUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, dataset_id):
        if not case_id or not dataset_id:
            return Response(
                {"error": "case_id and dataset_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        dm = (
            DatasetMetadata.objects
            .get(case=case, id=dataset_id, is_deleted=False)
        )

        sas_token = generate_blob_sas(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            container_name=settings.AZURE_UPLOAD_CONTAINER_NAME,
            account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
            blob_name=dm.blob_name,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(minutes=15)
        )
        blob_base_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{settings.AZURE_UPLOAD_CONTAINER_NAME}"
        c_blob_name = f"{blob_base_url}/{dm.blob_name}"
        file_url = f"{c_blob_name}?{sas_token}"

        return Response(
            {
                "file_url": file_url,
                "blob_name": dm.blob_name,
                "case_id": str(case.id)
            },
            status=status.HTTP_200_OK,
        )


class PartitionDatasetFileUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id, dataset_id):
        if not case_id or not dataset_id or not partition_id:
            return Response(
                {"error": "case_id and dataset_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        # Validate partition
        try:
            partition_obj = Partitions.objects.get(id=partition_id, is_deleted=False)
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)

        dm = (
            PartitionDatasetMetadata.objects
            .get(case=case, partition=partition_obj, id=dataset_id, is_deleted=False)
        )

        sas_token = generate_blob_sas(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            container_name=settings.AZURE_UPLOAD_CONTAINER_NAME,
            account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
            blob_name=dm.blob_name,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(minutes=15)
        )
        blob_base_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{settings.AZURE_UPLOAD_CONTAINER_NAME}"
        c_blob_name = f"{blob_base_url}/{dm.blob_name}"
        file_url = f"{c_blob_name}?{sas_token}"

        return Response(
            {
                "file_url": file_url,
                "blob_name": dm.blob_name,
                "case_id": str(case.id),
                "partition_id": str(partition_obj.id)
            },
            status=status.HTTP_200_OK,
        )


class DatasetConfirmUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, data_type):
        user = request.user
        file_name = request.data.get("file_name")
        blob_name = request.data.get("blob_name")
        version = request.data.get("version")
        description = request.data.get("description") or ""
        file_size = request.data.get("file_size")

        if not all([case_id, data_type, file_name, blob_name, version]):
            return Response(
                {"error": "case_id, data_type, file_name, blob_name, version are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        metadata = DatasetMetadata.objects.create(
            id=uuid.uuid4(),
            created_on=now,
            created_by=user.email,
            is_deleted=False,
            case=case,
            data_type=data_type,
            file_name=file_name,
            version=int(version),
            description=description,
            file_size=Decimal(file_size) if file_size is not None else None,
            blob_name=blob_name,
            status="Processing",
            tags={},
            is_selected=True,
        )

        # Unselect older versions for this data_type
        DatasetMetadata.objects.filter(
            case=case,
            data_type=data_type,
            is_deleted=False
        ).exclude(id=metadata.id).update(is_selected=False)

        # Push task to Azure Redis for engine microservice
        task_payload = {
            "dataset_id": str(metadata.id),
            "case_id": str(case.id),
            "data_type": data_type,
            "version": metadata.version,
            "blob_name": metadata.blob_name,
            "file_name": metadata.file_name,
            "uploaded_by": user.email,
            "created_on": metadata.created_on.isoformat(),
        }
        # from reports.redis_client import enqueue_dataset_ingest_task
        # enqueue_dataset_ingest_task(task_payload)
        ingest_dataset_task.apply_async(args=[task_payload, str(request.user)], queue="ingest")

        return Response(
            {
                "success": True,
                "message": "Metadata saved for uploaded blob",
                "dataset": {
                    "id": str(metadata.id),
                    "case_id": str(case.id),
                    "data_type": metadata.data_type,
                    "version": metadata.version,
                    "blob_name": metadata.blob_name,
                    "file_name": metadata.file_name,
                    "is_selected": metadata.is_selected,
                },
            },
            status=status.HTTP_201_CREATED,
        )


def is_super_admin(user):
    return getattr(user, "role", None) and user.role.role_name == "TECH_ADMIN"


def is_bba_admin(user):
    return getattr(user, "role", None) and user.role.role_name == "BBA_ADMIN"


class DatasetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id):
        user = request.user

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view datasets for this case"},
                    status=403,
                )

        # results = {dt: [] for dt in VALID_DATA_TYPES}
        results = []
        datasets = (
            DatasetMetadata.objects
            .filter(case=case, is_deleted=False)
            .order_by("data_type", "-version")
        )

        for ds in datasets:
            results.append({
                "id": str(ds.id),
                "data_type": ds.data_type,
                "version": ds.version,
                "file_name": ds.file_name,
                "blob_name": ds.blob_name,
                "is_selected": ds.is_selected,
                "status": ds.status,
                "created_on": ds.created_on.isoformat(),
                "created_by": ds.created_by,
                "tags": ds.tags,
            })

        return Response(
            {
                "case_id": str(case.id),
                "datasets": results,
            },
            status=200,
        )


class DatasetVersionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, data_type):
        user = request.user

        if data_type not in VALID_DATA_TYPES:
            return Response(
                {"error": f"Invalid data_type. Must be one of {VALID_DATA_TYPES}"},
                status=400,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view dataset versions for this case"},
                    status=403,
                )

        qs = (
            DatasetMetadata.objects
            .filter(case=case, data_type=data_type, is_deleted=False)
            .order_by("-version")
        )

        versions = []
        for ds in qs:
            versions.append({
                "id": str(ds.id),
                "version": ds.version,
                "file_name": ds.file_name,
                "blob_name": ds.blob_name,
                "is_selected": ds.is_selected,
                "status": ds.status,
                "created_on": ds.created_on.isoformat(),
                "created_by": ds.created_by,
                "tags": ds.tags,
            })

        return Response(
            {
                "case_id": str(case.id),
                "data_type": data_type,
                "versions": versions,
            },
            status=200,
        )


#########
class DatasetActionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, data_type, dataset_id):
        user = request.user

        if data_type not in VALID_DATA_TYPES:
            return Response(
                {"error": f"Invalid data_type. Must be one of {VALID_DATA_TYPES}"},
                status=400,
            )

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view dataset versions for this case"},
                    status=403,
                )

        try:
            ds = DatasetMetadata.objects.get(
                id=dataset_id, case=case, data_type=data_type, is_deleted=False
            )
        except DatasetMetadata.DoesNotExist:
            return Response({"error": "Dataset not found"}, status=404)

        # Select this version, unselect others
        DatasetMetadata.objects.filter(
            case=case, data_type=data_type, is_deleted=False
        ).update(is_selected=False)

        ds.is_selected = True
        ds.save(update_fields=["is_selected"])

        return Response(
            {
                "success": True,
                "message": "Dataset version marked as selected",
                "dataset": {
                    "id": str(ds.id),
                    "case_id": str(case.id),
                    "data_type": ds.data_type,
                    "version": ds.version,
                    "is_selected": ds.is_selected,
                    "file_name": ds.file_name,
                },
            },
            status=200,
        )

    def get(self, request, case_id, partition_id):
        user = request.user

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view dataset versions for this case"},
                    status=403,
                )

        try:
            partition = Partitions.objects.get(
                id=partition_id, case=case, is_deleted=False
            )
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=404)

        mappings = (
            PartitionsRawDatasetMapping.objects
            .filter(partition=partition)
            .select_related("dataset")
        )

        ds_list = []
        for m in mappings:
            ds = m.dataset
            ds_list.append({
                "data_type": m.data_type,
                "dataset_id": str(ds.id),
                "version": ds.version,
                "file_name": ds.file_name,
                "blob_name": ds.blob_name,
                "is_selected": ds.is_selected,
                "status": ds.status,
            })

        return Response(
            {
                "case_id": str(case.id),
                "partition_id": str(partition.id),
                "partition_name": partition.partition_name,
                "datasets": ds_list,
            },
            status=200,
        )


##########

class DatasetBulkSelectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id):
        user = request.user
        dataset_ids = request.data.get("dataset_ids")

        if not isinstance(dataset_ids, list) or not dataset_ids:
            return Response(
                {"error": "dataset_ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to update datasets for this case"},
                    status=403,
                )

        valid_ids = set(
            DatasetMetadata.objects.filter(
                case=case,
                is_deleted=False,
                id__in=dataset_ids,
            ).values_list("id", flat=True)
        )

        if len(valid_ids) != len(dataset_ids):
            return Response(
                {"error": "One or more dataset_ids are invalid for this case"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        DatasetMetadata.objects.filter(
            case=case,
            is_deleted=False,
        ).update(is_selected=False)

        DatasetMetadata.objects.filter(
            id__in=valid_ids
        ).update(is_selected=True)

        return Response(
            {
                "success": True,
                "case_id": str(case.id),
                "selected_dataset_ids": list(map(str, valid_ids)),
            },
            status=status.HTTP_200_OK,
        )


# For Upload of Grouping-sheet within a partition

class PartitionDatasetUploadUrlView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id, data_type):
        file_name = request.data.get("file_name")

        if not case_id or not data_type or not file_name or not partition_id:
            return Response(
                {"error": "case_id, partition_id, data_type and file_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data_type not in VALID_PARTITION_DATA_TYPES:
            return Response(
                {"error": f"Invalid data_type. Must be one of {VALID_PARTITION_DATA_TYPES}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        # Validate partition
        try:
            partition = Partitions.objects.get(id=partition_id, case=case, is_deleted=False)
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if existing file exists (for warning)
        existing = (
            PartitionDatasetMetadata.objects
            .filter(partition=partition, data_type=data_type, is_deleted=False)
            .first()
        )

        has_existing = existing is not None

        # Always use version 1 (single file per partition + data_type)
        version = 1
        blob_name = f"case/{case.id}/partition/{partition.id}/{data_type}/v{version}/{file_name}"

        sas_token = generate_blob_sas(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            container_name=settings.AZURE_UPLOAD_CONTAINER_NAME,
            account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
            blob_name=blob_name,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=datetime.utcnow() + timedelta(minutes=15),
            content_disposition=f'attachment; filename="{file_name}"'
        )
        blob_base_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{settings.AZURE_UPLOAD_CONTAINER_NAME}"
        c_blob_name = f"{blob_base_url}/{blob_name}"
        upload_url = f"{c_blob_name}?{sas_token}"

        return Response(
            {
                "upload_url": upload_url,
                "blob_name": blob_name,
                "version": version,
                "case_id": str(case.id),
                "partition_id": str(partition.id),
                "data_type": data_type,
                "has_existing_file": has_existing,
                "warning": "A grouping sheet already exists for this partition. Uploading will replace it." if has_existing else None,
            },
            status=status.HTTP_200_OK,
        )


class PartitionDatasetConfirmUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id, data_type):
        user = request.user
        file_name = request.data.get("file_name")
        blob_name = request.data.get("blob_name")
        version = request.data.get("version")
        description = request.data.get("description") or ""
        file_size = request.data.get("file_size")

        if not all([case_id, partition_id, data_type, file_name, blob_name, version]):
            return Response(
                {"error": "case_id, partition_id, data_type, file_name, blob_name, version are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if data_type not in VALID_PARTITION_DATA_TYPES:
            return Response(
                {"error": f"Invalid data_type. Must be one of {VALID_PARTITION_DATA_TYPES}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate case
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        # Validate partition
        try:
            partition = Partitions.objects.get(id=partition_id, case=case, is_deleted=False)
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(case=case, user=user, is_deleted=False).exists()
            if not is_assigned:
                return Response(
                    {"error": "Not allowed to upload datasets for this partition"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        with transaction.atomic():
            # Hard delete existing file for this partition + data_type
            PartitionDatasetMetadata.objects.filter(
                case=case,
                partition=partition,
                data_type=data_type,
            ).delete()

            # Create new metadata record with status="Processing"
            now = timezone.now()
            metadata = PartitionDatasetMetadata.objects.create(
                id=uuid.uuid4(),
                created_on=now,
                created_by=user.email,
                is_deleted=False,
                case=case,
                partition=partition,
                data_type=data_type,
                file_name=file_name,
                version=1,
                description=description,
                file_size=Decimal(file_size) if file_size is not None else None,
                blob_name=blob_name,
                status="Processing",
                tags={},
            )

        # Call ingestion logic synchronously
        try:
            payload = {
                "partition_dataset_id": str(metadata.id),
                "partition_id": str(partition.id),
                "case_id": str(case.id),
                "blob_name": blob_name,
            }

            ingest_partition_grouping_logic(payload)

            # Mark GROUPING as Ready
            metadata.status = "Ready"
            metadata.save(update_fields=["status"])

            # Build working effective attributes immediately after GROUPING ingestion
            if data_type == "GROUPING":

                att_dataset_id = str(partition.ppm.att_dataset_id)
                cp_dataset_id = str(
                    partition.ppm.cp_dataset_id) if partition.ppm and partition.ppm.cp_dataset_id else None

                logger.info(
                    f"Building working effective attributes for case={case.id}, "
                    f"partition={partition.id}, grouping_metadata_id={metadata.id}, "
                    f"att_dataset_id={att_dataset_id}"
                )

                result = build_partition_effective_attributes(
                    case_id=str(case.id),
                    partition_id=str(partition.id),
                    att_dataset_id=att_dataset_id,
                    grouping_metadata_id=str(metadata.id),
                    cp_dataset_id=cp_dataset_id,
                )

                logger.info(
                    "Working attributes created "
                    f"rows={result.get('output_rows')}, "
                    f"attr_skus={result.get('attribute_skus')}, "
                    f"grouping_skus={result.get('grouping_skus')}, "
                    f"grouping_only_cols={result.get('grouping_only_columns')}"
                )

        except Exception as exc:
            error_message = format_ingestion_error(exc, include_hint=False)
            error_hint = exc.hint if isinstance(exc, IngestionDataError) else None
            metadata.status = "Failed"
            metadata.save(update_fields=["status"])
            logger.exception(f"Failed to ingest partition grouping data: {exc}")

            return Response(
                {
                    "success": False,
                    "error": f"Ingestion failed: {error_message}",
                    "hint": error_hint,
                    "dataset": {
                        "id": str(metadata.id),
                        "status": metadata.status,
                    },
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Clear partition-tree progress for every node so stale node-level status is not shown after a new upload.
        try:
            clear_all_partition_tree_progress(str(case.id), str(partition.id))
        except Exception:
            logger.exception(
                "Failed to clear partition-tree progress for case=%s partition=%s",
                case.id,
                partition.id,
            )


        return Response(
            {
                "success": True,
                "message": "Partition dataset uploaded and ingested successfully",
                "dataset": {
                    "id": str(metadata.id),
                    "case_id": str(case.id),
                    "partition_id": str(partition.id),
                    "data_type": metadata.data_type,
                    "version": metadata.version,
                    "blob_name": metadata.blob_name,
                    "file_name": metadata.file_name,
                    "file_size": str(metadata.file_size) if metadata.file_size else None,
                    "is_selected": metadata.is_selected,
                    "status": metadata.status,
                    "created_on": metadata.created_on.isoformat(),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class PartitionDatasetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, case_id, partition_id):
        user = request.user

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        # Permission check
        if not (is_super_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view datasets for this partition"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            partition = Partitions.objects.get(
                id=partition_id, case=case, is_deleted=False
            )
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get all non-deleted datasets for this partition
        datasets = PartitionDatasetMetadata.objects.filter(
            case=case,
            partition=partition,
            is_deleted=False
        ).order_by("-created_on")

        ds_list = []
        for ds in datasets:
            ds_list.append({
                "id": str(ds.id),
                "data_type": ds.data_type,
                "file_name": ds.file_name,
                "file_size": str(ds.file_size) if ds.file_size else None,
                "blob_name": ds.blob_name,
                "is_selected": ds.is_selected,
                "status": ds.status,
                "version": ds.version,
                "created_on": ds.created_on.isoformat(),
                "created_by": ds.created_by,
                "description": ds.description,
            })

        return Response(
            {
                "success": True,
                "case_id": str(case.id),
                "partition_id": str(partition.id),
                "partition_name": partition.partition_name,
                "datasets": ds_list,
            },
            status=status.HTTP_200_OK,
        )
