from django.db import models
from django.utils import timezone


# Object:
# {
#     "id": "integer",
#     "user": "uuid",
#     "jti_hash": "string",
#     "expires_at": "datetime",
#     "revoked_at": "datetime | null",
#     "created_at": "datetime",
#     "last_used_at": "datetime | null",
# }
class RefreshToken(models.Model):
    user = models.ForeignKey(
        "core.User",
        db_column="user",
        on_delete=models.CASCADE,
        related_name="refresh_tokens",
    )
    jti_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"security"."refresh_token"'
        indexes = [
            models.Index(
                fields=["user", "revoked_at"],
                name="refresh_tok_user_id_f34c91_idx",
            ),
            models.Index(fields=["expires_at"], name="refresh_tok_expires_3ecf55_idx"),
        ]

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()
