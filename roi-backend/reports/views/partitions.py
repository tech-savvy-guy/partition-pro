import json
from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from utilities.custom_logger import get_file_logger
from ..models import Partitions, Case, UserAssignment

logger = get_file_logger()
LOCK_TTL_SECONDS = 120
def is_tech_admin(user):
    return user.role and user.role.role_name == "TECH_ADMIN"

def is_bba_admin(user):
    return user.role and user.role.role_name == "BBA_ADMIN"

def is_user(user):
    return user.role and user.role.role_name == "USER"

def is_restricted_user(user):
    return user.role and user.role.role_name == "RESTRICTED_USER"

def _display_name(user):
    if hasattr(user, "get_full_name") and user.get_full_name():
        return user.get_full_name()
    if getattr(user, "email", None):
        return user.email
    if getattr(user, "username", None):
        return user.username
    return str(user.id)

class PartitionDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    # ---------- helpers ----------
    def _has_case_access(self, user, case):
        if is_tech_admin(user) or is_bba_admin(user):
            return True
        return UserAssignment.objects.filter(case=case, user=user, is_deleted=False).exists()

    def _expire_stale_lock(self, partition):
        """
        If lock has expired, clear it. Returns True if changed.
        """
        now = timezone.now()
        if partition.lock_expires_at and partition.lock_expires_at <= now:
            partition.locked_by = None
            partition.locked_by_name = ""
            partition.lock_expires_at = None
            return True
        return False

    def _ensure_can_edit_partition(self, user, partition):
        """
        Enforce lock for edit operations (PATCH/DELETE or other write actions).
        - Expire stale lock first
        - If someone else holds active lock, deny
        - If no lock, deny (forces caller to acquire lock first)
        """
        now = timezone.now()

        changed = self._expire_stale_lock(partition)
        if changed:
            partition.save(update_fields=["locked_by", "locked_by_name", "lock_expires_at"])

        # No lock -> must acquire first
        if not partition.locked_by_id or not partition.lock_expires_at or partition.lock_expires_at <= now:
            return False, "Partition is not locked for editing. Acquire lock first."

        # Locked by someone else
        if partition.locked_by_id != user.id:
            return False, f"Partition is locked by {partition.locked_by_name}"

        return True, None

    def get(self, request, case_id, partition_id=None):
        user = request.user
        partition_id_filter = partition_id
        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case,
                user=user,
                is_deleted=False,
            ).exists()
            if not is_assigned:
                return Response(
                    {"error": "Not allowed to view partitions for this case"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        qs = Partitions.objects.filter(
            case=case,
            is_deleted=False,
        ).select_related("base_partition")

        if partition_id_filter:
            qs = qs.filter(id=partition_id_filter)

        if is_tech_admin(user) or is_bba_admin(user):
            partitions = qs.order_by("-created_on")
        else:
            partitions = qs.filter(Q(created_by=user.email) | Q(is_shared=True)).order_by("-created_on")

        response_data = []
        try:
            for p in partitions:
                if p.lock_expires_at and p.lock_expires_at <= timezone.now():
                    p.locked_by = None
                    p.locked_by_name = ""
                    p.lock_expires_at = None
                    p.save(update_fields=["locked_by", "locked_by_name", "lock_expires_at"])

                response_data.append({
                    "id": str(p.id),
                    "partition_name": p.partition_name,
                    "description": p.description,
                    "status": p.status,
                    "is_shared": p.is_shared,
                    "step_status": p.step_status,
                    "end_date": p.end_date.isoformat() if p.end_date else None,
                    "tags": p.tags,

                    "created_on": p.created_on.isoformat() if p.created_on else None,
                    "updated_on": p.updated_on.isoformat() if p.updated_on else None,
                    "created_by": p.created_by,
                    "updated_by": p.updated_by,

                    # lock fields for UI
                    "locked_by_name": p.locked_by_name if (
                                p.lock_expires_at and p.lock_expires_at > timezone.now()) else "",
                    "lock_expires_at": p.lock_expires_at.isoformat() if (
                                p.lock_expires_at and p.lock_expires_at > timezone.now()) else None,
                    "lock_active": bool(p.locked_by_id and p.lock_expires_at and p.lock_expires_at > timezone.now()),

                    "base_partition": {
                        "id": str(p.base_partition.id),
                        "partition_name": p.base_partition.partition_name,
                    } if p.base_partition else None,
                })

            return Response(
                {
                    "case_id": str(case.id),
                    "case_name": case.case_name,
                    "partitions": response_data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as ex:
            return Response({"error": ex}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, case_id):
        user = request.user
        data = request.data

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case,
                user=user,
                is_deleted=False,
            ).exists()
            if not is_assigned:
                return Response(
                    {"error": "Not allowed to create partitions for this case"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        required = ["partition_name", "description", "status", "step_status"]
        missing = [f for f in required if f not in data]
        if missing:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        res_ponse={}
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM core.create_new_partition(
                        %s, %s,%s, %s, %s, %s, %s
                    )
                    """,
                    [
                        str(case_id),
                        data["partition_name"],
                        data["description"],
                        data["status"],
                        data["step_status"],
                        user.email,
                        str(data["base_partition_id"]) if data["base_partition_id"] else None,

                    ],
                )
                row = cursor.fetchone()

            res_ponse= {
                "case_id": case_id,
                "partition_id": row[0],
                "pos_dataset_id": row[1],
                "attributes_dataset_id": row[2],
                "crosspurchase_dataset_id": row[3],
                "workflow_id": row[4],
            }
        except Exception as ex:
            return Response({"error": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


        return Response(
            {
                "success": True,
                "message": "Partition created",
                "partition": res_ponse
            },
            status=status.HTTP_201_CREATED,
        )

    def put(self, request, case_id, partition_id):
        """
        PUT /cases/<case_id>/partitions/<partition_id>/lock
        Acquire lock (or re-acquire if same user).
        """
        user = request.user
        now = timezone.now()

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        if not self._has_case_access(user, case):
            return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with transaction.atomic():
                partition = Partitions.objects.select_for_update().get(
                    id=partition_id, case=case, is_deleted=False
                )

                # clear expired lock
                if self._expire_stale_lock(partition):
                    partition.save(update_fields=["locked_by", "locked_by_name", "lock_expires_at"])

                # deny if active lock held by someone else
                if (
                        partition.locked_by_id
                        and partition.locked_by_id != user.id
                        and partition.lock_expires_at
                        and partition.lock_expires_at > now
                ):
                    return Response(
                        {
                            "acquired": False,
                            "locked_by_name": partition.locked_by_name,
                            "lock_expires_at": partition.lock_expires_at.isoformat() if partition.lock_expires_at else None,
                        },
                        status=status.HTTP_200_OK,
                    )

                # acquire lock
                partition.locked_by = user
                partition.locked_by_name = _display_name(user)
                partition.lock_expires_at = now + timedelta(seconds=LOCK_TTL_SECONDS)
                partition.updated_by = user.email
                partition.updated_on = now
                partition.save(
                    update_fields=["locked_by", "locked_by_name", "lock_expires_at", "updated_by", "updated_on"]
                )

            return Response(
                {
                    "acquired": True,
                    "locked_by_name": partition.locked_by_name,
                    "lock_expires_at": partition.lock_expires_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )
        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as ex:
            logger.exception("Partition lock acquire error")
            return Response({"error": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, case_id, partition_id):
        """
        PATCH /cases/<case_id>/partitions/<partition_id>
        Body can be:
          (A) {"is_shared": true}          -> existing behavior (now lock-enforced)
          (B) {"_refresh_lock": true}      -> refresh lock heartbeat

        NOTE: If you prefer separate endpoint for refresh, split this into another view.
        """
        user = request.user
        now = timezone.now()

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                partition = Partitions.objects.select_for_update().get(
                    id=partition_id, case=case, is_deleted=False
                )

                # optional: lock refresh mode
                if request.data.get("_refresh_lock") is True:
                    # expire stale lock
                    # if self._expire_stale_lock(partition):
                    #     partition.save(update_fields=["locked_by", "locked_by_name", "lock_expires_at"])
                    #     return Response({"refreshed": False, "error": "No active lock"},
                    #                     status=status.HTTP_409_CONFLICT)

                    if partition.locked_by_id != user.id:
                        return Response(
                            {"refreshed": False, "error": f"Locked by {partition.locked_by_name}"},
                            status=status.HTTP_409_CONFLICT,
                        )

                    partition.lock_expires_at = now + timedelta(seconds=LOCK_TTL_SECONDS)
                    partition.updated_by = user.email
                    partition.updated_on = now
                    partition.save(update_fields=["lock_expires_at", "updated_by", "updated_on"])

                    return Response(
                        {"refreshed": True, "lock_expires_at": partition.lock_expires_at.isoformat()},
                        status=status.HTTP_200_OK,
                    )

                # ---- existing share/unshare logic (now lock enforced) ----

                # Permission check (your original pattern)
                if not (is_tech_admin(user) or is_bba_admin(user)):
                    is_assigned = UserAssignment.objects.filter(case=case, user=user, is_deleted=False).exists()
                    if not is_assigned:
                        return Response(
                            {"error": "Not allowed to share partitions for this case"},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    if partition.created_by != user.email:
                        return Response(
                            {"error": "Not allowed to share this partition"},
                            status=status.HTTP_403_FORBIDDEN,
                        )

                # Enforce lock for editing
                # ok, err = self._ensure_can_edit_partition(user, partition)
                # if not ok:
                #     return Response({"error": err}, status=status.HTTP_409_CONFLICT)

                want_shared = request.data.get("is_shared", None)
                if want_shared is None or not isinstance(want_shared, bool):
                    return Response(
                        {"error": "is_shared must be boolean (true/false)"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if partition.is_shared != want_shared:
                    partition.is_shared = want_shared
                    partition.updated_by = user.email
                    partition.updated_on = now
                    partition.save(update_fields=["is_shared", "updated_by", "updated_on"])

                return Response(
                    {
                        "success": True,
                        "message": "Partition shared" if want_shared else "Partition unshared",
                        "partition_id": str(partition.id),
                        "is_shared": partition.is_shared,
                    },
                    status=status.HTTP_200_OK,
                )

        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as ex:
            logger.exception("PartitionDetailsView PATCH error")
            return Response({"error": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, case_id, partition_id):
        """
        DELETE /cases/<case_id>/partitions/<partition_id>
        Now lock-enforced (must hold active lock).
        """
        user = request.user
        now = timezone.now()

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                partition = Partitions.objects.select_for_update().get(
                    id=partition_id, case=case, is_deleted=False
                )

                # Permission check (your original pattern)
                if not (is_tech_admin(user) or is_bba_admin(user)):
                    is_assigned = UserAssignment.objects.filter(case=case, user=user, is_deleted=False).exists()
                    if not is_assigned:
                        return Response(
                            {"error": "Not allowed to delete partitions for this case"},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    if partition.created_by != user.email:
                        return Response(
                            {"error": "Not allowed to delete this partition"},
                            status=status.HTTP_403_FORBIDDEN,
                        )

                # Enforce lock for editing
                # ok, err = self._ensure_can_edit_partition(user, partition)
                # if not ok:
                #     return Response({"error": err}, status=status.HTTP_409_CONFLICT)

                partition.is_deleted = True
                partition.updated_by = user.email
                partition.updated_on = now
                partition.save(update_fields=["is_deleted", "updated_by", "updated_on"])

            return Response({"success": True, "message": "Partition deleted"}, status=status.HTTP_200_OK)

        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as ex:
            logger.exception("PartitionDetailsView DELETE error")
            return Response({"error": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PartitionUnlockView(APIView):
    """
    Separate unlock endpoint (cleaner than overloading DELETE on the partition resource).

    POST /cases/<case_id>/partitions/<partition_id>/unlock
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        user = request.user
        now = timezone.now()

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                partition = Partitions.objects.select_for_update().get(
                    id=partition_id, case=case, is_deleted=False
                )

                # expire stale lock first
                if partition.lock_expires_at and partition.lock_expires_at <= now:
                    partition.locked_by = None
                    partition.locked_by_name = ""
                    partition.lock_expires_at = None

                if partition.locked_by_id != user.id:
                    return Response(
                        {
                            "unlocked": False,
                            "error": f"Locked by {partition.locked_by_name}" if partition.locked_by_id else "Not locked",
                            "locked_by_name": partition.locked_by_name,
                            "lock_expires_at": partition.lock_expires_at.isoformat() if partition.lock_expires_at else None,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                partition.locked_by = None
                partition.locked_by_name = ""
                partition.lock_expires_at = None
                partition.updated_by = user.email
                partition.updated_on = now
                partition.save(
                    update_fields=["locked_by", "locked_by_name", "lock_expires_at", "updated_by", "updated_on"])

            return Response({"unlocked": True}, status=status.HTTP_200_OK)

        except Partitions.DoesNotExist:
            return Response({"error": "Partition not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as ex:
            logger.exception("Partition unlock error")
            return Response({"error": str(ex)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PartitionCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, case_id, partition_id):
        """
        POST /cases/<case_id>/partitions/<partition_id>/close
        Closes a partition by setting status=CLOSED and end_date=now
        """
        user = request.user

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response(
                {"error": "Case not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            partition = Partitions.objects.get(
                id=partition_id,
                case=case,
                is_deleted=False,
            )
        except Partitions.DoesNotExist:
            return Response(
                {"error": "Partition not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not (is_tech_admin(user) or is_bba_admin(user)):
            is_assigned = UserAssignment.objects.filter(
                case=case,
                user=user,
                is_deleted=False,
            ).exists()

            if not is_assigned:
                return Response(
                    {"error": "Not allowed to close partitions for this case"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if partition.created_by != user.email:
                return Response(
                    {"error": "Not allowed to close this partition"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if partition.status != "CLOSED":
            partition.status = "CLOSED"
            partition.end_date = timezone.now()
            partition.updated_by = user.email
            partition.updated_on = timezone.now()
            partition.save(
                update_fields=[
                    "status",
                    "end_date",
                    "updated_by",
                    "updated_on",
                ]
            )

        return Response(
            {
                "success": True,
                "message": "Partition closed",
                "partition_id": str(partition.id),
                "status": partition.status,
                "end_date": (
                    partition.end_date.isoformat()
                    if partition.end_date
                    else None
                ),
            },
            status=status.HTTP_200_OK,
        )
