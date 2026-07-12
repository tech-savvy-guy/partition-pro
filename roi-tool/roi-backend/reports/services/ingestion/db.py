import csv
import io
import json
import pandas as pd
# from psycopg2.extras import execute_values
from django.db import connection, transaction
from django.utils import timezone

from .errors import IngestionDataError, coerce_ingestion_error


def _normalize_column_index(columns) -> pd.Index:
    return pd.Index([str(col) for col in columns]).str.replace(
        r"[\u200b\u200c\u200d\uFEFF]", "", regex=True
    )


def get_raw_table_for_type(data_type: str) -> str:
    if data_type == "POS":
        return "core.raw_pos_data"
    if data_type == "ATTRIBUTES":
        return "core.raw_attributes_data"
    if data_type == "CROSSPURCHASE":
        return "core.raw_cross_purchase_data"
    raise IngestionDataError(
        message=f"Unsupported dataset type '{data_type}'",
        data_type=data_type,
        hint="Use one of POS, ATTRIBUTES, or CROSSPURCHASE.",
    )


def get_processed_table_for_type(data_type: str) -> str:
    if data_type == "BASEMATH":
        return "core.preprocessed_base_math"
    if data_type == "SKUSELECTION":
        return "core.preprocessed_sku_selection"
    raise IngestionDataError(
        message=f"Unsupported processed dataset type '{data_type}'",
        data_type=data_type,
        hint="Use one of BASEMATH or SKUSELECTION.",
    )

def _copy_csv(copy_sql: str, text: str) -> None:
    with connection.cursor() as cur:
        raw_cur = getattr(cur, "cursor", cur)
        with raw_cur.copy(copy_sql) as cp:
            cp.write(text)


def _normalize_batch_range(first_row_num, last_row_num) -> int | str | None:
    if first_row_num is None:
        return None
    if last_row_num is None or last_row_num == first_row_num:
        return first_row_num
    return f"{first_row_num}-{last_row_num}"


def _copy_batch_or_raise(
    *,
    copy_sql: str,
    text: str,
    data_type: str,
    metadata_id: str | None,
    first_row_num,
    last_row_num,
    hint: str,
) -> None:
    try:
        _copy_csv(copy_sql, text)
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Unable to store the uploaded rows in the database.",
            data_type=data_type,
            metadata_id=metadata_id,
            row_num=_normalize_batch_range(first_row_num, last_row_num),
            hint=hint,
        ) from exc

def bulk_insert_raw_rows(data_type: str, case_id: str, dataset_id: str, version: int, rows_iter, batch_size: int = 5000):
    full_table = get_raw_table_for_type(data_type)
    schema, table = full_table.split(".", 1)

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    copy_sql = (
        f'COPY "{schema}"."{table}" (metadata_id, case_id, version, row_num, data) '
        "FROM STDIN WITH (FORMAT csv)"
    )

    n = 0
    batch_start_row_num = None
    batch_end_row_num = None
    for row in rows_iter:
        batch_start_row_num = row["row_num"] if batch_start_row_num is None else batch_start_row_num
        batch_end_row_num = row["row_num"]
        writer.writerow([dataset_id, case_id, version,row["row_num"], row["data"]])
        n += 1
        if n >= batch_size:
            _copy_batch_or_raise(
                copy_sql=copy_sql,
                text=buf.getvalue(),
                data_type=data_type,
                metadata_id=dataset_id,
                first_row_num=batch_start_row_num,
                last_row_num=batch_end_row_num,
                hint="Check the row values and make sure they match the expected columns and data types.",
            )
            buf.seek(0);
            buf.truncate(0)
            n = 0
            batch_start_row_num = None
            batch_end_row_num = None

    if n:
        _copy_batch_or_raise(
            copy_sql=copy_sql,
            text=buf.getvalue(),
            data_type=data_type,
            metadata_id=dataset_id,
            first_row_num=batch_start_row_num,
            last_row_num=batch_end_row_num,
            hint="Check the row values and make sure they match the expected columns and data types.",
        )


