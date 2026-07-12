from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_remove_case_product_type"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "core"."case_user_assignments" RENAME TO "assignments"',
                    reverse_sql='ALTER TABLE "core"."assignments" RENAME TO "case_user_assignments"',
                ),
            ],
            state_operations=[
                migrations.AlterModelTable(
                    name="caseuserassignment",
                    table='"core"."assignments"',
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "core"."partition_dataset_selections" RENAME TO "dataset_selections"',
                    reverse_sql='ALTER TABLE "core"."dataset_selections" RENAME TO "partition_dataset_selections"',
                ),
            ],
            state_operations=[
                migrations.AlterModelTable(
                    name="partitiondatasetselection",
                    table='"core"."dataset_selections"',
                ),
            ],
        ),
        migrations.RemoveConstraint(
            model_name="partitiondatasetselection",
            name="uq_core_partition_dataset_type",
        ),
        migrations.RemoveIndex(
            model_name="workflowrun",
            name="idx_core_wfr_case_status",
        ),
        migrations.RemoveField(
            model_name="partition",
            name="locked_by_name",
        ),
        migrations.RemoveField(
            model_name="partitiondatasetselection",
            name="dataset_type",
        ),
        migrations.RemoveField(
            model_name="workflowrun",
            name="case",
        ),
    ]
