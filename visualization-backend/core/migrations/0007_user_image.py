from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_remove_user_display_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="image",
            field=models.TextField(blank=True),
        ),
    ]
