from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from utilities.custom_logger import get_file_logger
from utilities.encrypt_decrypt import AesCipher
from django.utils import timezone

User = get_user_model()
logger = get_file_logger()
encdec = AesCipher()


def get_tokens_for_user(user):
    """
    Create JWT refresh + access tokens using SimpleJWT.
    """
    try:
        refresh = RefreshToken.for_user(user)

        # You can add custom claims here if you want:
        refresh["email"] = user.email
        refresh["role_id"] = str(user.role_id)
        refresh["tenant_id"] = str(user.tenant_id)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
    except Exception as ex:
        logger.error(f'get_tokens_for_user, Validation error: {ex}')

class LoginUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        # password = request.data.get("password")

        if not email:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"success": False, "error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Check if account is locked / inactive / deleted
        if user.is_deleted:
            return Response(
                {"success": False, "error": "Account is deleted"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            return Response(
                {"success": False, "error": "Account is inactive"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_locked:
            return Response(
                {"success": False, "error": "Account is locked"},
                status=status.HTTP_403_FORBIDDEN,
            )


        # Reset invalid_attempts on success
        if user.invalid_attempts > 0 or user.is_locked:
            user.invalid_attempts = 0
            user.is_locked = False

        user.login_time = timezone.now()
        user.logout_time = None
        user.password_created_on = user.password_created_on or timezone.now()
        user.save(
            update_fields=[
                "invalid_attempts",
                "is_locked",
                "login_time",
                "logout_time",
                "password_created_on",
            ]
        )

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "success": True,
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "name": user.name,
                    "role_id": str(user.role_id),
                    "tenant_id": str(user.tenant_id),
                    "company": user.company,
                },
            },
            status=status.HTTP_200_OK,
        )

class MeView(APIView):
    """
    GET me/
    Authorization: Bearer <access>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "role_id": str(user.role_id),
                "tenant_id": str(user.tenant_id),
                "company": user.company,
            },
            status=status.HTTP_200_OK,
        )