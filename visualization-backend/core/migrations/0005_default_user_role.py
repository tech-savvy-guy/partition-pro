from django.db import migrations, models


def backfill_blank_roles(apps, schema_editor):
    User = apps.get_model("core", "User")
    User.objects.filter(role="").update(role="user")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_remove_redundant_user_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_blank_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(default="user", max_length=32),
        ),
    ]
