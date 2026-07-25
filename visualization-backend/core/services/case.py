import logging

from django.db import transaction

from core.models import (
    Case,
    CaseUserAssignment,
    Dataset,
    Metadata,
    RawAttributesData,
    RawCrossPurchaseData,
    RawPosData,
)
from core.services.storage import delete_blob
from core.services.users import serialize_user_summary
from core.services.utils import clean_text
from security.rbac import Permission, user_has_permission

logger = logging.getLogger(__name__)


def get_active_case(case_id):
    try:
        return Case.objects.select_related("created_by", "updated_by").prefetch_related("user_assignments__user").get(id=case_id, is_deleted=False)
    except (Case.DoesNotExist, ValueError):
        return None


def get_active_dataset(case_id, dataset_id):
    try:
        return Dataset.objects.select_related("case", "created_by").get(
            id=dataset_id,
            case_id=case_id,
            case__is_deleted=False,
            is_deleted=False,
        )
    except (Dataset.DoesNotExist, ValueError):
        return None


def purge_case(case: Case) -> None:
    """Permanently delete a case and all related app data + Azure dataset blobs.

    UUID-keyed tables (Metadata, raw dataset rows) have no FK cascade and are
    deleted explicitly. Assignments, datasets, partitions, and workflows cascade
    from ``case.delete()``. Azure blobs are removed best-effort after the DB
    commit so the case disappears from the app even if storage cleanup fails.
    """
    case_id = case.id
    blob_names = list(
        Dataset.objects.filter(case_id=case_id)
        .exclude(blob_name="")
        .values_list("blob_name", flat=True)
    )

    with transaction.atomic():
        Metadata.objects.filter(case_id=case_id).delete()
        RawPosData.objects.filter(case_id=case_id).delete()
        RawAttributesData.objects.filter(case_id=case_id).delete()
        RawCrossPurchaseData.objects.filter(case_id=case_id).delete()
        case.delete()

    for blob_name in blob_names:
        try:
            delete_blob(blob_name)
        except Exception:
            logger.exception(
                "Failed to delete Azure blob %s after purging case %s",
                blob_name,
                case_id,
            )


def can_create_partition(user, case):
    if user_has_permission(user, Permission.CREATE_PARTITIONS.value):
        return True
    if getattr(case, "created_by_id", None) == getattr(user, "id", None):
        return True
    return CaseUserAssignment.objects.filter(
        case=case,
        user=user,
        is_deleted=False,
        role__in=[
            CaseUserAssignment.Role.PUBLISHER,
            CaseUserAssignment.Role.EDITOR,
        ],
    ).exists()


def can_edit_workflow(user, case):
    return can_create_partition(user, case)


def can_manage_case_locks(user, case):
    """Stricter than ``can_create_partition``: excludes case-level EDITOR —
    only the case-level PUBLISHER (or a global admin/owner) may force-release
    other users' partition locks."""
    if user_has_permission(user, Permission.CREATE_PARTITIONS.value):
        return True
    if getattr(case, "created_by_id", None) == getattr(user, "id", None):
        return True
    return CaseUserAssignment.objects.filter(
        case=case,
        user=user,
        is_deleted=False,
        role=CaseUserAssignment.Role.PUBLISHER,
    ).exists()


def create_case_assignments(case, assignments):
    assigned_user_ids = set()
    for assignment in assignments:
        user_id = clean_text(assignment.get("user_id"))
        role = clean_text(assignment.get("role")) or CaseUserAssignment.Role.VIEWER
        CaseUserAssignment.objects.create(case=case, user_id=user_id, role=role)
        assigned_user_ids.add(user_id)

    if case.created_by_id and str(case.created_by_id) not in assigned_user_ids:
        CaseUserAssignment.objects.create(
            case=case,
            user=case.created_by,
            role=CaseUserAssignment.Role.PUBLISHER,
        )


def get_case_assignment_role(case, user):
    if not user:
        return None
    assignment = CaseUserAssignment.objects.filter(
        case=case,
        user=user,
        is_deleted=False,
    ).first()
    return assignment.role if assignment else None


def serialize_case(case, user=None):
    assignments = [
        {
            "user": serialize_user_summary(assignment.user),
            "role": assignment.role,
        }
        for assignment in case.user_assignments.all()
        if not assignment.is_deleted
    ]

    creator_id_str = str(case.created_by_id) if case.created_by_id else None
    has_creator = any(
        str(a["user"]["id"]) == creator_id_str
        for a in assignments
    ) if creator_id_str else True

    if case.created_by and not has_creator:
        assignments.insert(0, {
            "user": serialize_user_summary(case.created_by),
            "role": CaseUserAssignment.Role.PUBLISHER,
        })

    return {
        "id": str(case.id),
        "name": case.name,
        "code": case.code,
        "description": case.description,
        "methodology": case.methodology,
        "status": case.status,
        "category": case.category,
        "tags": case.tags,
        "is_archived": case.is_archived,
        "is_deleted": case.is_deleted,
        "created_by": serialize_user_summary(case.created_by) if case.created_by else None,
        "updated_by": serialize_user_summary(case.updated_by) if case.updated_by else None,
        "created_at": case.created_at.isoformat(),
        "updated_at": case.updated_at.isoformat(),
        "user_case_role": get_case_assignment_role(case, user),
        "can_create_partitions": can_create_partition(user, case) if user else False,
        "can_manage_case_locks": can_manage_case_locks(user, case) if user else False,
        "assignments": assignments,
    }

