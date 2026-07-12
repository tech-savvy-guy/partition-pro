import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


# Object:
# {
#     "id": "uuid",
#     "case_id": "uuid",
#     "name": "string",
#     "description": "string",
#     "status": "draft | active | archived",
#     "is_shared": false,
#     "is_deleted": false,
#     "tags": {},
#     "base_partition": "uuid | null",
#     "locked_by": "uuid | null",
#     "lock_expires_at": "datetime | null",
#     "created_by": "uuid | null",
#     "updated_by": "uuid | null",
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class Partition(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        "core.Case",
        db_column="case_id",
        on_delete=models.CASCADE,
        related_name="partitions",
    )
    name = models.TextField()
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    is_shared = models.BooleanField(default=False, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    tags = models.JSONField(default=dict, blank=True)
    base_partition = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        db_column="base_partition",
        on_delete=models.SET_NULL,
        related_name="derived_partitions",
    )
    locked_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="locked_by",
        on_delete=models.SET_NULL,
        related_name="locked_partitions",
    )
    lock_expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="created_by",
        on_delete=models.SET_NULL,
        related_name="created_partitions",
    )
    updated_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="updated_by",
        on_delete=models.SET_NULL,
        related_name="updated_partitions",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."partitions"'
        constraints = [
            models.UniqueConstraint(
                fields=["case_id", "name"],
                condition=Q(is_deleted=False),
                name="uq_core_partitions_active_name",
            ),
        ]
        indexes = [
            models.Index(fields=["case_id", "is_deleted"], name="idx_core_part_case"),
            models.Index(fields=["status"], name="idx_core_part_status"),
            models.Index(fields=["locked_by"], name="idx_core_part_locked_by"),
        ]

    def __str__(self):
        return self.name

    @property
    def locked_by_display_name(self):
        if not self.locked_by_id:
            return ""

        name = " ".join(
            part for part in (self.locked_by.first_name, self.locked_by.last_name) if part
        ).strip()
        return name or self.locked_by.email
