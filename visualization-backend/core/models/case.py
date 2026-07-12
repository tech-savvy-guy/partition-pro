import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


# Object:
# {
#     "id": "uuid",
#     "name": "string",
#     "code": "string",
#     "description": "string",
#     "methodology": "string",
#     "status": "draft | active | archived | completed",
#     "category": "string",
#     "tags": {},
#     "is_archived": false,
#     "is_deleted": false,
#     "created_by": "uuid | null",
#     "updated_by": "uuid | null",
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class Case(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    code = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    methodology = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    category = models.TextField(blank=True)
    tags = models.JSONField(default=dict, blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="created_by",
        on_delete=models.SET_NULL,
        related_name="created_cases",
    )
    updated_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="updated_by",
        on_delete=models.SET_NULL,
        related_name="updated_cases",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."cases"'
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=Q(is_deleted=False),
                name="uq_core_cases_active_code",
            ),
        ]
        indexes = [
            models.Index(fields=["status"], name="idx_core_cases_status"),
            models.Index(
                fields=["is_archived", "is_deleted"],
                name="idx_core_cases_archive_delete",
            ),
            models.Index(fields=["created_by"], name="idx_core_cases_created_by"),
        ]

    def __str__(self):
        return self.name


# Object:
# {
#     "case_id": "uuid",
#     "user_id": "uuid",
#     "role": "publisher | editor | viewer",
#     "is_deleted": false,
#     "tags": {},
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class CaseUserAssignment(models.Model):
    class Role(models.TextChoices):
        PUBLISHER = "publisher", "Publisher"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    pk = models.CompositePrimaryKey("user", "case")
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="user_assignments",
    )
    user = models.ForeignKey(
        "core.User",
        on_delete=models.CASCADE,
        related_name="case_assignments",
    )
    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        default=Role.VIEWER,
    )
    is_deleted = models.BooleanField(default=False, db_index=True)
    tags = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."assignments"'
        indexes = [
            models.Index(fields=["user", "is_deleted"], name="idx_core_assign_user"),
            models.Index(fields=["case", "is_deleted"], name="idx_core_assign_case"),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.case_id}:{self.role}"
