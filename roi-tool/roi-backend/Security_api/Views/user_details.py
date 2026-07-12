from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import Role

User = get_user_model()

class GetUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        users = User.objects.filter(is_deleted=False)
        print("users",users)
        user_list = []
        for user in users:
            user_list.append({
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "role_id": str(user.role_id),
                "tenant_id": str(user.tenant_id),
                "is_active": user.is_active,
                "designation": user.designation,
                "company": user.company,
                # "role": user.role if user.role else "Admin",
            })
        return Response({"results": user_list}, status=200)

class CreateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data

        required_fields = [
            "email", "username", "name",
            "role_id", "tenant_id", "password"
        ]
        missing = [f for f in required_fields if f not in data]
        if missing:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Extract fields
        email = data["email"].strip()
        username = data["username"].strip()
        name = data["name"].strip()
        role_id = data["role_id"]
        tenant_id = data["tenant_id"]
        password = data["password"]


        designation = data.get("designation")
        company = data.get("company")

        # Check for duplicates
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already exists"}, status=409)
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=409)

        # Validate role
        try:
            role = Role.objects.get(id=role_id, is_deleted=False)
        except Role.DoesNotExist:
            return Response({"error": "Invalid role_id"}, status=400)

        user = User(
            email=email,
            username=username,
            name=name,
            role=role,
            tenant_id=tenant_id,
            designation=designation,
            company=company,
            created_by=request.user.email,
            created_on=timezone.now(),
            is_active=True,
            invalid_attempts=0,
            is_locked=False,
            is_deleted=False,
        )

        # Hash password
        user.password = make_password(password)
        user.save()

        return Response(
            {
                "success": True,
                "message": "User created successfully",
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "name": user.name,
                    "role_id": str(user.role_id),
                    "tenant_id": str(user.tenant_id),
                },
            },
            status=201,
        )
class UpdateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, user_id):
        data = request.data

        try:
            user = User.objects.get(id=user_id, is_deleted=False)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        # Update optional fields
        if "email" in data:
            user.email = data["email"]
        if "username" in data:
            user.username = data["username"]
        if "name" in data:
            user.name = data["name"]
        if "designation" in data:
            user.designation = data["designation"]
        if "company" in data:
            user.company = data["company"]

        # Update role if provided
        if "role_id" in data:
            try:
                role = Role.objects.get(id=data["role_id"], is_deleted=False)
                user.role = role
            except Role.DoesNotExist:
                return Response({"error": "Invalid role_id"}, status=400)

        # Update password (optional)
        if "password" in data:
            user.password = make_password(data["password"])
            user.password_created_on = timezone.now()

        user.updated_by = request.user.email
        user.updated_on = timezone.now()

        user.save()

        return Response(
            {"success": True, "message": "User updated"},
            status=200,
        )
class DeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, is_deleted=False)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        user.is_deleted = True
        user.is_active = False
        user.is_locked = True
        user.logout_time = timezone.now()
        user.updated_by = request.user.email
        user.updated_on = timezone.now()

        user.save()

        return Response({"success": True, "message": "User deleted"}, status=200)
