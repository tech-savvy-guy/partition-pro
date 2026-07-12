"""Reusable DRF permissions for Entra ID scopes, app roles, and app RBAC.

Entra puts delegated scopes in the space-separated ``scp`` claim and application
roles in the ``roles`` claim. Use these to gate endpoints on a specific scope:

    class ReportsView(APIView):
        permission_classes = [IsAuthenticated, HasScope("Reports.Read")]
"""
from rest_framework.permissions import BasePermission

from security.rbac import user_has_any_permission, user_has_permission


def HasScope(required_scope):
    """Permission factory: require ``required_scope`` in the token's ``scp`` claim."""

    class _HasScope(BasePermission):
        message = f"Token is missing the required scope: {required_scope}."

        def has_permission(self, request, view):
            claims = request.auth or {}
            scopes = (claims.get("scp") or "").split()
            return required_scope in scopes

    return _HasScope


def HasRole(required_role):
    """Permission factory: require ``required_role`` in the token's ``roles`` claim."""

    class _HasRole(BasePermission):
        message = f"Token is missing the required role: {required_role}."

        def has_permission(self, request, view):
            claims = request.auth or {}
            return required_role in (claims.get("roles") or [])

    return _HasRole


def HasPermission(required_permission):
    """Permission factory: require the authenticated user to have an app permission."""

    class _HasPermission(BasePermission):
        message = f"User is missing the required permission: {required_permission}."

        def has_permission(self, request, view):
            return user_has_permission(request.user, required_permission)

    return _HasPermission


def HasAnyPermission(*required_permissions):
    """Permission factory: require at least one app permission."""

    class _HasAnyPermission(BasePermission):
        message = (
            "User is missing one of the required permissions: "
            + ", ".join(required_permissions)
            + "."
        )

        def has_permission(self, request, view):
            return user_has_any_permission(request.user, required_permissions)

    return _HasAnyPermission
