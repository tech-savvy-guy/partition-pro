import uuid

from django.db import models
from django.utils import timezone


# Object:
# {
#     "id": "uuid",
#     "case_id": "uuid",
#     "pos_dataset_id": "uuid | null",
#     "att_dataset_id": "uuid | null",
#     "cp_dataset_id": "uuid | null",
#     "signature": "string",           # sha256 of the bound dataset ids + versions
#     "status": "pending | running | ready | failed",
#     "base": "float | null",          # scalar total_base_buyers for the case
#     "sku_count": 0,
#     "row_max": {},                   # {sku: row_max}, needed to derive abs_pen% cheaply
#     "avg_roi": {},                   # {sku: avg_roi}, full-panel mean ROI per SKU
#     "roi_matrix": {},                # nested {sku_l: {sku_r: roi}} full-panel ROI matrix
#     "error": "string",
#     "tags": {},
#     "created_at": "datetime",
#     "updated_at": "datetime",
# }
class Metadata(models.Model):
    """One row per (case, dataset-combination signature).

    Holds the full-panel ROI matrix directly as nested JSONB — no child row
    tables. A given signature's row is never deleted once created: re-selecting
    a previously-computed dataset combination reuses it instantly instead of
    recomputing (see core.services.preprocessing.build.run_preprocessing).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case_id = models.UUIDField(db_index=True)
    pos_dataset_id = models.UUIDField(null=True, blank=True)
    att_dataset_id = models.UUIDField(null=True, blank=True)
    cp_dataset_id = models.UUIDField(null=True, blank=True)
    signature = models.CharField(max_length=64)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    base = models.FloatField(null=True, blank=True)
    sku_count = models.IntegerField(default=0)
    row_max = models.JSONField(default=dict, blank=True)
    avg_roi = models.JSONField(default=dict, blank=True)
    roi_matrix = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    tags = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = '"core"."metadata"'
        constraints = [
            models.UniqueConstraint(
                fields=["case_id", "signature"],
                name="uq_metadata_case_signature",
            ),
        ]
        indexes = [
            models.Index(
                fields=["case_id", "status"],
                name="idx_metadata_case_status",
            ),
        ]

    def __str__(self):
        return f"{self.case_id}:{self.status}"
