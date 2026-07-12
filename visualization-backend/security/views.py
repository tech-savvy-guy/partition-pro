import base64
import hmac
import secrets

from django.conf import settings
from rest_framework import exceptions, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from security.auth import EntraIDAuthentication
from security.graph import GraphPhotoNotFound, GraphProfileError, fetch_graph_photo
from security.rbac import get_permissions_for_role, normalize_role
from security.tokens import issue_token_pair, refresh_access_token, revoke_refresh_token

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth/"
COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "HTTP_X_CSRF_TOKEN"


def get_display_name(user):
    name = " ".join(part for part in (user.first_name, user.last_name) if part).strip()
    return name or user.email


def serialize_user(user, image=None):
    return {
        "email": user.email,
        "display_name": get_display_name(user),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "job_title": user.job_title,
        "department": user.department,
        "role": normalize_role(user.role),
        "permissions": get_permissions_for_role(user.role),
        "image": image or user.image or None,
    }


def get_image_data_url(token):
    if not token:
        return None

    try:
        photo, content_type = fetch_graph_photo(token)
    except (GraphPhotoNotFound, GraphProfileError):
        return None

    encoded_photo = base64.b64encode(photo).decode("ascii")
    return f"data:{content_type};base64,{encoded_photo}"


def build_auth_response(user, token_pair, image=None):
    response = Response(
        {
            "access_token": token_pair["access_token"],
            "token_type": "Bearer",
            "expires_in": settings.APP_JWT_ACCESS_TTL_SECONDS,
            "user": serialize_user(user, image),
        }
    )
    set_refresh_cookie(response, token_pair["refresh_token"])
    set_csrf_cookie(response)
    return response


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.APP_JWT_REFRESH_TTL_SECONDS,
        path=REFRESH_COOKIE_PATH,
        secure=not settings.DEBUG,
        httponly=True,
        samesite=COOKIE_SAMESITE,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        samesite=COOKIE_SAMESITE,
    )


def set_csrf_cookie(response):
    response.set_cookie(
        CSRF_COOKIE_NAME,
        secrets.token_urlsafe(32),
        max_age=settings.APP_JWT_REFRESH_TTL_SECONDS,
        path="/",
        secure=not settings.DEBUG,
        httponly=False,
        samesite=COOKIE_SAMESITE,
    )


def clear_csrf_cookie(response):
    response.delete_cookie(
        CSRF_COOKIE_NAME,
        path="/",
        samesite=COOKIE_SAMESITE,
    )


def require_csrf(request):
    csrf_cookie = request.COOKIES.get(CSRF_COOKIE_NAME)
    csrf_header = request.META.get(CSRF_HEADER_NAME)
    if not csrf_cookie or not csrf_header:
        raise exceptions.PermissionDenied("Missing CSRF token.")
    if not hmac.compare_digest(csrf_cookie, csrf_header):
        raise exceptions.PermissionDenied("Invalid CSRF token.")


def get_refresh_cookie(request):
    refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise exceptions.AuthenticationFailed("Missing refresh token.")
    return refresh_token


class ExchangeTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        entra_auth = EntraIDAuthentication()
        entra_token = entra_auth._get_bearer_token(request)
        if not entra_token:
            raise exceptions.AuthenticationFailed("Missing Entra access token.")

        claims = entra_auth._decode(entra_token)
        user = entra_auth._get_or_create_user(claims, entra_token)
        token_pair = issue_token_pair(user)
        image = get_image_data_url(entra_token)
        if image and user.image != image:
            user.image = image
            user.save(update_fields=["image", "updated_at"])
        return build_auth_response(user, token_pair, image)


class RefreshTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        require_csrf(request)
        try:
            user, token_pair = refresh_access_token(get_refresh_cookie(request))
        except exceptions.AuthenticationFailed as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
        return build_auth_response(user, token_pair)


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        require_csrf(request)
        refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh_token:
            revoke_refresh_token(refresh_token)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        clear_csrf_cookie(response)
        return response
