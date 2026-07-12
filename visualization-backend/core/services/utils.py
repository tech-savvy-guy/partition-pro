import uuid

from django.utils.dateparse import parse_datetime


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def dedupe(values):
    return list(dict.fromkeys(values))


def is_valid_uuid(value):
    try:
        uuid.UUID(str(value))
    except (TypeError, ValueError):
        return False
    return True


def parse_positive_int(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def parse_optional_datetime(value):
    cleaned = clean_text(value)
    if not cleaned:
        return None
    return parse_datetime(cleaned)
