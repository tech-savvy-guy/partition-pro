# reports/services/ingestion/ingest.py
import csv
import codecs
import io
import json
import re
from typing import Dict, Any, Iterator
import numpy as np
import pandas as pd
from azure.storage.blob import BlobServiceClient, BlobClient
from azure.identity import DefaultAzureCredential
from django.conf import settings

from .db import (
    bulk_insert_raw_rows,
    bulk_insert_processed_rows,
    load_table_with_jsonb,
    get_latest_datset_ids,
    create_preprocessed_metadata, upsert_columns_order_in_dataset_tags, upsert_columns_order_in_preprocessed_tags,
    bulk_insert_raw_grouping_rows,
    upsert_columns_order_in_partition_dataset_tags,
    bulk_insert_working_attributes_rows
)
from .errors import IngestionDataError, coerce_ingestion_error
from ...models import DatasetMetadata, Partitions, PartitionDatasetMetadata

def _get_blob_client(container_name: str, blob_name: str, sas_token: str | None = None) -> BlobClient:
    """
    Return a BlobClient using Managed Identity (DefaultAzureCredential).
    sas_token parameter kept for backward compatibility but ignored in production.
    Falls back to connection string for local development.
    """
    account_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
    if settings.AZURE_STORAGE_ACCOUNT_NAME and settings.AZURE_STORAGE_ACCOUNT_NAME != 'your-storage-account-name':
        return BlobClient(
            account_url=account_url,
            container_name=container_name,
            blob_name=blob_name,
            credential=DefaultAzureCredential(),
        )
    # Local dev fallback: use connection string
    return BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    ).get_blob_client(container=container_name, blob=blob_name)
    
