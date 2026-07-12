import uuid

from django.db import models
from django.utils import timezone

from security.rbac import DEFAULT_ROLE, ROLE_CHOICES


# Object:
# {
#     "id": "uuid",
#     "entra_oid": "string",
#     "tenant_id": "string",
#     "email": "email",
#     "first_name": "string",
#     "last_name": "string",
#     "job_title": "string",
#     "department": "string",
#     "image": "string",
#     "is_active": true,
#     "role": "string",
#     "last_seen_at": "datetime | null",
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class User(models.Model):
    """Local user mirrored from an Entra ID (Azure AD) identity.

    Created on first authenticated request (see
    ``security.auth.EntraIDAuthentication``). ``entra_oid`` is the
    immutable Entra object id (``oid`` claim) — the stable key we map tokens to.

    This is intentionally NOT a Django auth user: no password, no permissions,
    no admin. The two properties below are all DRF's ``IsAuthenticated`` needs
    from ``request.user``.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entra_oid = models.CharField(max_length=64, unique=True, db_index=True)
    tenant_id = models.CharField(max_length=64, blank=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    job_title = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    image = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=DEFAULT_ROLE)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."user"'
        indexes = [
            models.Index(fields=["entra_oid"]),
            models.Index(fields=["email"]),
        ]

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return self.email or self.entra_oid
