"""Microsoft Graph profile enrichment for authenticated Entra users."""
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class GraphProfileError(Exception):
    """Raised when Graph profile enrichment fails."""


class GraphPhotoNotFound(Exception):
    """Raised when the authenticated Graph user has no profile photo."""


def fetch_graph_profile(user_assertion):
    """Return selected /me profile fields using OAuth OBO.

    The API access token proves the user authenticated to this backend. When the
    API app also has a client secret, the backend can exchange that token for a
    Microsoft Graph token and read profile fields that are not present in access
    tokens, such as jobTitle and department.
    """
    logger.info("Requesting Microsoft Graph token with OAuth OBO.")
    graph_token = _exchange_on_behalf_of(user_assertion)
    logger.info("Calling Microsoft Graph /me profile endpoint.")
    return _get_me(graph_token)


def fetch_graph_photo(user_assertion):
    """Return the authenticated user's Graph photo bytes and content type."""
    graph_token = _exchange_on_behalf_of(user_assertion)
    request = Request(
        f"{settings.MS_GRAPH_ME_URL}/photo/$value",
        headers={
            "Authorization": f"Bearer {graph_token}",
            "Accept": "image/*",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=5) as response:
            return response.read(), response.headers.get_content_type()
    except HTTPError as exc:
        if exc.code == 404:
            raise GraphPhotoNotFound("The authenticated user has no profile photo.")

        detail = exc.read().decode("utf-8", errors="replace")
        raise GraphProfileError(f"Graph photo request failed with {exc.code}: {detail}")
    except (OSError, URLError) as exc:
        raise GraphProfileError(f"Graph photo request failed: {exc}")


def _exchange_on_behalf_of(user_assertion):
    data = urlencode(
        {
            "client_id": settings.ENTRA_CLIENT_ID,
            "client_secret": settings.ENTRA_CLIENT_SECRET,
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "requested_token_use": "on_behalf_of",
            "assertion": user_assertion,
            "scope": settings.MS_GRAPH_USER_SCOPE,
        }
    ).encode("utf-8")
    request = Request(
        settings.MS_GRAPH_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    body = _read_json(request)
    access_token = body.get("access_token")

    if not access_token:
        raise GraphProfileError("Graph token response did not include access_token.")

    return access_token


def _get_me(graph_token):
    fields = ",".join(settings.MS_GRAPH_PROFILE_FIELDS)
    request = Request(
        f"{settings.MS_GRAPH_ME_URL}?$select={fields}",
        headers={
            "Authorization": f"Bearer {graph_token}",
            "Accept": "application/json",
        },
        method="GET",
    )
    return _read_json(request)


def _read_json(request):
    try:
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise GraphProfileError(f"Graph request failed with {exc.code}: {detail}")
    except (OSError, URLError, json.JSONDecodeError) as exc:
        raise GraphProfileError(f"Graph request failed: {exc}")
