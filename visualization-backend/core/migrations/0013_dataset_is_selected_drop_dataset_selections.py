from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_normalize_model_fields_and_tables"),
    ]

    operations = [
        migrations.AddField(
            model_name="dataset",
            name="is_selected",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.DeleteModel(
            name="PartitionDatasetSelection",
        ),
    ]
