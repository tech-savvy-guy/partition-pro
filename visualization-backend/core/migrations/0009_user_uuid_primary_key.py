import uuid

from django.db import migrations, models


FORWARD_SQL = r"""
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "security"."refresh_token"
    DROP CONSTRAINT IF EXISTS "refresh_token_user_id_1d7a63ac_fk_user_id";

DROP INDEX IF EXISTS "security"."refresh_tok_user_id_f34c91_idx";
DROP INDEX IF EXISTS "security"."refresh_token_user_id_1d7a63ac";

ALTER TABLE "core"."user"
    ADD COLUMN "uuid_id" uuid DEFAULT gen_random_uuid();
ALTER TABLE "core"."user"
    ALTER COLUMN "uuid_id" SET NOT NULL;

ALTER TABLE "security"."refresh_token"
    ADD COLUMN "user_uuid" uuid;

UPDATE "security"."refresh_token" refresh_token
SET "user_uuid" = core_user."uuid_id"
FROM "core"."user" core_user
WHERE refresh_token."user_id" = core_user."id";

ALTER TABLE "security"."refresh_token"
    ALTER COLUMN "user_uuid" SET NOT NULL;
ALTER TABLE "security"."refresh_token"
    DROP COLUMN "user_id";
ALTER TABLE "security"."refresh_token"
    RENAME COLUMN "user_uuid" TO "user_id";

ALTER TABLE "core"."user"
    DROP CONSTRAINT "user_pkey";
ALTER TABLE "core"."user"
    DROP COLUMN "id";
ALTER TABLE "core"."user"
    RENAME COLUMN "uuid_id" TO "id";
ALTER TABLE "core"."user"
    ADD PRIMARY KEY ("id");
ALTER TABLE "core"."user"
    ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "security"."refresh_token"
    ADD CONSTRAINT "refresh_token_user_id_1d7a63ac_fk_user_id"
    FOREIGN KEY ("user_id")
    REFERENCES "core"."user" ("id")
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX "refresh_tok_user_id_f34c91_idx"
    ON "security"."refresh_token" ("user_id", "revoked_at");
CREATE INDEX "refresh_token_user_id_1d7a63ac"
    ON "security"."refresh_token" ("user_id");
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_user_role_choices"),
        ("security", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(FORWARD_SQL),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="user",
                    name="id",
                    field=models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
            ],
        ),
    ]
