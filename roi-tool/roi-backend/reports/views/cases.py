from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from utilities.custom_logger import get_file_logger
from ..models import Case, UserAssignment
from Security_api.models import User

logger = get_file_logger()

def is_tech_admin(user):
    return user.role and user.role.role_name == "TECH_ADMIN"

def is_bba_admin(user):
    return user.role and user.role.role_name == "BBA_ADMIN"

def is_user(user):
    return user.role and user.role.role_name == "USER"

class CaseDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        status_filter = request.GET.get("status")
        case_id_filter = request.GET.get("case_id")
        is_archived_filter = str(request.GET.get("is_archived")).lower()=="true"

        qs = Case.objects.filter(is_deleted=False)

        if is_tech_admin(user) or is_bba_admin(user):
            pass
        else:
            qs = qs.filter(assignments__user=user, assignments__is_deleted=False)

        if status_filter:
            qs = qs.filter(status=status_filter)

        if case_id_filter:
            qs = qs.filter(id=case_id_filter)

        if request.GET.get("is_archived"):
            qs = qs.filter(is_archived=is_archived_filter)

        qs = qs.distinct().order_by("-created_on")

        data = []
        for c in qs:
            assignment = None
            if not (is_tech_admin(user) or is_bba_admin(user)):
                assignment = UserAssignment.objects.filter(
                    case=c, user=user, is_deleted=False
                ).first()

            data.append({
                "id": str(c.id),
                "case_name": c.case_name,
                "case_code": c.case_code,
                "description": c.description,
                "methodology":c.methodology,
                "case_manager":c.case_manager,
                "nps_contact":c.nps_contact,
                "product_type":c.product_type,
                "category":c.category,
                "end_date":c.end_date,
                "status": c.status,
                "tenant_id": str(c.tenant_id),
                "created_on": c.created_on.isoformat(),
                "created_by": c.created_by,
                "requested_by":c.requested_by,
                "user_case_role": assignment.role if assignment else None,
                "is_archived": c.is_archived,
                "tags":c.tags,
                "is_preprocessed": c.is_preprocessed,
                "final_answer": c.final_answer,
            })

        return Response({"results": data}, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        data = request.data

        required = ["case_name", "methodology", "case_code",
                    "requested_by", "case_manager", "nps_contact",
                    "category", "description"]
        missing = [f for f in required if f not in data]
        if missing:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tenant_id = user.tenant_id
        try:
            case = Case.objects.create(
                created_by=user.email,
                created_on=timezone.now(),
                updated_by=user.email,
                updated_on=timezone.now(),
                is_deleted=False,
                case_name=data["case_name"],
                methodology=data["methodology"],
                case_code=data["case_code"],
                requested_by=data["requested_by"],
                case_manager=data["case_manager"],
                nps_contact=data["nps_contact"],
                status=data.get("status") or "DRAFT",
                product_type=data.get("product_type"),
                category=data["category"],
                tags=data.get("tags") or {},
                end_date=data.get("end_date"),
                is_archived=False,
                is_preprocessed=False,
                description=data["description"],
                tenant_id=tenant_id,
            )
        except Exception as e:
            logger.exception("Case create failed")
            return Response(
                {"error": "Case create failed", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        UserAssignment.objects.create(
            created_on=timezone.now(),
            created_by=user.email,
            updated_on=timezone.now(),
            updated_by=user.email,
            is_deleted=False,
            case=case,
            user=user,
            role="PUBLISHER",
            tags={},
        )

        return Response(
            {
                "success": True,
                "id": str(case.id),
                "case_name": case.case_name,
            },
            status=status.HTTP_201_CREATED,
        )

    def put(self, request, case_id):
        user = request.user
        data = request.data

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            assignment = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).first()
            if not assignment or assignment.role not in ["PUBLISHER", "EDITOR"]:
                return Response({"error": "Not allowed to edit this case"}, status=403)

        # Update allowed fields
        for field in [
            "case_name", "methodology", "case_code", "requested_by",
            "case_manager", "nps_contact", "status", "product_type",
            "category", "description", "end_date", "tags", "final_answer"
        ]:
            if field in data:
                setattr(case, field, data[field])

        if case.status == "CLOSED":
            case.end_date = timezone.now()
            
        case.updated_by = user.email
        case.updated_on = timezone.now()
        case.save()

        return Response({"success": True, "message": "Case updated"}, status=200)

    def delete(self, request, case_id):
        user = request.user

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        # Permission: allow TECH/BBA admins OR case PUBLISHER (same pattern as update)
        if not (is_tech_admin(user) or is_bba_admin(user)):
            assignment = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).first()

            if not assignment or assignment.role != "PUBLISHER":
                return Response({"error": "Not allowed to delete this case"}, status=status.HTTP_403_FORBIDDEN)

        # archive instead of hard delete
        case.is_archived = True
        case.updated_by = user.email
        case.updated_on = timezone.now()
        case.save(update_fields=["is_archived", "updated_by", "updated_on"])

        # Return 204 so frontend CaseApi.delete<void> stays valid
        return Response(status=status.HTTP_204_NO_CONTENT)

class CaseAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_current_publisher(self, case):
        return UserAssignment.objects.filter(
            case=case, role="PUBLISHER", is_deleted=False
        ).select_related("user").first()

    def get(self, request,case_id):
        user = request.user

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            if not UserAssignment.objects.filter(case=case, user=user, is_deleted=False).exists():
                return Response({"error": "Not allowed to view assignments"}, status=403)

        assignments = UserAssignment.objects.filter(case=case, is_deleted=False).select_related("user")

        results = []
        for a in assignments:
            results.append({
                "assignment_id": str(a.id),
                "user_id": str(a.user.id),
                "name": a.user.name,
                "email": a.user.email,
                "role": a.role,
                "created_on": a.created_on.isoformat(),
                "created_by": a.created_by,
                "tags": a.tags,
            })

        return Response({
            "case_id": str(case.id),
            "case_name": case.case_name,
            "assignments": results
        }, status=200)

    def post(self, request, case_id):
        user = request.user
        data = request.data

        role = data.get("role")
        target_user_id = data.get("user_id")

        if role not in ["PUBLISHER", "EDITOR", "VIEWER"]:
            return Response({"error": "Invalid role"}, status=400)

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)


        if not (is_tech_admin(user) or is_bba_admin(user)):
            current_assignment = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).first()
            if not current_assignment or current_assignment.role != "PUBLISHER":
                return Response({"error": "Not allowed to assign users"}, status=403)

        try:
            target_user = User.objects.get(id=target_user_id, is_deleted=False)
        except User.DoesNotExist:
            return Response({"error": "Target user not found"}, status=404)

        with transaction.atomic():
            # Enforce single publisher via transfer
            if role == "PUBLISHER":
                current_pub = self._get_current_publisher(case)
                if current_pub and current_pub.user_id != target_user.id:
                    current_pub.role = "EDITOR"  # choose VIEWER if you prefer
                    current_pub.updated_on = timezone.now()
                    current_pub.updated_by = user.email
                    current_pub.save(update_fields=["role", "updated_on", "updated_by"])

            ua, created = UserAssignment.objects.update_or_create(
                case=case,
                user=target_user,
                defaults={
                    "role": role,
                    "updated_on": timezone.now(),
                    "updated_by": user.email,
                    "is_deleted": False,
                },
            )

            if created:
                ua.created_on = timezone.now()
                ua.created_by = user.email
                ua.save(update_fields=["created_on", "created_by"])

        return Response(
            {
                "success": True,
                "message": "Assignment created" if created else "Assignment updated",
                "user_id": str(target_user.id),
                "case_id": str(case.id),
                "role": role,
            },
            status=200,
        )

    def delete(self, request, case_id):
        user = request.user
        target_user_id = request.data.get("user_id")

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=404)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            current_assignment = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).first()
            if not current_assignment or current_assignment.role != "PUBLISHER":
                return Response({"error": "Not allowed to remove users"}, status=403)

        try:
            ua = UserAssignment.objects.get(
                case=case, user_id=target_user_id, is_deleted=False
            )
        except UserAssignment.DoesNotExist:
            return Response({"error": "Assignment not found"}, status=404)

        # Prevent deleting the last remaining publisher (non-admin)
        if not (is_tech_admin(user) or is_bba_admin(user)) and ua.role == "PUBLISHER":
            other_pub_exists = UserAssignment.objects.filter(
                case=case, role="PUBLISHER", is_deleted=False
            ).exclude(user_id=ua.user_id).exists()
            if not other_pub_exists:
                return Response(
                    {"error": "Cannot remove the last publisher. Transfer publisher to another user first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        ua.is_deleted = True
        ua.updated_on = timezone.now()
        ua.updated_by = user.email
        ua.save(update_fields=["is_deleted", "updated_on", "updated_by"])

        return Response({"success": True, "message": "Assignment removed"}, status=200)

    def put(self, request, case_id):
        user = request.user
        data = request.data

        target_user_id = data.get("user_id")
        new_role = data.get("role")

        if not target_user_id or not new_role:
            return Response(
                {"error": "user_id and role are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_role not in ["PUBLISHER", "EDITOR", "VIEWER"]:
            return Response({"error": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            case = Case.objects.get(id=case_id, is_deleted=False)
        except Case.DoesNotExist:
            return Response({"error": "Case not found"}, status=status.HTTP_404_NOT_FOUND)

        if not (is_tech_admin(user) or is_bba_admin(user)):
            my_assignment = UserAssignment.objects.filter(
                case=case, user=user, is_deleted=False
            ).first()
            if not my_assignment or my_assignment.role != "PUBLISHER":
                return Response(
                    {"error": "Not allowed to change roles for this case"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            ua = UserAssignment.objects.get(
                case=case, user_id=target_user_id, is_deleted=False
            )
        except UserAssignment.DoesNotExist:
            return Response(
                {"error": "Assignment for this user not found on this case"},
                status=status.HTTP_404_NOT_FOUND,
            )

            # Prevent demoting the last remaining publisher (non-admin)
        if (
                    not (is_tech_admin(user) or is_bba_admin(user))
                    and ua.role == "PUBLISHER"
                    and new_role != "PUBLISHER"
        ):
            other_pub_exists = UserAssignment.objects.filter(
                case=case, role="PUBLISHER", is_deleted=False
            ).exclude(user_id=ua.user_id).exists()

            if not other_pub_exists:
                return Response(
                    {"error": "Cannot remove publisher role without transferring it to another user"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            # Enforce single publisher via transfer
            if new_role == "PUBLISHER":
                current_pub = self._get_current_publisher(case)
                if current_pub and current_pub.user_id != ua.user_id:
                    current_pub.role = "EDITOR"  # choose VIEWER if you prefer
                    current_pub.updated_on = timezone.now()
                    current_pub.updated_by = user.email
                    current_pub.save(update_fields=["role", "updated_on", "updated_by"])

            ua.role = new_role
            ua.updated_on = timezone.now()
            ua.updated_by = user.email
            ua.save(update_fields=["role", "updated_on", "updated_by"])

        return Response(
            {
                "success": True,
                "message": "User role updated for this case",
                "case_id": str(case.id),
                "user_id": str(ua.user_id),
                "role": ua.role,
            },
            status=status.HTTP_200_OK,
        )