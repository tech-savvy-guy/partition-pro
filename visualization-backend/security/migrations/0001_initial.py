from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("core", "0006_remove_user_display_name"),
    ]

    operations = [
        migrations.RunSQL(
            sql='CREATE SCHEMA IF NOT EXISTS "security"',
            reverse_sql='DROP SCHEMA IF EXISTS "security" CASCADE',
        ),
        migrations.CreateModel(
            name="RefreshToken",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("jti_hash", models.CharField(db_index=True, max_length=64, unique=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
                ("revoked_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                (
                    "created_at",
                    models.DateTimeField(default=django.utils.timezone.now, editable=False),
                ),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="refresh_tokens",
                        to="core.user",
                    ),
                ),
            ],
            options={
                "db_table": '"security"."refresh_token"',
            },
        ),
        migrations.AddIndex(
            model_name="refreshtoken",
            index=models.Index(
                fields=["user", "revoked_at"],
                name="refresh_tok_user_id_f34c91_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="refreshtoken",
            index=models.Index(fields=["expires_at"], name="refresh_tok_expires_3ecf55_idx"),
        ),
    ]
