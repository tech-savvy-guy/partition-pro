import uuid
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

class Case(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    created_by = models.TextField()
    created_on = models.DateTimeField()
    updated_by = models.TextField()
    updated_on = models.DateTimeField()
    is_deleted = models.BooleanField(default=False)

    case_name = models.TextField()
    methodology = models.TextField()
    case_code = models.TextField()
    requested_by = models.TextField()
    case_manager = models.TextField()
    nps_contact = models.TextField()

    status = models.TextField(null=True, blank=True)
    product_type = models.TextField(null=True, blank=True)
    category = models.TextField()
    tags = models.JSONField(default=dict)

    end_date = models.DateTimeField(null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    is_preprocessed = models.BooleanField(default=False)
    description = models.TextField()
    tenant_id = models.UUIDField()
    
    final_answer = models.TextField(null=True, blank=True)

    class Meta:
        db_table = '"core"."cases"'
        managed = False

class Changelogs(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_on = models.DateTimeField()
    created_by = models.TextField()
    heading = models.TextField()
    description = models.TextField()

    class Meta:
        db_table = '"core"."changelogs"'
        managed = False

class UserAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    created_on = models.DateTimeField()
    created_by = models.TextField()
    updated_on = models.DateTimeField()
    updated_by = models.TextField()
    is_deleted = models.BooleanField(default=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="assignments",
        db_column="case_id",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="case_assignments",
        db_column="user_id",
    )

    role = models.TextField()        # 'PUBLISHER' | 'EDITOR' | 'VIEWER'
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."user_assignments"'
        managed = False
        unique_together = ("case", "user")


class PreprocessedMetadata(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_on = models.DateTimeField()
    case_id = models.UUIDField()
    att_dataset_id = models.UUIDField()
    pos_dataset_id = models.UUIDField()
    cp_dataset_id = models.UUIDField()
    version = models.BigIntegerField()
    tags = models.JSONField(default=dict)
    class Meta:
        db_table = '"core"."preprocessed_metadata"'
        managed = False

class Workflow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    updated_by = models.TextField(null=True, blank=True)
    updated_on = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    case_id = models.UUIDField()
    partition_id = models.UUIDField()

    data = models.JSONField(default=dict)
    tags = models.JSONField(default=dict)

    status = models.TextField()             # e.g. 'ACTIVE', 'INACTIVE'
    step_number = models.IntegerField(default=1)

    class Meta:
        db_table = '"core"."workflows"'
        managed = False
        unique_together = ("case_id", "partition_id", "step_number")

class Partitions(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    created_on = models.DateTimeField()
    created_by = models.TextField()
    updated_on = models.DateTimeField()
    updated_by = models.TextField()
    is_deleted = models.BooleanField(default=False)
    is_shared = models.BooleanField(default=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="partitions",
        db_column="case_id",
    )
    ppm = models.ForeignKey(
        PreprocessedMetadata,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="ppm_id",
        related_name="partitions",
    )

    partition_name = models.TextField()
    description = models.TextField()
    base_partition = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parent_partition",
        db_column="base_partition"
    )
    status = models.TextField()
    end_date = models.DateTimeField()
    step_status = models.TextField()
    tags = models.JSONField(default=dict)

    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="locked_partitions",
    )
    locked_by_name = models.CharField(max_length=255, blank=True, default="")
    lock_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = '"core"."partitions"'
        managed = False
        unique_together = ("case", "partition_name")



class DatasetMetadata(models.Model):
    """
    Stores metadata about uploaded datasets per case and per data_type.
    Each (case, data_type) can have many versions.
    One version can be marked as `is_selected=true`.
    Raw data tables link to DatasetMetadata via metadata_id.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    created_on = models.DateTimeField()
    created_by = models.TextField()
    is_deleted = models.BooleanField(default=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="dataset_metadata",
        db_column="case_id",
    )

    data_type = models.TextField()     # POS | ATTRIBUTES | CROSSPURCHASE
    version = models.IntegerField()    # version counter per case + data_type

    file_name = models.TextField()
    file_size = models.DecimalField(max_digits=20, decimal_places=2, null=True)
    blob_name = models.TextField()
    description = models.TextField(null=True, blank=True)

    status = models.TextField(default="Processing") # Processing | Ready | Failed | Archived

    tags = models.JSONField(default=dict)

    is_selected = models.BooleanField(default=False)

    class Meta:
        db_table = '"core"."dataset_metadata"'
        managed = False
        unique_together = ("case", "data_type", "version")

    def __str__(self):
        return f"{self.case_id} - {self.data_type} (v{self.version})"

class PartitionDatasetMetadata(models.Model):
    """
    Stores metadata about uploaded datasets per case per partition and per data_type.
    Only one active file per (case, partition, data_type) is allowed.
    Raw data tables link to PartitionDatasetMetadata via metadata_id.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    created_on = models.DateTimeField()
    created_by = models.TextField()
    is_deleted = models.BooleanField(default=False)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name="partition_dataset_metadata",
        db_column="case_id",
    )
    partition = models.ForeignKey(
        Partitions,
        on_delete=models.CASCADE,
        related_name="partition_dataset_metadata",
        db_column="partition_id",
    )

    data_type = models.TextField()     # GROUPING
    version = models.IntegerField(default=1)    # Always 1 for single-file uploads

    file_name = models.TextField()
    file_size = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    blob_name = models.TextField()
    description = models.TextField(null=True, blank=True)

    status = models.TextField(default="Ready")  # Ready | Failed
    tags = models.JSONField(default=dict)
    is_selected = models.BooleanField(default=True)

    class Meta:
        db_table = '"core"."partition_dataset_metadata"'
        managed = False
        unique_together = ("case", "partition", "data_type")

    def __str__(self):
        return f"{self.case.id} - {self.partition.id} - {self.data_type}"

class PartitionsRawDatasetMapping(models.Model):
    """
    Mapping between a Partition and a specific dataset version.
    One row per (partition, data_type).
    E.g. A partition will have:
        POS -> dataset_metadata row
        ATTRIBUTES -> dataset_metadata row
        CROSSPURCHASE -> dataset_metadata row
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    partition = models.ForeignKey(
        Partitions,
        on_delete=models.CASCADE,
        related_name="dataset_mappings",
        db_column="partition_id",
    )

    dataset = models.ForeignKey(
        DatasetMetadata,
        on_delete=models.CASCADE,
        related_name="partition_mappings",
        db_column="dataset_id",
    )

    data_type = models.TextField()   # POS | ATTRIBUTES | CROSSPURCHASE

    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."partitions_raw_dataset_mapping"'
        managed = False
        unique_together = ("partition", "data_type")

    def __str__(self):
        return f"{self.partition_id} → {self.data_type} → {self.dataset_id}"

class PreprocessedSkuSelection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case_id = models.UUIDField()
    row_num = models.BigIntegerField()
    data = models.JSONField(default=dict)

    pp_metadata = models.ForeignKey(
        PreprocessedMetadata,
        on_delete=models.CASCADE,
        db_column="pp_metadata_id",
        related_name="sku_rows",
    )

    class Meta:
        db_table = '"core"."preprocessed_sku_selection"'
        managed = False


class PreprocessedBaseMath(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case_id = models.UUIDField()
    row_num = models.BigIntegerField()
    data = models.JSONField(default=dict)

    pp_metadata = models.ForeignKey(
        PreprocessedMetadata,
        on_delete=models.CASCADE,
        db_column="pp_metadata_id",
        related_name="base_math_rows",
    )

    class Meta:
        db_table = '"core"."preprocessed_base_math"'
        managed = False

class RawAttributesData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    metadata_id = models.UUIDField()
    case_id = models.UUIDField()
    row_num = models.BigIntegerField()
    version = models.IntegerField()

    data = models.JSONField(default=dict)  # maps to jsonb
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."raw_attributes_data"'
        managed = False

class RawCrossPurchaseData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metadata_id = models.UUIDField()
    case_id = models.UUIDField()
    row_num = models.BigIntegerField()
    version = models.IntegerField()
    data = models.JSONField(default=dict)
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."raw_cross_purchase_data"'
        managed = False

class RawGroupingData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    metadata_id = models.UUIDField()
    case_id = models.UUIDField()
    partition_id = models.UUIDField()
    row_num = models.BigIntegerField()
    version = models.IntegerField()

    data = models.JSONField(default=dict)  # maps to jsonb
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."raw_grouping_data"'
        managed = False


class WorkingAttributesData(models.Model):
    """
    Stores partition-level working attributes derived from ATTRIBUTES + GROUPING.
    Rows auto-delete when the referenced GROUPING metadata is deleted
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    grouping_metadata = models.ForeignKey(
        "PartitionDatasetMetadata",
        on_delete=models.CASCADE,
        db_column="grouping_metadata_id",
        related_name="working_attributes_rows",
    )

    case_id = models.UUIDField()
    partition_id = models.UUIDField()

    version = models.IntegerField(default=1)

    row_num = models.BigIntegerField()

    data = models.JSONField(default=dict)
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = '"core"."working_attributes_data"'
        managed = False

    def __str__(self):
        return f"{self.partition_id} - row {self.row_num}"