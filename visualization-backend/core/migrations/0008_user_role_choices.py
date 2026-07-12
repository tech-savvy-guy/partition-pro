from django.db import migrations, models


def migrate_user_role_to_editor(apps, schema_editor):
    User = apps.get_model("core", "User")
    User.objects.filter(role="user").update(role="editor")
    User.objects.filter(role="").update(role="editor")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_user_image"),
    ]

    operations = [
        migrations.RunPython(migrate_user_role_to_editor, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "owner"),
                    ("admin", "admin"),
                    ("editor", "editor"),
                    ("viewer", "viewer"),
                ],
                default="editor",
                max_length=32,
            ),
        ),
    ]
