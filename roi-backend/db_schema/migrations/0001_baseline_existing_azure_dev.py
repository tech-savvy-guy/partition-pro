from pathlib import Path

from django.db import migrations


BASELINE_DIR = (
    Path(__file__).resolve().parent
    / "sql"
    / "0001_baseline_existing_azure_dev"
)


def read_sql(relative_path: str) -> str:
    return (BASELINE_DIR / relative_path).read_text(encoding="utf-8")


CORE_FUNCTIONS = [
    "core/functions/build_case_staging.sql",
    "core/functions/create_new_partition.sql",
    "core/functions/create_new_partition_vsy.sql",
    "core/functions/get_attribute_coverage.sql",
    "core/functions/get_basemath_full.sql",
    "core/functions/get_basemath_full_temp.sql",
    "core/functions/get_basemath_full_test.sql",
    "core/functions/get_basemath_joined_with_selection.sql",
    "core/functions/get_basemath_matrix_rows.sql",
    "core/functions/get_basemath_matrix_rows_by_skuname.sql",
    "core/functions/get_basemath_matrix_rows_by_skuname_v1.sql",
    "core/functions/get_basemath_optimal_pairs_by_skuname.sql",
    "core/functions/get_overall_coverage.sql",
]


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.RunSQL(
            read_sql("00_schemas.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            read_sql("security/10_tables.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            read_sql("security/20_constraints.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            read_sql("core/10_tables.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            read_sql("core/20_indexes_constraints_partitions.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
        *[
            migrations.RunSQL(
                read_sql(function_file),
                reverse_sql=migrations.RunSQL.noop,
            )
            for function_file in CORE_FUNCTIONS
        ],
        migrations.RunSQL(
            read_sql("core/30_views.sql"),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
