from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_dataset_is_selected_drop_dataset_selections"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "core"."workflow_runs" RENAME TO "workflows"',
                    reverse_sql='ALTER TABLE "core"."workflows" RENAME TO "workflow_runs"',
                ),
            ],
            state_operations=[
                migrations.AlterModelTable(
                    name="workflowrun",
                    table='"core"."workflows"',
                ),
            ],
        ),
    ]
