from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_default_user_role"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="display_name",
        ),
    ]
