from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from rest_framework_simplejwt.tokens import RefreshToken
from utilities.custom_logger import get_file_logger
from rest_framework.permissions import IsAuthenticated, AllowAny


logger=get_file_logger()

class LogoutUserApiView(APIView):
    """
        POST logout/
        Body: { "refresh": "<refresh_token>" }
        Blacklists a single refresh token (user logs out from current device/session).
        """
    permission_classes = [IsAuthenticated]
    def options(self,  *args, **kwargs):
        response = HttpResponse()
        response['allow'] = ','.join([self.allowed_methods])
        return Response('',  status=status.HTTP_200_OK,headers='{"Content-Type": "text/plain"}')

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional: update logout_time for current user
        user = request.user
        user.logout_time = timezone.now()
        user.save(update_fields=["logout_time"])

        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)

class LogoutAllView(APIView):
    """
    POST logout-all/
    Blacklists all refresh tokens for the current user (logout from all devices).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Blacklist all outstanding tokens for this user
        tokens = OutstandingToken.objects.filter(user=user)
        for t in tokens:
            BlacklistedToken.objects.get_or_create(token=t)

        user.logout_time = timezone.now()
        user.save(update_fields=["logout_time"])

        return Response(
            {"detail": "Logged out from all devices."},
            status=status.HTTP_200_OK,
        )
