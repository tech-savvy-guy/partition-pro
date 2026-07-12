import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    is_deleted = models.BooleanField(default=False)
    created_on = models.DateTimeField()
    created_by = models.TextField()
    updated_on = models.DateTimeField(null=True, blank=True)
    updated_by = models.TextField(null=True, blank=True)

    role_name = models.TextField()
    permissions = models.JSONField(default=dict)

    is_super_user = models.BooleanField(default=False)
    is_super_admin = models.BooleanField(default=False)
    tags = models.JSONField(default=dict)

    class Meta:
        db_table = "roles"
        managed = True

    def __str__(self):
        return self.role_name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = self.normalize_email(email)
        extra_fields.setdefault("is_active", True)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # hashes password
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_deleted", False)
        extra_fields.setdefault("is_locked", False)
        extra_fields.setdefault("invalid_attempts", 0)

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    is_deleted = models.BooleanField(default=False)
    created_on = models.DateTimeField()
    created_by = models.TextField()
    updated_on = models.DateTimeField(null=True, blank=True)
    updated_by = models.TextField(null=True, blank=True)

    username = models.TextField(unique=True)
    email = models.TextField(unique=True)
    name = models.TextField()

    # IMPORTANT: reference Role **class**, not string
    role = models.ForeignKey(Role, on_delete=models.PROTECT)

    designation = models.TextField(null=True, blank=True)
    tenant_id = models.UUIDField()
    company = models.TextField(null=True, blank=True)

    # password field comes from AbstractBaseUser → stored in column "password"
    is_active = models.BooleanField(default=False)
    invalid_attempts = models.IntegerField(default=0)
    tfa_secret = models.TextField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    password_created_on = models.DateTimeField(null=True, blank=True)
    login_time = models.DateTimeField(null=True, blank=True)
    logout_time = models.DateTimeField(null=True, blank=True)

    tags = models.JSONField(default=dict)
    session_id = models.UUIDField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "name", "role"]

    objects = UserManager()

    class Meta:
        db_table = "users"
        managed = True

    def __str__(self):
        return self.email

