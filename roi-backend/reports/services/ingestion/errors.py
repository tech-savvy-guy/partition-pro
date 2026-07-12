from __future__ import annotations

from dataclasses import dataclass


def _format_row_label(row_num: int | str | None) -> str | None:
    if row_num is None:
        return None
    row_text = str(row_num).strip()
    if not row_text:
        return None
    if "-" in row_text:
        return f"rows {row_text}"
    return f"row {row_text}"


@dataclass
class IngestionDataError(Exception):
    message: str
    data_type: str | None = None
    metadata_id: str | None = None
    row_num: int | str | None = None
    column_name: str | None = None
    hint: str | None = None
    cause: Exception | None = None

    def __post_init__(self) -> None:
        super().__init__(self.message)

    def with_defaults(self, **defaults) -> "IngestionDataError":
        return IngestionDataError(
            message=self.message,
            data_type=self.data_type or defaults.get("data_type"),
            metadata_id=self.metadata_id or defaults.get("metadata_id"),
            row_num=self.row_num if self.row_num is not None else defaults.get("row_num"),
            column_name=self.column_name or defaults.get("column_name"),
            hint=self.hint or defaults.get("hint"),
            cause=self.cause,
        )

    def to_user_message(self) -> str:
        return format_ingestion_error(self)

    def __str__(self) -> str:
        return self.to_user_message()


def format_ingestion_error(error: Exception, *, include_hint: bool = True) -> str:
    if not isinstance(error, IngestionDataError):
        return str(error)

    prefix_parts: list[str] = []
    if error.data_type:
        prefix_parts.append(error.data_type)

    row_label = _format_row_label(error.row_num)
    if row_label:
        prefix_parts.append(row_label)

    if error.column_name:
        prefix_parts.append(f"column '{error.column_name}'")

    if prefix_parts:
        message = f"{' '.join(prefix_parts)}: {error.message}"
    else:
        message = error.message

    if include_hint and error.hint:
        if message.endswith("."):
            message = message[:-1]
        message = f"{message}. Fix: {error.hint}"

    return message


def coerce_ingestion_error(
    error: Exception,
    *,
    message: str,
    data_type: str | None = None,
    metadata_id: str | None = None,
    row_num: int | str | None = None,
    column_name: str | None = None,
    hint: str | None = None,
) -> IngestionDataError:
    if isinstance(error, IngestionDataError):
        return error.with_defaults(
            data_type=data_type,
            metadata_id=metadata_id,
            row_num=row_num,
            column_name=column_name,
            hint=hint,
        )

    return IngestionDataError(
        message=message,
        data_type=data_type,
        metadata_id=metadata_id,
        row_num=row_num,
        column_name=column_name,
        hint=hint,
        cause=error,
    )