THOUSANDS_SEPARATOR_NUMBER_PATTERN = re.compile(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$")


def _normalize_column_index(columns) -> pd.Index:
    return pd.Index([str(col) for col in columns]).str.replace(
        r"[\u200b\u200c\u200d\uFEFF]", "", regex=True
    )


class IterToFileObj(io.TextIOBase):
    def __init__(self, iterator):
        self._iterator = iterator
        self._buffer = ""

    def readable(self):
        return True

    def readline(self, size: int = -1) -> str:
        while True:
            newline_idx = self._buffer.find("\n")
            if newline_idx != -1:
                line = self._buffer[: newline_idx + 1]
                self._buffer = self._buffer[newline_idx + 1 :]
                return line
            try:
                chunk = next(self._iterator)
            except StopIteration:
                if self._buffer:
                    line = self._buffer
                    self._buffer = ""
                    return line
                return ""
            self._buffer += chunk

    def read(self, size: int = -1) -> str:
        if size == 0:
            return ""
        pieces, total = [], 0
        while size < 0 or total < size:
            line = self.readline()
            if not line:
                break
            pieces.append(line)
            total += len(line)
        return "".join(pieces)

def _validate_csv_header(
    header: list[str],
    *,
    data_type: str | None,
    metadata_id: str | None,
) -> list[str]:
    if not header:
        raise IngestionDataError(
            message="The uploaded CSV file is empty or missing a header row.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Add a header row as the first line of the CSV file and upload it again.",
        )

    normalized = []
    for index, column in enumerate(header, start=1):
        column_name = "" if column is None else str(column).strip()
        if not column_name:
            raise IngestionDataError(
                message="The header contains an empty column name.",
                data_type=data_type,
                metadata_id=metadata_id,
                column_name=f"column {index}",
                hint="Give every CSV column a non-empty header name.",
            )
        normalized.append(column_name)
    return normalized


def _ensure_required_columns(
    df: pd.DataFrame,
    required_columns: list[str],
    *,
    data_type: str,
    metadata_id: str | None,
) -> None:
    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        missing = ", ".join(f"'{column}'" for column in missing_columns)
        raise IngestionDataError(
            message=f"Missing required column(s) {missing}.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Update the CSV header to include the required columns and upload the file again.",
        )


def _validate_case_level_cell(
    *,
    data_type: str | None,
    metadata_id: str | None,
    row_num: int,
    column_name: str,
    value: str | None,
) -> None:
    if data_type not in {"POS", "CROSSPURCHASE"}:
        return

    if value is None:
        return

    if value == "":
        raise IngestionDataError(
            message="Empty cells are not allowed.",
            data_type=data_type,
            metadata_id=metadata_id,
            row_num=row_num,
            column_name=column_name,
            hint=f"Fill in the '{column_name}' value for every {data_type} row before uploading the file again.",
        )

    if THOUSANDS_SEPARATOR_NUMBER_PATTERN.match(value):
        raise IngestionDataError(
            message=f"Found a number formatted with commas: '{value}'.",
            data_type=data_type,
            metadata_id=metadata_id,
            row_num=row_num,
            column_name=column_name,
            hint=f"Remove commas from '{value}' and use a plain numeric value such as '{value.replace(',', '')}'.",
        )


def _get_source_row_num(df: pd.DataFrame, index) -> int | None:
    if "_source_row_num" not in df.columns:
        return None
    value = df.loc[index, "_source_row_num"]
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_numeric_series(df: pd.DataFrame, column_name: str, *, data_type: str, metadata_id: str | None) -> pd.Series:
    normalized = df[column_name].astype(str).str.replace(",", "", regex=False).str.strip()
    numeric = pd.to_numeric(normalized, errors="coerce")
    invalid_mask = normalized.ne("") & numeric.isna()
    if invalid_mask.any():
        invalid_index = invalid_mask[invalid_mask].index[0]
        row_num = _get_source_row_num(df, invalid_index)
        bad_value = df.loc[invalid_index, column_name]
        raise IngestionDataError(
            message=f"Expected a numeric value but found '{bad_value}'.",
            data_type=data_type,
            metadata_id=metadata_id,
            row_num=row_num,
            column_name=column_name,
            hint=f"Replace '{bad_value}' with a valid number in the '{column_name}' column.",
        )
    return numeric


def _to_numeric_matrix(df: pd.DataFrame, *, data_type: str, metadata_id: str | None) -> np.ndarray:
    numeric_columns = [column for column in df.columns if column != "_source_row_num"]
    matrix_df = pd.DataFrame(
        {
            column_name: _to_numeric_series(
                (
                    df[[column_name, "_source_row_num"]]
                    if "_source_row_num" in df.columns
                    else df[[column_name]]
                ),
                column_name,
                data_type=data_type,
                metadata_id=metadata_id,
            )
            for column_name in numeric_columns
        },
        index=df.index,
    )
    return matrix_df.to_numpy(dtype=float)


def get_csv_header_from_blob(
    container_name: str,
    blob_name: str,
    *,
    data_type: str | None = None,
    metadata_id: str | None = None,
    sas_token: str | None = None,
) -> list[str]:
    try:
        blob_client = _get_blob_client(container_name, blob_name, sas_token)
        prefix = blob_client.download_blob(offset=0, length=65536).readall()
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Unable to read the uploaded CSV file.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Verify that the uploaded file exists and is a readable CSV file.",
        ) from exc

    text = prefix.decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    if not lines:
        raise IngestionDataError(
            message="The uploaded CSV file is empty.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Add a header row and at least one data row before uploading the file again.",
        )

    try:
        header = next(csv.reader([lines[0]]))
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="The CSV header could not be parsed.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Make sure the file is a valid comma-separated CSV with a single header row.",
        ) from exc

    return _validate_csv_header(header, data_type=data_type, metadata_id=metadata_id)


def iter_csv_rows_from_blob(
    container_name: str,
    blob_name: str,
    *,
    data_type: str | None = None,
    metadata_id: str | None = None,
    sas_token: str | None = None,
) -> Iterator[Dict[str, Any]]:
    try:
        blob_client = _get_blob_client(container_name, blob_name, sas_token)
        download_stream = blob_client.download_blob()
        byte_iter = download_stream.chunks()
        text_iter = codecs.iterdecode(byte_iter, "utf-8-sig")

        file_like = IterToFileObj(text_iter)
        reader = csv.DictReader(file_like)
        fieldnames = _validate_csv_header(reader.fieldnames or [], data_type=data_type, metadata_id=metadata_id)
    except IngestionDataError:
        raise
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="The uploaded CSV file could not be read.",
            data_type=data_type,
            metadata_id=metadata_id,
            hint="Make sure the file is a valid UTF-8 CSV file and upload it again.",
        ) from exc

    for i, row in enumerate(reader, start=1):
        if None in row and row[None]:
            raise IngestionDataError(
                message="The row has more values than the header defines.",
                data_type=data_type,
                metadata_id=metadata_id,
                row_num=i,
                hint="Ensure every row has the same number of comma-separated values as the header.",
            )

        cleaned = {}
        for key in fieldnames:
            v = row.get(key)
            cleaned_value = None if v is None else str(v).strip()
            _validate_case_level_cell(
                data_type=data_type,
                metadata_id=metadata_id,
                row_num=i,
                column_name=key,
                value=cleaned_value,
            )
            cleaned[key] = cleaned_value

        if all(v is None or v == "" for v in cleaned.values()):
            continue

        yield {
            "row_num": i,
            "data": json.dumps(cleaned, ensure_ascii=False, sort_keys=False),
        }


