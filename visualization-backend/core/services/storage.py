import re
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

try:
    from azure.core.exceptions import AzureError, ResourceNotFoundError
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobSasPermissions, BlobServiceClient
    from azure.storage.blob import generate_blob_sas
except ImportError:
    class AzureError(Exception):
        pass

    class ResourceNotFoundError(AzureError):
        pass

    DefaultAzureCredential = None
    BlobSasPermissions = None
    BlobServiceClient = None
    generate_blob_sas = None

from core.services.utils import clean_text


def ensure_azure_storage_configured():
    if BlobServiceClient is None or DefaultAzureCredential is None:
        raise ImproperlyConfigured(
            "Azure SDK packages are not installed. Install requirements.txt."
        )
    missing = []
    if not clean_text(settings.AZURE_STORAGE_ACCOUNT_URL):
        missing.append("AZURE_STORAGE_ACCOUNT_URL")
    if not clean_text(settings.AZURE_STORAGE_CONTAINER_NAME):
        missing.append("AZURE_STORAGE_CONTAINER_NAME")
    if missing:
        raise ImproperlyConfigured(
            "Missing Azure storage setting(s): " + ", ".join(missing) + "."
        )


def get_storage_account_name():
    parsed = urlparse(settings.AZURE_STORAGE_ACCOUNT_URL)
    host = parsed.netloc or parsed.path
    account_name = host.split(".")[0]
    if not account_name:
        raise ImproperlyConfigured("AZURE_STORAGE_ACCOUNT_URL is invalid.")
    return account_name


def get_blob_service_client():
    ensure_azure_storage_configured()
    return BlobServiceClient(
        account_url=settings.AZURE_STORAGE_ACCOUNT_URL,
        credential=DefaultAzureCredential(),
    )


def get_blob_client(blob_name):
    ensure_azure_storage_configured()
    return get_blob_service_client().get_blob_client(
        container=settings.AZURE_STORAGE_CONTAINER_NAME,
        blob=blob_name,
    )


def generate_blob_sas_url(blob_name, permission, ttl_seconds, content_type=None):
    ensure_azure_storage_configured()
    now = timezone.now()
    starts_at = now - timedelta(minutes=5)
    expires_at = now + timedelta(seconds=ttl_seconds)
    blob_client = get_blob_client(blob_name)
    user_delegation_key = get_blob_service_client().get_user_delegation_key(
        key_start_time=starts_at,
        key_expiry_time=expires_at,
    )
    sas_token = generate_blob_sas(
        account_name=get_storage_account_name(),
        container_name=settings.AZURE_STORAGE_CONTAINER_NAME,
        blob_name=blob_name,
        user_delegation_key=user_delegation_key,
        permission=permission,
        start=starts_at,
        expiry=expires_at,
        content_type=content_type,
    )
    return f"{blob_client.url}?{sas_token}", expires_at


def safe_blob_file_name(file_name):
    base_name = clean_text(file_name).replace("\\", "/").split("/")[-1]
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", base_name).strip(".-")
    return safe_name or "upload"
