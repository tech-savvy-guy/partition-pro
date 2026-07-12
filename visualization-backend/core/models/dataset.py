import uuid

from django.db import models
from django.utils import timezone


# Object:
# {
#     "id": "uuid",
#     "case_id": "uuid",
#     "type": "pos | attributes | cross_purchase",
#     "version": 1,
#     "file_name": "string",
#     "file_size": "decimal | null",
#     "blob_name": "string",
#     "description": "string",
#     "status": "processing | ready | failed | archived",
#     "is_deleted": false,
#     "is_selected": false,
#     "tags": {},
#     "created_by": "uuid | null",
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class Dataset(models.Model):
    class Type(models.TextChoices):
        POS = "pos", "POS"
        ATTRIBUTES = "attributes", "Attributes"
        CROSS_PURCHASE = "cross_purchase", "Cross purchase"

    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        "core.Case",
        on_delete=models.CASCADE,
        related_name="datasets",
    )
    type = models.CharField(max_length=32, choices=Type.choices)
    version = models.PositiveIntegerField()
    file_name = models.TextField()
    file_size = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
    )
    blob_name = models.TextField()
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PROCESSING,
        db_index=True,
    )
    is_deleted = models.BooleanField(default=False, db_index=True)
    is_selected = models.BooleanField(default=False, db_index=True)
    tags = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="created_by",
        on_delete=models.SET_NULL,
        related_name="created_datasets",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."datasets"'
        constraints = [
            models.UniqueConstraint(
                fields=["case", "type", "version"],
                name="uq_core_datasets_case_type_version",
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1),
                name="ck_core_datasets_version_positive",
            ),
        ]
        indexes = [
            models.Index(
                fields=["case", "type", "-version"],
                name="idx_core_datasets_case_type",
            ),
            models.Index(fields=["status"], name="idx_core_datasets_status"),
        ]

    def __str__(self):
        return f"{self.case_id}:{self.type}:v{self.version}"
