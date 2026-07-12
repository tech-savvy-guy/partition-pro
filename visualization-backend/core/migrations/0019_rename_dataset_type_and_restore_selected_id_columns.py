import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_remove_partition_step_status"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="dataset",
            name="uq_core_datasets_case_type_version",
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='DROP INDEX IF EXISTS "core"."idx_core_datasets_case_type"',
                    reverse_sql=(
                        'CREATE INDEX "idx_core_datasets_case_type" '
                        'ON "core"."datasets" ("case", "dataset_type", "version" DESC)'
                    ),
                ),
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name="dataset",
                    name="idx_core_datasets_case_type",
                ),
            ],
        ),
        migrations.RenameField(
            model_name="dataset",
            old_name="dataset_type",
            new_name="type",
        ),
        migrations.AlterField(
            model_name="dataset",
            name="case",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="datasets",
                to="core.case",
            ),
        ),
        migrations.AlterField(
            model_name="caseuserassignment",
            name="case",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="user_assignments",
                to="core.case",
            ),
        ),
        migrations.AlterField(
            model_name="caseuserassignment",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="case_assignments",
                to="core.user",
            ),
        ),
        migrations.AddIndex(
            model_name="dataset",
            index=models.Index(
                fields=["case", "type", "-version"],
                name="idx_core_datasets_case_type",
            ),
        ),
        migrations.AddConstraint(
            model_name="dataset",
            constraint=models.UniqueConstraint(
                fields=("case", "type", "version"),
                name="uq_core_datasets_case_type_version",
            ),
        ),
    ]
