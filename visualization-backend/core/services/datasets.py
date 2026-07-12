from django.conf import settings
from django.db.models import Max

from core.models import Dataset
from core.services.storage import (
    BlobSasPermissions,
    ensure_azure_storage_configured,
    generate_blob_sas_url,
    safe_blob_file_name,
)
from core.services.utils import clean_text
from core.services.users import serialize_user_summary


def get_next_dataset_version(case, dataset_type):
    max_version = (
        Dataset.objects.filter(case=case, type=dataset_type)
        .aggregate(max_version=Max("version"))["max_version"]
    )
    return (max_version or 0) + 1


def build_dataset_blob_name(case_id, dataset_id, file_name):
    return f"cases/{case_id}/datasets/{dataset_id}/{safe_blob_file_name(file_name)}"


def build_dataset_upload_response(dataset, content_type):
    ensure_azure_storage_configured()
    content_type = content_type or "application/octet-stream"
    upload_url, expires_at = generate_blob_sas_url(
        dataset.blob_name,
        BlobSasPermissions(create=True, write=True),
        settings.AZURE_UPLOAD_SAS_TTL_SECONDS,
        content_type=content_type,
    )
    return {
        "dataset": serialize_dataset(dataset),
        "upload_url": upload_url,
        "blob_name": dataset.blob_name,
        "expires_at": expires_at.isoformat(),
        "headers": {
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": content_type,
        },
    }


def serialize_dataset(dataset):
    return {
        "id": str(dataset.id),
        "case_id": str(dataset.case_id),
        "type": dataset.type,
        "version": dataset.version,
        "file_name": dataset.file_name,
        "file_size": str(dataset.file_size) if dataset.file_size is not None else None,
        "blob_name": dataset.blob_name,
        "description": dataset.description,
        "status": dataset.status,
        "is_deleted": dataset.is_deleted,
        "is_selected": dataset.is_selected,
        "tags": dataset.tags,
        "created_by": serialize_user_summary(dataset.created_by) if dataset.created_by else None,
        "created_at": dataset.created_at.isoformat(),
        "updated_at": dataset.updated_at.isoformat(),
    }

