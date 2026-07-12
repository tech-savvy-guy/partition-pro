import uuid

from django.db import models


class RawDatasetRowBase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metadata_id = models.UUIDField()
    case_id = models.UUIDField()
    version = models.IntegerField()
    data = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=dict, blank=True)
    row_num = models.BigIntegerField(default=0)

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.metadata_id}:{self.row_num}"


class RawPosData(RawDatasetRowBase):
    class Meta:
        db_table = '"core"."raw_pos_data"'
        indexes = [
            models.Index(fields=["metadata_id", "row_num"], name="idx_raw_pos_metadata_row"),
            models.Index(fields=["case_id", "version"], name="idx_raw_pos_case_version"),
            models.Index(fields=["case_id"], name="idx_raw_pos_case"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["metadata_id", "row_num"],
                name="uq_raw_pos_metadata_row",
            ),
        ]


class RawAttributesData(RawDatasetRowBase):
    class Meta:
        db_table = '"core"."raw_attributes_data"'
        indexes = [
            models.Index(fields=["metadata_id", "row_num"], name="idx_raw_attr_metadata_row"),
            models.Index(fields=["case_id", "version"], name="idx_raw_attr_case_version"),
            models.Index(fields=["case_id"], name="idx_raw_attr_case"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["metadata_id", "row_num"],
                name="uq_raw_attr_metadata_row",
            ),
        ]


class RawCrossPurchaseData(RawDatasetRowBase):
    class Meta:
        db_table = '"core"."raw_cross_purchase_data"'
        indexes = [
            models.Index(fields=["metadata_id", "row_num"], name="idx_raw_cp_metadata_row"),
            models.Index(fields=["case_id", "version"], name="idx_raw_cp_case_version"),
            models.Index(fields=["case_id"], name="idx_raw_cp_case"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["metadata_id", "row_num"],
                name="uq_raw_cp_metadata_row",
            ),
        ]
