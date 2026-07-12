import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions

from core.models import User
from security.models import RefreshToken
from security.rbac import normalize_role

ALGORITHM = "HS256"


def hash_jti(jti):
    return hmac.new(
        settings.APP_JWT_SIGNING_KEY.encode("utf-8"),
        jti.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_access_token(user):
    now = timezone.now()
    expires_at = now + timedelta(seconds=settings.APP_JWT_ACCESS_TTL_SECONDS)
    claims = {
        "typ": "access",
        "sub": str(user.id),
        "entra_oid": user.entra_oid,
        "email": user.email,
        "role": normalize_role(user.role),
        "iat": now,
        "exp": expires_at,
        "iss": settings.APP_JWT_ISSUER,
        "aud": settings.APP_JWT_AUDIENCE,
    }
    return jwt.encode(claims, settings.APP_JWT_SIGNING_KEY, algorithm=ALGORITHM)


def create_refresh_token(user):
    now = timezone.now()
    expires_at = now + timedelta(seconds=settings.APP_JWT_REFRESH_TTL_SECONDS)
    jti = secrets.token_urlsafe(32)
    claims = {
        "typ": "refresh",
        "sub": str(user.id),
        "jti": jti,
        "iat": now,
        "exp": expires_at,
        "iss": settings.APP_JWT_ISSUER,
        "aud": settings.APP_JWT_AUDIENCE,
    }
    token = jwt.encode(claims, settings.APP_JWT_SIGNING_KEY, algorithm=ALGORITHM)
    RefreshToken.objects.filter(user=user, expires_at__lte=now).delete()
    RefreshToken.objects.create(
        user=user,
        jti_hash=hash_jti(jti),
        expires_at=expires_at,
    )
    return token


def decode_app_token(token, expected_type):
    try:
        claims = jwt.decode(
            token,
            settings.APP_JWT_SIGNING_KEY,
            algorithms=[ALGORITHM],
            issuer=settings.APP_JWT_ISSUER,
            audience=settings.APP_JWT_AUDIENCE,
        )
    except jwt.PyJWTError as exc:
        raise exceptions.AuthenticationFailed(f"Invalid app token: {exc}") from exc

    if claims.get("typ") != expected_type:
        raise exceptions.AuthenticationFailed("Token has the wrong type.")
    return claims


def get_user_from_claims(claims):
    user_id = claims.get("sub")
    if not user_id:
        raise exceptions.AuthenticationFailed("Token is missing the subject.")
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("Token user does not exist.") from exc
    if not user.is_active:
        raise exceptions.AuthenticationFailed("User account is inactive.")
    return user


def issue_token_pair(user):
    return {
        "access_token": create_access_token(user),
        "refresh_token": create_refresh_token(user),
    }


def refresh_access_token(refresh_token):
    claims = decode_app_token(refresh_token, "refresh")
    user = get_user_from_claims(claims)
    jti = claims.get("jti")
    if not jti:
        raise exceptions.AuthenticationFailed("Refresh token is missing the jti.")

    try:
        token_record = RefreshToken.objects.get(
            user=user,
            jti_hash=hash_jti(jti),
        )
    except RefreshToken.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("Refresh token has been revoked.") from exc

    if token_record.is_revoked:
        raise exceptions.AuthenticationFailed("Refresh token has been revoked.")
    if token_record.is_expired:
        raise exceptions.AuthenticationFailed("Refresh token has expired.")

    now = timezone.now()
    token_record.last_used_at = now
    token_record.save(update_fields=["last_used_at"])
    return user, {
        "access_token": create_access_token(user),
        "refresh_token": refresh_token,
    }


def revoke_refresh_token(refresh_token):
    try:
        claims = decode_app_token(refresh_token, "refresh")
    except exceptions.AuthenticationFailed:
        return

    jti = claims.get("jti")
    user_id = claims.get("sub")
    if not jti or not user_id:
        return

    RefreshToken.objects.filter(
        user_id=user_id,
        jti_hash=hash_jti(jti),
        revoked_at__isnull=True,
    ).update(revoked_at=timezone.now())


def revoke_user_refresh_tokens(user):
    RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )
