from django.db import migrations


def backfill_sku_selection_workflow_type(apps, schema_editor):
    WorkflowRun = apps.get_model("core", "WorkflowRun")
    # Rows written before SKU-selection runs were tagged have an empty `tags`
    # dict (no `workflow_type` key). The visualization guard looks them up with
    # `.exclude(tags__workflow_type="visualization")`, which drops rows missing
    # the key entirely. Tag them so the lookups can find them again.
    for workflow in WorkflowRun.objects.exclude(tags__has_key="workflow_type"):
        tags = dict(workflow.tags or {})
        tags["workflow_type"] = "sku_selection"
        workflow.tags = tags
        workflow.save(update_fields=["tags"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0023_drop_unused_raw_dataset_rows"),
    ]

    operations = [
        migrations.RunPython(
            backfill_sku_selection_workflow_type,
            noop_reverse,
        ),
    ]