def ingest_dataset_task_logic(task: Dict[str, Any]) -> bool:
    is_preprocessed=False
    dataset_id = task.get("dataset_id",None)
    case_id = task.get("case_id",None)
    data_type = task.get("data_type",None)
    version = int(task.get("version",1))
    blob_name = task.get("blob_name",None)
    test = task.get("test", False)

    container_name = "case-data-uploads"

    # 1) Load CSV rows & insert raw table (uncomment if you want to persist raw)
    if dataset_id:


        header = get_csv_header_from_blob(
            container_name,
            blob_name,
            data_type=data_type,
            metadata_id=dataset_id,
            sas_token=None,
        )
        upsert_columns_order_in_dataset_tags(dataset_id, data_type, header)
        rows_iter = iter_csv_rows_from_blob(
            container_name,
            blob_name,
            data_type=data_type,
            metadata_id=dataset_id,
            sas_token=None,
        )
        bulk_insert_raw_rows(
            data_type=data_type,
            case_id=case_id,
            dataset_id=dataset_id,
            version=version,
            rows_iter=rows_iter,
            batch_size=5000,
        )

    # 2) Preprocess (build base math + sku selection)
    dataset_ids_json = get_latest_datset_ids(case_id)
    if dataset_ids_json.get("CROSSPURCHASE",None) and dataset_ids_json.get("POS",None) and dataset_ids_json.get("ATTRIBUTES",None):
        is_preprocessed=True
        pre_process_data(
            case_id,
            cp_dataset_id=dataset_ids_json.get("CROSSPURCHASE",None),
            pos_dataset_id=dataset_ids_json.get("POS",None),
            att_dataset_id=dataset_ids_json.get("ATTRIBUTES",None),
            test=test
        )
    return is_preprocessed

