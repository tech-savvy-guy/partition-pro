from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from ..models import Role

class GetRolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.filter(is_deleted=False)
        roles_data = []

        for role in roles:
            roles_data.append(
                {
                    "id": str(role.id),
                    "role_name": role.role_name,
                    "permissions": role.permissions,
                    "is_super_user": role.is_super_user,
                    "is_super_admin": role.is_super_admin,
                }
            )

        return Response({"roles": roles_data}, status=200)

class CreateRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data

        required = ["role_name","permissions"]
        missing = [f for f in required if f not in data]

        if missing:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role_name = data["role_name"].strip()

        permissions = data.get("permissions", {})
        is_super_user = data.get("is_super_user", False)
        is_super_admin = data.get("is_super_admin", False)
        tags = data.get("tags", {})

        # Check if the role already exists
        if Role.objects.filter(role_name__iexact=role_name, is_deleted=False).exists():
            return Response({"error": "Role already exists"}, status=409)

        role = Role(
            role_name=role_name,
            created_by=request.user.email,
            created_on=timezone.now(),
            permissions=permissions,
            is_super_user=is_super_user,
            is_super_admin=is_super_admin,
            tags=tags,
            is_deleted=False,
        )

        role.save()

        return Response(
            {
                "success": True,
                "message": "Role created successfully",
                "role": {
                    "id": str(role.id),
                    "role_name": role.role_name,
                    "permissions": role.permissions,
                    "is_super_user": role.is_super_user,
                    "is_super_admin": role.is_super_admin,
                },
            },
            status=201,
        )
class UpdateRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, role_id):
        data = request.data

        try:
            role = Role.objects.get(id=role_id, is_deleted=False)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=404)

        if "role_name" in data:
            role.role_name = data["role_name"]

        if "permissions" in data:
            role.permissions = data["permissions"]

        if "is_super_user" in data:
            role.is_super_user = data["is_super_user"]

        if "is_super_admin" in data:
            role.is_super_admin = data["is_super_admin"]

        if "tags" in data:
            role.tags = data["tags"]

        role.updated_by = request.user.email
        role.updated_on = timezone.now()

        role.save()

        return Response({"success": True, "message": "Role updated"}, status=200)

class DeleteRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, role_id):
        try:
            role = Role.objects.get(id=role_id, is_deleted=False)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=404)

        role.is_deleted = True
        role.updated_by = request.user.email
        role.updated_on = timezone.now()
        role.save()

        return Response(
            {"success": True, "message": "Role deleted successfully"},
            status=200,
        )
