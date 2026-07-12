import base64
import logging

from security.auth import EntraIDAuthentication
from security.graph import GraphPhotoNotFound, GraphProfileError, fetch_graph_photo
from security.rbac import normalize_role

logger = logging.getLogger(__name__)


def get_display_name(user):
    name = " ".join(part for part in (user.first_name, user.last_name) if part).strip()
    return name or user.email


def get_image_data_url(request):
    cached_image = getattr(request.user, "image", "")
    if cached_image:
        return cached_image

    if (request.auth or {}).get("typ") == "access":
        return None

    token = EntraIDAuthentication()._get_bearer_token(request)
    if not token:
        return None

    try:
        photo, content_type = fetch_graph_photo(token)
    except GraphPhotoNotFound:
        return None
    except GraphProfileError as exc:
        logger.warning("Microsoft Graph profile photo lookup failed: %s", exc)
        return None

    encoded_photo = base64.b64encode(photo).decode("ascii")
    return f"data:{content_type};base64,{encoded_photo}"


def serialize_user_summary(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": get_display_name(user),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "job_title": user.job_title,
        "department": user.department,
        "role": normalize_role(user.role),
        "image": user.image if user.image else None,
    }
