from enum import Enum


class Role(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class Permission(str, Enum):
    VIEW_USERS = "users.view"
    CREATE_USERS = "users.create"
    EDIT_USERS = "users.edit"
    DELETE_USERS = "users.delete"

    VIEW_DASHBOARDS = "dashboards.view"

    VIEW_CASES = "cases.view"
    CREATE_CASES = "cases.create"

    VIEW_PARTITIONS = "partitions.view"
    CREATE_PARTITIONS = "partitions.create"

    VIEW_DATASETS = "datasets.view"
    EDIT_DATASETS = "datasets.edit"

    VIEW_FILES = "files.view"
    UPLOAD_FILES = "files.upload"
    DOWNLOAD_FILES = "files.download"
    DELETE_FILES = "files.delete"

    VIEW_SETTINGS = "settings.view"
    EDIT_SETTINGS = "settings.edit"

    VIEW_AUDIT = "audit.view"
    VIEW_ADMIN = "admin.view"


ROLE_CHOICES = [(role.value, role.value) for role in Role]
DEFAULT_ROLE = Role.EDITOR.value

VIEWER_PERMISSIONS = frozenset(
    {
        Permission.VIEW_DASHBOARDS,
        Permission.VIEW_CASES,
        Permission.VIEW_PARTITIONS,
        Permission.VIEW_DATASETS,
        Permission.VIEW_FILES,
        Permission.DOWNLOAD_FILES,
    }
)

EDITOR_PERMISSIONS = VIEWER_PERMISSIONS | frozenset(
    {
        Permission.EDIT_DATASETS,
        Permission.CREATE_CASES,
        Permission.UPLOAD_FILES,
        Permission.DELETE_FILES,
    }
)

ADMIN_PERMISSIONS = EDITOR_PERMISSIONS | frozenset(
    {
        Permission.VIEW_USERS,
        Permission.CREATE_USERS,
        Permission.EDIT_USERS,
        Permission.VIEW_SETTINGS,
        Permission.EDIT_SETTINGS,
        Permission.VIEW_AUDIT,
        Permission.VIEW_ADMIN,
        Permission.CREATE_PARTITIONS,
    }
)

OWNER_PERMISSIONS = frozenset(Permission)

ROLE_PERMISSIONS = {
    Role.VIEWER.value: VIEWER_PERMISSIONS,
    Role.EDITOR.value: EDITOR_PERMISSIONS,
    Role.ADMIN.value: ADMIN_PERMISSIONS,
    Role.OWNER.value: OWNER_PERMISSIONS,
}


def normalize_role(role):
    if role == "user":
        return Role.EDITOR.value
    if role in ROLE_PERMISSIONS:
        return role
    return Role.VIEWER.value


def get_permissions_for_role(role):
    normalized_role = normalize_role(role)
    return tuple(permission.value for permission in ROLE_PERMISSIONS[normalized_role])


def user_has_permission(user, permission):
    if user is None:
        return False
    return permission in get_permissions_for_role(getattr(user, "role", None))


def user_has_any_permission(user, permissions):
    return any(user_has_permission(user, permission) for permission in permissions)


def user_has_all_permissions(user, permissions):
    return all(user_has_permission(user, permission) for permission in permissions)
