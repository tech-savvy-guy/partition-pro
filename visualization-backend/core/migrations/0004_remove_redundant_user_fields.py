from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_lowercase_user_emails"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="user_principal_name",
        ),
        migrations.RemoveField(
            model_name="user",
            name="given_name",
        ),
        migrations.RemoveField(
            model_name="user",
            name="family_name",
        ),
        migrations.RemoveField(
            model_name="user",
            name="last_scopes",
        ),
        migrations.RemoveField(
            model_name="user",
            name="last_roles",
        ),
        migrations.RemoveField(
            model_name="user",
            name="last_claims",
        ),
    ]
