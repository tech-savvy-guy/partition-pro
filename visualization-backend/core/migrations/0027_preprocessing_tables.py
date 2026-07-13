import uuid

from django.db import migrations, models
from django.utils import timezone


def preprocessed_row_fields():
    """Mirror of RawDatasetRowBase's concrete columns (see 0022)."""
    return [
        (
            "id",
            models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                primary_key=True,
                serialize=False,
            ),
        ),
        ("metadata_id", models.UUIDField()),
        ("case_id", models.UUIDField()),
        ("version", models.IntegerField()),
        ("data", models.JSONField(blank=True, default=dict)),
        ("tags", models.JSONField(blank=True, default=dict)),
        ("row_num", models.BigIntegerField(default=0)),
    ]


GET_ROI_MATRIX_ROWS_SQL = """
CREATE FUNCTION core.get_roi_matrix_rows_by_skuname(
    _metadata_id uuid,
    _selected_skunames text[] DEFAULT NULL::text[]
) RETURNS TABLE(sku_l text, sku_r text, roi real)
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
    SELECT
        pbm.data->>'skuname_ean' AS sku_l,
        kv.key                   AS sku_r,
        (kv.value)::float4       AS roi
    FROM core.preprocessed_base_math pbm
    CROSS JOIN LATERAL jsonb_each_text(pbm.data) kv
    WHERE pbm.metadata_id = _metadata_id
      AND (
            _selected_skunames IS NULL
         OR pbm.data->>'skuname_ean' = ANY(_selected_skunames)
      )
      AND kv.key <> 'skuname_ean'
      AND (
            _selected_skunames IS NULL
         OR kv.key = ANY(_selected_skunames)
      );
$$;
"""

DROP_ROI_MATRIX_ROWS_SQL = (
    "DROP FUNCTION IF EXISTS "
    "core.get_roi_matrix_rows_by_skuname(uuid, text[])"
)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0026_partition_tree_children"),
    ]

    operations = [
        migrations.CreateModel(
            name="PreprocessedMetadata",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("case_id", models.UUIDField(db_index=True)),
                ("cp_dataset_id", models.UUIDField(blank=True, null=True)),
                ("att_dataset_id", models.UUIDField(blank=True, null=True)),
                ("signature", models.CharField(max_length=64)),
                ("base", models.FloatField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("ready", "Ready"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=32,
                    ),
                ),
                ("sku_count", models.IntegerField(default=0)),
                ("error", models.TextField(blank=True)),
                ("tags", models.JSONField(blank=True, default=dict)),
                (
                    "created_at",
                    models.DateTimeField(default=timezone.now, editable=False),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": '"core"."preprocessed_metadata"',
            },
        ),
        migrations.CreateModel(
            name="PreprocessedBaseMath",
            fields=preprocessed_row_fields(),
            options={
                "db_table": '"core"."preprocessed_base_math"',
            },
        ),
        migrations.CreateModel(
            name="PreprocessedSkuSelection",
            fields=preprocessed_row_fields(),
            options={
                "db_table": '"core"."preprocessed_sku_selection"',
            },
        ),
        migrations.AddConstraint(
            model_name="preprocessedmetadata",
            constraint=models.UniqueConstraint(
                fields=("case_id", "signature"),
                name="uq_preproc_meta_case_signature",
            ),
        ),
        migrations.AddIndex(
            model_name="preprocessedmetadata",
            index=models.Index(
                fields=["case_id", "status"],
                name="idx_preproc_meta_case_status",
            ),
        ),
        migrations.AddIndex(
            model_name="preprocessedbasemath",
            index=models.Index(
                fields=["metadata_id", "row_num"],
                name="idx_preproc_bm_metadata_row",
            ),
        ),
        migrations.AddIndex(
            model_name="preprocessedbasemath",
            index=models.Index(fields=["case_id"], name="idx_preproc_bm_case"),
        ),
        migrations.AddConstraint(
            model_name="preprocessedbasemath",
            constraint=models.UniqueConstraint(
                fields=("metadata_id", "row_num"),
                name="uq_preproc_bm_metadata_row",
            ),
        ),
        migrations.AddIndex(
            model_name="preprocessedskuselection",
            index=models.Index(
                fields=["metadata_id", "row_num"],
                name="idx_preproc_ss_metadata_row",
            ),
        ),
        migrations.AddIndex(
            model_name="preprocessedskuselection",
            index=models.Index(fields=["case_id"], name="idx_preproc_ss_case"),
        ),
        migrations.AddConstraint(
            model_name="preprocessedskuselection",
            constraint=models.UniqueConstraint(
                fields=("metadata_id", "row_num"),
                name="uq_preproc_ss_metadata_row",
            ),
        ),
        migrations.RunSQL(
            sql=(
                'CREATE INDEX "idx_preproc_bm_data_gin" '
                'ON "core"."preprocessed_base_math" USING gin ("data")'
            ),
            reverse_sql='DROP INDEX IF EXISTS "core"."idx_preproc_bm_data_gin"',
        ),
        migrations.RunSQL(
            sql=(
                'CREATE INDEX "idx_preproc_ss_data_gin" '
                'ON "core"."preprocessed_sku_selection" USING gin ("data")'
            ),
            reverse_sql='DROP INDEX IF EXISTS "core"."idx_preproc_ss_data_gin"',
        ),
        migrations.RunSQL(
            sql=GET_ROI_MATRIX_ROWS_SQL,
            reverse_sql=DROP_ROI_MATRIX_ROWS_SQL,
        ),
    ]
