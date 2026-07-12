from django.conf import settings
from azure.identity import ClientSecretCredential
from azure.keyvault.secrets import SecretClient
from typing import List, Dict, Any
from django.db.models import Q
from django.db.models.query import QuerySet
from typing import Any, Dict, Optional, Sequence, Tuple
from django.core.paginator import Paginator
from django.db.models import QuerySet

def get_from_azure_key_vault(secret_name):
    credentials = ClientSecretCredential(client_id=settings.VAULT_CLIENT_ID,
                                         client_secret=settings.VAULT_CLIENT_SECRET,
                                         tenant_id=settings.VAULT_TENANT_ID, connection_verify=False)
    secret_client = SecretClient(vault_url=settings.AZURE_KEYVAULT_URL, credential= credentials)
    secret_value = secret_client.get_secret(secret_name).value
    return str(secret_value)

# Offset pagination + filters
# GET /cases/{case_id}/partitions/{partition_id}/workflow/step1/sku-selection/?
#     pagination=offset&
#     page=1&
#     per_page=100&
#     filters=[{"column":"brand","op":"in","value":["Brand A","Brand B"]},
#              {"column":"quantity","op":"gte","value":10}]
#
# Cursor pagination + filters
# GET /cases/{case_id}/partitions/{partition_id}/workflow/step1/sku-selection/?
#     pagination=cursor&
#     per_page=100&
#     cursor=<last_id_from_previous_response>&
#     filters=[{"column":"brand","op":"eq","value":"Brand A"}]

def apply_dynamic_json_filters(qs: QuerySet, filters: List[Dict[str, Any]]) -> QuerySet:
    """
    Apply a list of dynamic filters on a JSONField named 'data'.
    """
    if not filters:
        return qs

    q_obj = Q()

    for f in filters:
        col = f.get("column")
        op = f.get("op", "eq")
        value = f.get("value")

        if not col:
            continue

        field = f"data__{col}"

        if op == "eq":
            q_obj &= Q(**{field: value})

        elif op == "neq":
            q_obj &= ~Q(**{field: value})

        elif op == "in":
            q_obj &= Q(**{f"{field}__in": value})

        elif op == "nin":
            q_obj &= ~Q(**{f"{field}__in": value})

        elif op == "icontains":
            q_obj &= Q(**{f"{field}__icontains": value})

        elif op == "contains":
            # JSON "contains" (for arrays / nested json)
            q_obj &= Q(**{f"{field}__contains": value})

        elif op == "gte":
            q_obj &= Q(**{f"{field}__gte": value})

        elif op == "lte":
            q_obj &= Q(**{f"{field}__lte": value})

        elif op == "gt":
            q_obj &= Q(**{f"{field}__gt": value})

        elif op == "lt":
            q_obj &= Q(**{f"{field}__lt": value})

        else:
            continue

    return qs.filter(q_obj)


def offset_paginate(
    qs: QuerySet,
    page: int,
    per_page: int,
) -> Tuple[Sequence[Any], Dict[str, Any]]:
    """
    Standard OFFSET pagination.
    Returns (items, pagination_meta).
    """
    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(page)

    items = list(page_obj.object_list)
    meta = {
        "mode": "offset",
        "page": page_obj.number,
        "per_page": per_page,
        "total_pages": paginator.num_pages,
        "total_rows": paginator.count,
        "next_cursor": None,  # for uniform schema
    }
    return items, meta


def cursor_paginate(
    qs: QuerySet,
    per_page: int,
    cursor: Optional[str],
    cursor_field: str = "id",
) -> Tuple[Sequence[Any], Dict[str, Any]]:
    """
    Keyset (cursor) pagination, using a single field (default 'id') for ordering.
    """
    order_by_field = cursor_field

    if cursor:
        qs = qs.filter(**{f"{cursor_field}__gt": cursor})

    qs = qs.order_by(order_by_field)

    items = list(qs[: per_page + 1])

    has_next = len(items) > per_page
    if has_next:
        items = items[:per_page]

    next_cursor = None
    if has_next and items:
        last_item = items[-1]
        next_cursor = getattr(last_item, cursor_field)

    meta = {
        "mode": "cursor",
        "page": None,
        "per_page": per_page,
        "total_pages": None,
        "total_rows": None,
        "next_cursor": str(next_cursor) if next_cursor else None,
    }
    return items, meta



