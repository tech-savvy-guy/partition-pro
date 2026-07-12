import csv
import io
import json
from dataclasses import dataclass
from typing import Iterable
from uuid import uuid4

from django.db import connection, transaction

from core.models import Dataset
from core.services.storage import get_blob_client


class DatasetIngestionError(Exception):
    pass


@dataclass(frozen=True)
class DatasetIngestionResult:
    row_count: int
    columns: list[str]


RAW_TABLE_BY_DATASET_TYPE = {
    Dataset.Type.POS: "core.raw_pos_data",
    Dataset.Type.ATTRIBUTES: "core.raw_attributes_data",
    Dataset.Type.CROSS_PURCHASE: "core.raw_cross_purchase_data",
}


def _raw_table_for_dataset(dataset: Dataset) -> str:
    try:
        return RAW_TABLE_BY_DATASET_TYPE[dataset.type]
    except KeyError as exc:
        raise DatasetIngestionError(
            f"Unsupported dataset type for ingestion: {dataset.type}."
        ) from exc


def _decode_blob_text(dataset: Dataset) -> str:
    try:
        payload = get_blob_client(dataset.blob_name).download_blob().readall()
    except Exception as exc:
        raise DatasetIngestionError("Could not download dataset blob.") from exc

    try:
        return payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DatasetIngestionError("Dataset file must be UTF-8 encoded CSV.") from exc


def _iter_csv_rows(text: str) -> tuple[list[str], Iterable[tuple[int, dict]]]:
    stream = io.StringIO(text, newline="")
    reader = csv.DictReader(stream)
    if not reader.fieldnames:
        raise DatasetIngestionError("Dataset CSV must include a header row.")

    columns = [str(col or "").strip() for col in reader.fieldnames]
    if any(not col for col in columns):
        raise DatasetIngestionError("Dataset CSV contains an empty column name.")
    if len(set(columns)) != len(columns):
        raise DatasetIngestionError("Dataset CSV contains duplicate column names.")

    def rows():
        for row_num, row in enumerate(reader, start=1):
            if None in row:
                raise DatasetIngestionError(
                    f"Dataset CSV row {row_num} has more values than headers."
                )
            yield row_num, {column: row.get(column) for column in columns}

    return columns, rows()


def _copy_rows_to_temp(rows: Iterable[tuple[int, dict]]) -> int:
    row_count = 0
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")

    with connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS raw_dataset_rows_ingest")
        cursor.execute(
            """
            CREATE TEMP TABLE raw_dataset_rows_ingest (
                id uuid NOT NULL,
                row_num bigint NOT NULL,
                data jsonb NOT NULL
            ) ON COMMIT DROP
            """
        )

        raw_cursor = getattr(cursor, "cursor", cursor)
        with raw_cursor.copy(
            "COPY raw_dataset_rows_ingest (id, row_num, data) FROM STDIN WITH (FORMAT csv)"
        ) as copy:
            for row_num, row_data in rows:
                writer.writerow(
                    [
                        str(uuid4()),
                        row_num,
                        json.dumps(row_data, ensure_ascii=False, default=str),
                    ]
                )
                row_count += 1

                if row_count % 5000 == 0:
                    copy.write(buffer.getvalue())
                    buffer.seek(0)
                    buffer.truncate(0)

            if buffer.tell():
                copy.write(buffer.getvalue())

    if row_count == 0:
        raise DatasetIngestionError("Dataset CSV does not contain any data rows.")
    return row_count


def ingest_dataset(dataset: Dataset) -> DatasetIngestionResult:
    try:
        raw_table = _raw_table_for_dataset(dataset)
        text = _decode_blob_text(dataset)
        columns, rows = _iter_csv_rows(text)

        with transaction.atomic():
            row_count = _copy_rows_to_temp(rows)

            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    DELETE FROM {raw_table}
                    WHERE case_id = %s
                    """,
                    [str(dataset.case_id)],
                )
                cursor.execute(
                    f"""
                    INSERT INTO {raw_table}
                        (id, metadata_id, case_id, version, data, tags, row_num)
                    SELECT
                        id,
                        %s::uuid,
                        %s::uuid,
                        %s,
                        data,
                        '{{}}'::jsonb,
                        row_num
                    FROM raw_dataset_rows_ingest
                    ORDER BY row_num
                    """,
                    [
                        str(dataset.id),
                        str(dataset.case_id),
                        dataset.version,
                    ],
                )

            Dataset.objects.filter(
                case_id=dataset.case_id,
                type=dataset.type,
                is_deleted=False,
            ).exclude(id=dataset.id).update(is_selected=False)

            tags = dict(dataset.tags or {})
            tags["columns_order"] = columns
            tags["ingested_rows"] = row_count
            tags.pop("error_message", None)

            Dataset.objects.filter(id=dataset.id).update(
                is_selected=True,
                status=Dataset.Status.READY,
                tags=tags,
            )

        dataset.refresh_from_db()
        return DatasetIngestionResult(row_count=row_count, columns=columns)
    except Exception as exc:
        message = str(exc) if isinstance(exc, DatasetIngestionError) else "Could not ingest dataset rows."
        _mark_ingestion_failed(dataset, message)
        if isinstance(exc, DatasetIngestionError):
            raise
        raise DatasetIngestionError(message) from exc


def _mark_ingestion_failed(dataset: Dataset, message: str) -> None:
    tags = dict(dataset.tags or {})
    tags["error_message"] = message
    Dataset.objects.filter(id=dataset.id).update(
        is_selected=True,
        status=Dataset.Status.FAILED,
        tags=tags,
    )
    Dataset.objects.filter(
        case_id=dataset.case_id,
        type=dataset.type,
        is_deleted=False,
    ).exclude(id=dataset.id).update(is_selected=False)
    dataset.refresh_from_db()
