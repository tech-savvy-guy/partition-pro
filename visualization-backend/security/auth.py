"""Entra ID (Azure AD) access-token validation for DRF.

This backend is a *resource server*: the React frontend logs in against Entra ID
via MSAL and obtains an access token (a JWT). It sends that token to us as an
``Authorization: Bearer <token>`` header. We never mint tokens — we only verify
the Entra-issued one on each request:

  * RS256 signature, checked against Entra's published JWKS (public keys);
  * ``aud`` (audience) matches this API's configured value;
  * ``iss`` (issuer) matches our tenant's v1.0 or v2.0 issuer;
  * ``exp`` (expiry) is in the future.

A validated token is mapped to a local ``core.User`` (created on first sight),
keyed on the immutable ``oid`` claim.
"""
from functools import lru_cache
import logging

import jwt
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone
from rest_framework import authentication, exceptions

from core.models import User
from security.graph import GraphProfileError, fetch_graph_profile
from security.rbac import DEFAULT_ROLE
from security.tokens import decode_app_token, get_user_from_claims

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_jwk_client():
    """Return a cached PyJWKClient for the tenant's signing keys.

    PyJWKClient fetches the JWKS lazily and caches keys internally, so we only
    hit Entra's discovery endpoint when an unseen ``kid`` shows up.
    """
    return jwt.PyJWKClient(settings.ENTRA_JWKS_URI)


class EntraIDAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        token = self._get_bearer_token(request)
        if token is None:
            # No credentials -> let permission classes decide (returns 401/200).
            return None

        claims = self._decode(token)
        user = self._get_or_create_user(claims, token)
        # Returning claims as `request.auth` lets views inspect scopes/roles.
        return (user, claims)

    def authenticate_header(self, request):
        # Drives the WWW-Authenticate header so DRF returns 401 (not 403).
        return self.keyword

    def _get_bearer_token(self, request):
        header = authentication.get_authorization_header(request).decode("latin-1")
        if not header:
            return None
        parts = header.split()
        if parts[0].lower() != self.keyword.lower():
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Malformed Authorization header.")
        return parts[1]

    def _decode(self, token):
        try:
            signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=settings.ENTRA_AUDIENCES,
                issuer=settings.ENTRA_ISSUERS,
            )
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed(f"Invalid token: {exc}")
        except ImproperlyConfigured as exc:
            raise exceptions.AuthenticationFailed(str(exc))

    def _get_or_create_user(self, claims, token):
        oid = claims.get("oid")
        if not oid:
            raise exceptions.AuthenticationFailed("Token is missing the 'oid' claim.")

        graph_profile = self._get_graph_profile(token)

        email = (
            graph_profile.get("mail")
            or graph_profile.get("userPrincipalName")
            or claims.get("email")
            or claims.get("preferred_username")
            or claims.get("upn")
            or f"{oid}@entra.invalid"
        ).lower()
        now = timezone.now()
        defaults = {
            "tenant_id": claims.get("tid") or "",
            "email": email,
            "first_name": graph_profile.get("givenName") or claims.get("given_name") or "",
            "last_name": graph_profile.get("surname") or claims.get("family_name") or "",
            "job_title": (
                graph_profile.get("jobTitle")
                or claims.get("jobTitle")
                or claims.get("job_title")
                or ""
            ),
            "department": graph_profile.get("department") or claims.get("department") or "",
            "role": DEFAULT_ROLE,
            "last_seen_at": now,
        }

        user, created = User.objects.get_or_create(
            entra_oid=oid,
            defaults=defaults,
        )
        if not user.is_active:
            raise exceptions.AuthenticationFailed("User account is inactive.")
        if not created:
            update_fields = []
            for field, value in defaults.items():
                if field == "role" and getattr(user, field):
                    continue
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    update_fields.append(field)
            if update_fields:
                update_fields.append("updated_at")
                user.save(update_fields=update_fields)
        return user

    def _get_graph_profile(self, token):
        try:
            profile = fetch_graph_profile(token)
            logger.info(
                "Microsoft Graph profile enrichment succeeded with fields: %s",
                ", ".join(sorted(profile.keys())),
            )
            return profile
        except GraphProfileError as exc:
            # Authentication should not fail only because optional profile
            # enrichment is unavailable or consent has not been granted yet.
            logger.warning("Microsoft Graph profile enrichment failed: %s", exc)
            return {}


class AppJWTAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        token = self._get_bearer_token(request)
        if token is None:
            return None

        claims = decode_app_token(token, "access")
        user = get_user_from_claims(claims)
        return (user, claims)

    def authenticate_header(self, request):
        return self.keyword

    def _get_bearer_token(self, request):
        header = authentication.get_authorization_header(request).decode("latin-1")
        if not header:
            return None
        parts = header.split()
        if parts[0].lower() != self.keyword.lower():
            return None
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Malformed Authorization header.")
        return parts[1]
