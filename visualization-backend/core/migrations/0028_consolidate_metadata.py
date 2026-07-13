from django.db import migrations, models

OLD_GET_ROI_MATRIX_ROWS_SQL = """
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

NEW_GET_ROI_MATRIX_ROWS_SQL = """
CREATE FUNCTION core.get_roi_matrix_rows_by_skuname(
    _metadata_id uuid,
    _selected_skunames text[] DEFAULT NULL::text[]
) RETURNS TABLE(sku_l text, sku_r text, roi real)
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
    SELECT
        l.key AS sku_l,
        r.key AS sku_r,
        (r.value)::float4 AS roi
    FROM core.metadata m
    CROSS JOIN LATERAL jsonb_each(m.roi_matrix) AS l(key, value)
    CROSS JOIN LATERAL jsonb_each_text(l.value) AS r(key, value)
    WHERE m.id = _metadata_id
      AND (_selected_skunames IS NULL OR l.key = ANY(_selected_skunames))
      AND (_selected_skunames IS NULL OR r.key = ANY(_selected_skunames));
$$;
"""

DROP_ROI_MATRIX_ROWS_SQL = (
    "DROP FUNCTION IF EXISTS core.get_roi_matrix_rows_by_skuname(uuid, text[])"
)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_preprocessing_tables"),
    ]

    operations = [
        # 1. Drop the two child row-tables (and their GIN indexes) — the whole
        # matrix now lives as nested JSONB on the single Metadata row instead.
        migrations.RunSQL(
            sql='DROP INDEX IF EXISTS "core"."idx_preproc_bm_data_gin"',
            reverse_sql=(
                'CREATE INDEX "idx_preproc_bm_data_gin" '
                'ON "core"."preprocessed_base_math" USING gin ("data")'
            ),
        ),
        migrations.RunSQL(
            sql='DROP INDEX IF EXISTS "core"."idx_preproc_ss_data_gin"',
            reverse_sql=(
                'CREATE INDEX "idx_preproc_ss_data_gin" '
                'ON "core"."preprocessed_sku_selection" USING gin ("data")'
            ),
        ),
        migrations.DeleteModel(name="PreprocessedBaseMath"),
        migrations.DeleteModel(name="PreprocessedSkuSelection"),
        # 2. Drop the old (single-row-per-SKU) unpivot function — it depended
        # on the table just dropped above.
        migrations.RunSQL(
            sql=DROP_ROI_MATRIX_ROWS_SQL,
            reverse_sql=OLD_GET_ROI_MATRIX_ROWS_SQL,
        ),
        # 3. Rename PreprocessedMetadata -> Metadata, then the physical table
        # "core"."preprocessed_metadata" -> "core"."metadata" (mirrors 0014's
        # SeparateDatabaseAndState technique for schema-qualified renames).
        migrations.RenameModel(old_name="PreprocessedMetadata", new_name="Metadata"),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "core"."preprocessed_metadata" RENAME TO "metadata"',
                    reverse_sql='ALTER TABLE "core"."metadata" RENAME TO "preprocessed_metadata"',
                ),
            ],
            state_operations=[
                migrations.AlterModelTable(name="metadata", table='"core"."metadata"'),
            ],
        ),
        # 4. New fields: the dataset-triple gains pos_dataset_id, and the ROI
        # matrix + row_max now live directly on this one row.
        migrations.AddField(
            model_name="metadata",
            name="pos_dataset_id",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="metadata",
            name="row_max",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="metadata",
            name="roi_matrix",
            field=models.JSONField(blank=True, default=dict),
        ),
        # 5. Rename the constraint/index to match the new model name.
        migrations.RemoveConstraint(
            model_name="metadata",
            name="uq_preproc_meta_case_signature",
        ),
        migrations.AddConstraint(
            model_name="metadata",
            constraint=models.UniqueConstraint(
                fields=("case_id", "signature"),
                name="uq_metadata_case_signature",
            ),
        ),
        migrations.RemoveIndex(model_name="metadata", name="idx_preproc_meta_case_status"),
        migrations.AddIndex(
            model_name="metadata",
            index=models.Index(
                fields=["case_id", "status"],
                name="idx_metadata_case_status",
            ),
        ),
        # 6. The new two-level unpivot function, over core.metadata.roi_matrix.
        migrations.RunSQL(
            sql=NEW_GET_ROI_MATRIX_ROWS_SQL,
            reverse_sql=DROP_ROI_MATRIX_ROWS_SQL,
        ),
    ]
