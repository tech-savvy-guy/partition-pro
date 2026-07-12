from django.db import migrations


def unify_workflow_rows(apps, schema_editor):
    """Collapse the per-type WorkflowRun rows into ONE unified row per partition.

    Previously a partition could have several rows tagged
    ``workflow_type = visualization | sku_selection | partition_tree``. The new
    model is a single row whose ``result`` holds two keys (``visualization`` and
    ``partition_tree``) and whose ``parameters`` holds ``selected_skus``.

    Per partition we keep the most recent row as canonical, merge the useful
    bits from the others into it, drop the legacy ``steps.partition_tree``
    structure (reseeded lazily in the new flat shape), strip ``workflow_type``
    from tags, and delete the extras. Idempotent and null-safe.
    """
    WorkflowRun = apps.get_model("core", "WorkflowRun")

    partition_ids = (
        WorkflowRun.objects.values_list("partition_id", flat=True).distinct()
    )

    for partition_id in partition_ids:
        rows = list(
            WorkflowRun.objects.filter(partition_id=partition_id).order_by(
                "-started_at"
            )
        )
        if not rows:
            continue

        canonical = rows[0]

        merged_parameters = dict(canonical.parameters or {})
        merged_datasets = dict(canonical.datasets or {})
        visualization = (canonical.result or {}).get("visualization")
        merged_tags = dict(canonical.tags or {})

        for row in rows:
            params = row.parameters or {}
            if "selected_skus" not in merged_parameters and "selected_skus" in params:
                merged_parameters["selected_skus"] = params["selected_skus"]
            if not merged_datasets and row.datasets:
                merged_datasets = dict(row.datasets)
            if visualization is None:
                visualization = (row.result or {}).get("visualization")
            tags = row.tags or {}
            for key in ("task_id", "parameter_signature", "parameter_signature_payload"):
                if key not in merged_tags and key in tags:
                    merged_tags[key] = tags[key]

        merged_tags.pop("workflow_type", None)

        canonical.parameters = merged_parameters
        canonical.datasets = merged_datasets
        # Two-key result; partition_tree is reseeded on first access in the new
        # flat {nodes, edges} shape, so drop any legacy nested structure here.
        canonical.result = {"visualization": visualization, "partition_tree": None}
        canonical.tags = merged_tags
        canonical.save(update_fields=["parameters", "datasets", "result", "tags"])

        extra_ids = [row.id for row in rows[1:]]
        if extra_ids:
            WorkflowRun.objects.filter(id__in=extra_ids).delete()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_backfill_sku_selection_workflow_type"),
    ]

    operations = [
        migrations.RunPython(unify_workflow_rows, noop_reverse),
    ]
