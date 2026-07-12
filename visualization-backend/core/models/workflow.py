import uuid

from django.db import models
from django.utils import timezone


# Object:
# {
#     "id": "uuid",
#     "partition_id": "uuid",
#     "status": "queued | running | completed | failed | cancelled",
#     "triggered_by": "uuid | null",
#     "started_at": "datetime",
#     "finished_at": "datetime | null",
#     "datasets": {},
#     "parameters": {},
#     "result": {},
#     "error": "string",
#     "tags": {},
# }
class WorkflowRun(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partition = models.ForeignKey(
        "core.Partition",
        db_column="partition_id",
        on_delete=models.CASCADE,
        related_name="workflows",
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    triggered_by = models.ForeignKey(
        "core.User",
        null=True,
        blank=True,
        db_column="triggered_by",
        on_delete=models.SET_NULL,
        related_name="triggered_workflows",
    )
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    datasets = models.JSONField(default=dict, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    tags = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = '"core"."workflows"'
        indexes = [
            models.Index(
                fields=["partition", "-started_at"],
                name="idx_core_wfr_latest",
            ),
            models.Index(
                fields=["partition", "status"],
                name="idx_core_wfr_partition_status",
            ),
        ]

    def __str__(self):
        return f"{self.partition_id}:{self.status}"