def pre_process_data(case_id, cp_dataset_id, pos_dataset_id, att_dataset_id, test=False):
    if not test:
        pp_id = create_preprocessed_metadata(case_id, cp_dataset_id, pos_dataset_id, att_dataset_id)

    df_cp = load_table_with_jsonb(
        schema="core",
        table_name="raw_cross_purchase_data",
        json_column="data",
        extra_where=f"case_id = '{case_id}' AND metadata_id='{cp_dataset_id}'",
        metadata_id=cp_dataset_id,
        data_type="CROSSPURCHASE",
        include_row_num=False,
    )
    df_attribute = load_table_with_jsonb(
        schema="core",
        table_name="raw_attributes_data",
        json_column="data",
        extra_where=f"case_id = '{case_id}' AND metadata_id='{att_dataset_id}'",
        metadata_id=att_dataset_id,
        data_type="ATTRIBUTES",
    )
    df_pos = load_table_with_jsonb(
        schema="core",
        table_name="raw_pos_data",
        json_column="data",
        extra_where=f"case_id = '{case_id}' AND metadata_id='{pos_dataset_id}'",
        metadata_id=pos_dataset_id,
        data_type="POS",
    )

    cols_to_front = ["category", "total_base_buyers", "raw_buyers", "is_branded", "is_client", "skuname_ean"]
    _ensure_required_columns(df_cp, cols_to_front, data_type="CROSSPURCHASE", metadata_id=cp_dataset_id)
    _ensure_required_columns(df_attribute, ["skuname_ean"], data_type="ATTRIBUTES", metadata_id=att_dataset_id)
    _ensure_required_columns(df_pos, ["skuname_ean"], data_type="POS", metadata_id=pos_dataset_id)
    df_cp = df_cp[cols_to_front + [c for c in df_cp.columns if c not in cols_to_front]]

    total_base_buyers_series = _to_numeric_series(
        df_cp,
        "total_base_buyers",
        data_type="CROSSPURCHASE",
        metadata_id=cp_dataset_id,
    )
    total_base_buyers = float(total_base_buyers_series.iloc[0])

    buyer_matrix_df = df_cp.iloc[:, 6:]
    buyer_matrix = _to_numeric_matrix(
        buyer_matrix_df,
        data_type="CROSSPURCHASE",
        metadata_id=cp_dataset_id,
    )

    # roi_matrix
    n = buyer_matrix.shape[0]
    roi_matrix = np.zeros((n, n), dtype=float)
    row_max = np.max(buyer_matrix, axis=1)
    col_max = np.max(buyer_matrix, axis=0)

    HUGE_VALUE = 0.0
    for i in range(n):
        for j in range(i, n):
            if i == j:
                roi_matrix[i, j] = HUGE_VALUE
            else:
                denom = float(row_max[i]) * float(col_max[j])
                if denom == 0:
                    roi_matrix[i, j] = 0.0
                else:
                    roi_matrix[i, j] = (buyer_matrix[i, j] * total_base_buyers) / denom
                roi_matrix[j, i] = roi_matrix[i, j]

    # mean ROI per row excluding diagonal
    mask = ~np.eye(n, dtype=bool)
    row_avg_roi = roi_matrix[mask].reshape(n, n - 1).mean(axis=1)

    df_roi_matrix = pd.DataFrame(roi_matrix, columns=df_cp.columns[6:])
    df_roi_matrix.insert(0, "skuname_ean", df_cp["skuname_ean"])
    df_roi_matrix.insert(0, "abs_pen%", ((row_max / total_base_buyers) * 100).round(3))
    df_roi_matrix.insert(0, "avg_roi", row_avg_roi)

    df_sku_math = df_roi_matrix.merge(df_attribute, on="skuname_ean", how="left")
    cols = (
            list(df_attribute.columns) +
            [c for c in df_sku_math.columns if c not in df_attribute.columns]
    )

    df_sku_math = df_sku_math[cols]
    if not test:
        upsert_columns_order_in_preprocessed_tags(pp_id, "BASEMATH", list(df_sku_math.columns))
        rows_iter = iter_rows_from_df(df_sku_math)
        bulk_insert_processed_rows(
            data_type="BASEMATH",
            case_id=case_id,
            p_metadata_id=pp_id,
            rows_iter=rows_iter,
            batch_size=5000,
        )

    df_temp = df_cp[["category", "skuname_ean", "total_base_buyers", "raw_buyers", "is_branded", "is_client"]].copy()
    df_temp.loc[:, "abs_pen%"] = ((row_max / total_base_buyers) * 100).round(3)
    df_temp1 = df_temp.merge(df_attribute, on="skuname_ean", how="left")
    df_temp2 = df_temp1.merge(df_pos, on="skuname_ean", how="left")
    # keeping the attributes from the attribute sheet only to ensure the coverage can be calculated
    rename_dict = {c: c[:-2] for c in df_temp2.columns if c.endswith('_x')}
    drop_list = [c for c in df_temp2.columns if c.endswith('_y')]
    df_unify = df_temp2.rename(columns=rename_dict).drop(columns=drop_list)
    if not test:
        upsert_columns_order_in_preprocessed_tags(pp_id, "SKUSELECTION", list(df_unify.columns))
        rows_iter_sku = iter_rows_from_df(df_unify)
        bulk_insert_processed_rows(
            data_type="SKUSELECTION",
            case_id=case_id,
            p_metadata_id=pp_id,
            rows_iter=rows_iter_sku,
            batch_size=5000,
        )


def iter_rows_from_df(df: pd.DataFrame) -> Iterator[Dict[str, Any]]:
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        cleaned: Dict[str, Any] = {}

        for key, value in row.items():
            if value is None or (isinstance(value, float) and np.isnan(value)):
                cleaned[key] = None
            else:
                v = str(value).strip()
                cleaned[key] = v

        if all(v is None or v == "" for v in cleaned.values()):
            continue

        yield {
            "row_num": i,
            "data": json.dumps(cleaned, ensure_ascii=False, sort_keys=False),
        }