def bulk_insert_processed_rows(data_type: str, case_id: str, p_metadata_id: str, rows_iter, batch_size: int = 5000):
    full_table = get_processed_table_for_type(data_type)
    schema, table = full_table.split(".", 1)

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    copy_sql = (
        f'COPY "{schema}"."{table}" (pp_metadata_id, case_id, row_num, data) '
        "FROM STDIN WITH (FORMAT csv)"
    )

    n = 0
    batch_start_row_num = None
    batch_end_row_num = None
    for row in rows_iter:
        batch_start_row_num = row["row_num"] if batch_start_row_num is None else batch_start_row_num
        batch_end_row_num = row["row_num"]
        writer.writerow([p_metadata_id, case_id, row["row_num"], row["data"]])
        n += 1

        if n >= batch_size:
            _copy_batch_or_raise(
                copy_sql=copy_sql,
                text=buf.getvalue(),
                data_type=data_type,
                metadata_id=p_metadata_id,
                first_row_num=batch_start_row_num,
                last_row_num=batch_end_row_num,
                hint="Review the generated preprocessing values for invalid or missing data.",
            )
            buf.seek(0)
            buf.truncate(0)
            n = 0
            batch_start_row_num = None
            batch_end_row_num = None

    if n:
        _copy_batch_or_raise(
            copy_sql=copy_sql,
            text=buf.getvalue(),
            data_type=data_type,
            metadata_id=p_metadata_id,
            first_row_num=batch_start_row_num,
            last_row_num=batch_end_row_num,
            hint="Review the generated preprocessing values for invalid or missing data.",
        )


def load_table_with_jsonb(schema: str, table_name: str, json_column: str = "data", extra_where: str | None = None,metadata_id: str | None = None,
    data_type: str | None = None, include_row_num: bool = False,) -> pd.DataFrame:
    fq = f'{schema}.{table_name}'
    where = f"WHERE {extra_where}" if extra_where else ""
    select_cols = f"row_num, {json_column}" if include_row_num else json_column
    q = f"SELECT {select_cols} FROM {fq} {where} ORDER BY row_num ASC"
    try:
        df = pd.read_sql(q, connection)
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Unable to read the ingested data from the database.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Retry the upload. If the problem persists, verify the dataset was uploaded successfully.",
        ) from exc

    try:
        df[json_column] = df[json_column].apply(
            lambda x: x if isinstance(x, dict) else json.loads(x) if pd.notna(x) else {}
        )
        expanded = pd.json_normalize(df[json_column])
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Stored dataset rows could not be parsed.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Check the uploaded file for malformed JSON-like values or broken row content.",
        ) from exc
    expanded.columns = _normalize_column_index(expanded.columns)
    if include_row_num and "row_num" in df.columns:
        expanded.insert(0, "_source_row_num", df["row_num"].tolist())

    # Apply CSV column order from dataset_metadata.tags if provided
    if metadata_id and data_type:
        metadata_table = "core.partition_dataset_metadata" if data_type == "GROUPING" else "core.dataset_metadata"
        try:
            with connection.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT tags->'columns_order'->%s
                    FROM {metadata_table}
                    WHERE id = %s
                    """,
                    [data_type, metadata_id],
                )
                row = cur.fetchone()
        except Exception as exc:
            raise coerce_ingestion_error(
                exc,
                message="Unable to read dataset column metadata.",
                data_type=data_type,
                metadata_id=metadata_id,
                hint="Retry the upload. If the problem persists, upload the file again.",
            ) from exc
        val = row[0] if row else None
        if isinstance(val, list):
            col_order = val
        elif isinstance(val, str):
            col_order = json.loads(val)
        else:
            col_order = None
        if col_order:
            ordered = [c for c in col_order if c in expanded.columns]
            extras = [c for c in expanded.columns if c not in ordered]
            expanded = expanded.reindex(columns=ordered + extras)
    return expanded


def get_latest_datset_ids(case_id: str) -> dict:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT jsonb_object_agg(data_type, id)
            FROM core.dataset_metadata
            WHERE is_selected = TRUE AND case_id=%s
              AND data_type IN ('CROSSPURCHASE', 'POS', 'ATTRIBUTES')
            """,
            [case_id],
        )
        (obj,) = cur.fetchone()
    return json.loads(obj) or {}


