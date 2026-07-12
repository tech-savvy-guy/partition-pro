from django.core.exceptions import ValidationError
from django.db import migrations


def lowercase_user_emails(apps, schema_editor):
    User = apps.get_model("core", "User")
    seen = {}

    for user in User.objects.all().only("id", "email"):
        lowercase_email = user.email.lower()
        existing_id = seen.get(lowercase_email)

        if existing_id is not None:
            raise ValidationError(
                "Cannot lowercase user emails because multiple rows would "
                f"become {lowercase_email!r}: ids {existing_id} and {user.id}."
            )

        seen[lowercase_email] = user.id
        if user.email != lowercase_email:
            user.email = lowercase_email
            user.save(update_fields=["email", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_add_entra_profile_fields"),
    ]

    operations = [
        migrations.RunPython(lowercase_user_emails, migrations.RunPython.noop),
    ]