def ingest_partition_grouping_logic(payload: Dict[str, Any]) -> bool:
    """
    Ingest grouping data for a partition.

    payload should contain:
      partition_dataset_id, partition_id, case_id, blob_name

    Returns True if successful, False otherwise.
    """
    partition_dataset_id = payload.get("partition_dataset_id")
    partition_id = payload.get("partition_id")
    case_id = payload.get("case_id")
    blob_name = payload.get("blob_name")

    container_name = "case-data-uploads"
    
    try:
        # Get CSV header and store in tags
        header = get_csv_header_from_blob(
            container_name,
            blob_name,
            data_type="GROUPING",
            metadata_id=partition_dataset_id,
        )
        upsert_columns_order_in_partition_dataset_tags(partition_dataset_id, "GROUPING", header)

        # Stream rows from blob and insert into raw_grouping_data
        rows_iter = iter_csv_rows_from_blob(
            container_name,
            blob_name,
            data_type="GROUPING",
            metadata_id=partition_dataset_id,
        )
        bulk_insert_raw_grouping_rows(
            partition_id=partition_id,
            case_id=case_id,
            metadata_id=partition_dataset_id,
            rows_iter=rows_iter,
            batch_size=5000,
        )

        return True

    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Unable to ingest the GROUPING dataset.",
            data_type="GROUPING",
            metadata_id=partition_dataset_id,
            hint="Check the GROUPING file for header and row-level data issues, then upload it again.",
        ) from exc

ZERO_WIDTH_PATTERN = r"[\u200b\u200c\u200d\uFEFF]"
SYSTEM_COLS = {
    "id", "case_id", "partition_id", "metadata_id",
    "version", "pp_metadata_id", "row_num", "tags"
}