def create_preprocessed_metadata(case_id: str, cp_dataset_id: str, pos_dataset_id: str, att_dataset_id: str) -> str:
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO core.preprocessed_metadata(created_on, case_id, att_dataset_id, pos_dataset_id, cp_dataset_id, version)
            VALUES (NOW(), %s, %s, %s, %s,
                (SELECT COALESCE(MAX(version), 0) + 1 FROM core.preprocessed_metadata WHERE case_id = %s)
            )
            RETURNING id
            """,
            [case_id, att_dataset_id, pos_dataset_id, cp_dataset_id, case_id],
        )
        (new_id,) = cur.fetchone()
    return str(new_id)

def upsert_columns_order_in_dataset_tags(dataset_id: str, data_type: str, columns: list[str]):
    """
    Stores column order in dataset metadata table tags as:
      tags['columns_order'][data_type] = columns
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            UPDATE core.dataset_metadata
            SET tags =
                COALESCE(tags, '{}'::jsonb)
                || jsonb_build_object(
                    'columns_order',
                    COALESCE(tags->'columns_order', '{}'::jsonb)
                    || jsonb_build_object(%s, to_jsonb(%s::text[]))
                )
            WHERE id = %s
            """,
            [data_type, columns, dataset_id],
        )

def upsert_columns_order_in_preprocessed_tags(pp_id: str, data_type: str, new_cols: list[str]) -> None:
    """
    tags['columns_order'][data_type] = existing_cols + (new cols not already present)
    Preserves order and avoids overwriting.
    """
    with transaction.atomic():
        with connection.cursor() as cur:
            cur.execute(
                "SELECT tags FROM core.preprocessed_metadata WHERE id = %s FOR UPDATE",
                [pp_id],
            )
            row = cur.fetchone()
            tags = json.loads(row[0]) if row and row[0] else {}

            columns_order = tags.get("columns_order") or {}
            existing = columns_order.get(data_type) or []

            seen = set(existing)
            merged = list(existing)
            for c in new_cols:
                if c not in seen:
                    merged.append(c)
                    seen.add(c)

            columns_order[data_type] = merged
            tags["columns_order"] = columns_order

            # ensure jsonb, even if driver treats dict oddly
            cur.execute(
                "UPDATE core.preprocessed_metadata SET tags = %s::jsonb WHERE id = %s",
                [json.dumps(tags, ensure_ascii=False), pp_id],
            )

def bulk_insert_raw_grouping_rows(partition_id: str, case_id: str, metadata_id: str, rows_iter, batch_size: int = 5000):
    """
    COPY insert into core.raw_grouping_data with partition_id.
    Columns: metadata_id, case_id, partition_id, row_num, data
    """
    schema = "core"
    table = "raw_grouping_data"

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    copy_sql = (
        f'COPY "{schema}"."{table}" (metadata_id, case_id, partition_id, row_num, data) '
        "FROM STDIN WITH (FORMAT csv)"
    )

    n = 0
    batch_start_row_num = None
    batch_end_row_num = None
    for row in rows_iter:
        batch_start_row_num = row["row_num"] if batch_start_row_num is None else batch_start_row_num
        batch_end_row_num = row["row_num"]
        writer.writerow([metadata_id, case_id, partition_id, row["row_num"], row["data"]])
        n += 1

        if n >= batch_size:
            _copy_batch_or_raise(
                copy_sql=copy_sql,
                text=buf.getvalue(),
                data_type="GROUPING",
                metadata_id=metadata_id,
                first_row_num=batch_start_row_num,
                last_row_num=batch_end_row_num,
                hint="Make sure each GROUPING row matches the header columns and expected values.",
            )
            buf.seek(0)
            buf.truncate(0)
            n = 0
            batch_start_row_num = None
            batch_end_row_num = None

    if n:
        _copy_batch_or_raise(
            copy_sql=copy_sql,
            text=buf.getvalue(),
            data_type="GROUPING",
            metadata_id=metadata_id,
            first_row_num=batch_start_row_num,
            last_row_num=batch_end_row_num,
            hint="Make sure each GROUPING row matches the header columns and expected values.",
        )

def upsert_columns_order_in_partition_dataset_tags(metadata_id: str, data_type: str, columns: list[str]):
    """
    Store CSV header order in PartitionDatasetMetadata.tags as:
      tags['columns_order'][data_type] = columns
    """
    with connection.cursor() as cur:
        cur.execute(
            """
            UPDATE core.partition_dataset_metadata
            SET tags =
                COALESCE(tags, '{}'::jsonb)
                || jsonb_build_object(
                    'columns_order',
                    COALESCE(tags->'columns_order', '{}'::jsonb)
                    || jsonb_build_object(%s, to_jsonb(%s::text[]))
                )
            WHERE id = %s
            """,
            [data_type, columns, metadata_id],
        )

def bulk_insert_working_attributes_rows(
    grouping_metadata_id: str,
    case_id: str,
    partition_id: str,
    rows_iter,
    batch_size: int = 5000
) -> None:
    """
    Bulk insert rows into core.working_attributes_data via PostgreSQL COPY.

    Expects rows_iter to yield dict with:
        - row_num (int)
        - data (dict)
        - tags (dict, optional)
    """

    full_table = "core.working_attributes_data"
    schema, table = full_table.split(".", 1)

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    n = 0
    batch_start_row_num = None
    batch_end_row_num = None
    for row in rows_iter:
        row_num = row.get("row_num", n + 1)
        batch_start_row_num = row_num if batch_start_row_num is None else batch_start_row_num
        batch_end_row_num = row_num
        data = row.get("data", {})
        tags = row.get("tags", {})

        # Ensure proper JSON serialization
        data_json = json.dumps(data, ensure_ascii=False, default=str) if isinstance(data, dict) else str(data)
        tags_json = json.dumps(tags, ensure_ascii=False, default=str) if isinstance(tags, dict) else str(tags)

        writer.writerow([
            grouping_metadata_id,
            case_id,
            partition_id,
            1,          # version (always 1)
            row_num,
            data_json,
            tags_json,
        ])

        n += 1
        if n >= batch_size:
            copy_sql = (
                f'COPY "{schema}"."{table}" '
                f'(grouping_metadata_id, case_id, partition_id, version, row_num, data, tags) '
                "FROM STDIN WITH (FORMAT csv)"
            )
            _copy_batch_or_raise(
                copy_sql=copy_sql,
                text=buf.getvalue(),
                data_type="WORKING_ATTRIBUTES",
                metadata_id=grouping_metadata_id,
                first_row_num=batch_start_row_num,
                last_row_num=batch_end_row_num,
                hint="Check the merged ATTRIBUTES and GROUPING data for invalid values.",
            )
            buf.seek(0)
            buf.truncate(0)
            n = 0
            batch_start_row_num = None
            batch_end_row_num = None

    if n > 0:
        copy_sql = (
            f'COPY "{schema}"."{table}" '
            f'(grouping_metadata_id, case_id, partition_id, version, row_num, data, tags) '
            "FROM STDIN WITH (FORMAT csv)"
        )
        _copy_batch_or_raise(
            copy_sql=copy_sql,
            text=buf.getvalue(),
            data_type="WORKING_ATTRIBUTES",
            metadata_id=grouping_metadata_id,
            first_row_num=batch_start_row_num,
            last_row_num=batch_end_row_num,
            hint="Check the merged ATTRIBUTES and GROUPING data for invalid values.",
        )