def build_partition_effective_attributes(
    case_id: str,
    partition_id: str,
    att_dataset_id: str,
    grouping_metadata_id: str,
    cp_dataset_id: str | None = None,
    normalize_columns: bool = True,
) -> dict:
    """
    Build and store working effective attributes by merging:
      - case-level ATTRIBUTES (core.raw_attributes_data)
      - partition-level GROUPING (core.raw_grouping_data)
    into:
      - core.working_attributes_data (keyed by grouping_metadata_id; ON DELETE CASCADE)

    Rules:
      - GROUPING must exist and contain 'skuname_ean'
      - Left join on skuname_ean
      - ATTRIBUTES takes precedence
      - Only adds GROUPING columns that do not exist in ATTRIBUTES
    """
    try:
        # 1) Load ATTRIBUTES (required)
        df_attr = load_table_with_jsonb(
            "core",
            "raw_attributes_data",
            json_column="data",
            extra_where=f"case_id = '{case_id}' AND metadata_id = '{att_dataset_id}'",
            metadata_id=att_dataset_id,
            data_type="ATTRIBUTES",
        )
        if df_attr is None or df_attr.empty:
            raise IngestionDataError(
                message="No ATTRIBUTES data was found for this case.",
                data_type="ATTRIBUTES",
                metadata_id=att_dataset_id,
                hint="Upload or reselect the ATTRIBUTES file before creating working attributes.",
            )
        _ensure_required_columns(
            df_attr,
            ["skuname_ean"],
            data_type="ATTRIBUTES",
            metadata_id=att_dataset_id,
        )

        # 2) Load GROUPING (required)
        df_grouping = load_table_with_jsonb(
            "core",
            "raw_grouping_data",
            json_column="data",
            extra_where=(
                f"case_id = '{case_id}' AND partition_id = '{partition_id}' "
                f"AND metadata_id = '{grouping_metadata_id}'"
            ),
            metadata_id=grouping_metadata_id,
            data_type="GROUPING",
        )
        if df_grouping is None or df_grouping.empty:
            raise IngestionDataError(
                message="No GROUPING data was found for this partition.",
                data_type="GROUPING",
                metadata_id=grouping_metadata_id,
                hint="Upload a GROUPING file for the partition before retrying this step.",
            )
        _ensure_required_columns(
            df_grouping,
            ["skuname_ean"],
            data_type="GROUPING",
            metadata_id=grouping_metadata_id,
        )

        # 3) Normalize columns (optional)
        if normalize_columns:
            df_attr.columns = _normalize_column_index(df_attr.columns)
            df_grouping.columns = _normalize_column_index(df_grouping.columns)

        # 4) Optionally enrich ATTRIBUTES with is_client from CROSSPURCHASE
        is_client_added = False
        needs_is_client = "is_client" not in df_attr.columns or df_attr["is_client"].isna().any()
        if needs_is_client:
            if not cp_dataset_id:
                try:
                    partition = Partitions.objects.get(id=partition_id, is_deleted=False)
                    if partition.ppm and partition.ppm.cp_dataset_id:
                        cp_dataset_id = str(partition.ppm.cp_dataset_id)
                except Partitions.DoesNotExist:
                    cp_dataset_id = None

                if not cp_dataset_id:
                    cp_md = DatasetMetadata.objects.filter(
                        case_id=case_id,
                        data_type="CROSSPURCHASE",
                        is_deleted=False,
                        is_selected=True,
                    ).order_by("-version").first()
                    if cp_md:
                        cp_dataset_id = str(cp_md.id)

            if cp_dataset_id:
                df_cp = load_table_with_jsonb(
                    "core",
                    "raw_cross_purchase_data",
                    json_column="data",
                    extra_where=f"case_id = '{case_id}' AND metadata_id = '{cp_dataset_id}'",
                    metadata_id=cp_dataset_id,
                    data_type="CROSSPURCHASE",
                )
                if normalize_columns:
                    df_cp.columns = _normalize_column_index(df_cp.columns)

                if "skuname_ean" in df_cp.columns and "is_client" in df_cp.columns:
                    df_cp = df_cp.loc[:, ["skuname_ean", "is_client"]]
                    had_is_client = "is_client" in df_attr.columns
                    df_attr = df_attr.merge(df_cp, on="skuname_ean", how="left", suffixes=("", "_cp"))
                    if had_is_client and "is_client_cp" in df_attr.columns:
                        df_attr["is_client"] = df_attr["is_client"].where(
                            df_attr["is_client"].notna(),
                            df_attr["is_client_cp"],
                        )
                        df_attr.drop(columns=["is_client_cp"], inplace=True)
                        is_client_added = True
                    elif not had_is_client and "is_client" in df_attr.columns:
                        is_client_added = True

        # 5) Merge (ATTRIBUTES primary; add GROUPING-only cols)
        grouping_only_cols = [c for c in df_grouping.columns if c not in df_attr.columns and c != "skuname_ean"]

        df_merged = df_attr.merge(
            df_grouping[["skuname_ean", *grouping_only_cols]],
            on="skuname_ean",
            how="left",
        )

        def rows_iterator():
            for i, record in enumerate(df_merged.to_dict(orient="records"), start=1):
                for col in SYSTEM_COLS:
                    record.pop(col, None)
                yield {"row_num": i, "data": record, "tags": {}}

        bulk_insert_working_attributes_rows(
            grouping_metadata_id=grouping_metadata_id,
            case_id=case_id,
            partition_id=partition_id,
            rows_iter=rows_iterator(),
        )

        # 6) Store columns order on GROUPING metadata tags (optional)
        merged_cols = [c for c in df_merged.columns if c not in SYSTEM_COLS]

        md = PartitionDatasetMetadata.objects.get(id=grouping_metadata_id)
        md.tags = md.tags or {}
        md.tags["working_attributes_columns_order"] = merged_cols
        md.save(update_fields=["tags"])

        return {
            "success": True,
            "output_rows": len(df_merged),
            "attribute_skus": len(df_attr),
            "grouping_skus": len(df_grouping),
            "merged_skus": len(df_merged),
            "grouping_only_columns": grouping_only_cols,
            "is_client_added": is_client_added,
        }

    except IngestionDataError:
        raise
    except Exception as exc:
        raise coerce_ingestion_error(
            exc,
            message="Unable to build working attributes from ATTRIBUTES and GROUPING data.",
            data_type="WORKING_ATTRIBUTES",
            metadata_id=grouping_metadata_id,
            hint="Check that ATTRIBUTES and GROUPING files use compatible SKU keys and valid values.",
        ) from exc
