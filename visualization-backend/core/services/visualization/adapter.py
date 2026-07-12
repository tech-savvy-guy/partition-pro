from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

import numpy as np
import pandas as pd

from core.models import Dataset, RawAttributesData, RawCrossPurchaseData

from .types import VisualizationInput


def _unique_strings(values: Iterable[object]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in seen:
            seen.add(text)
            out.append(text)
    return out


def _numeric_series(series: pd.Series, column_name: str) -> pd.Series:
    normalized = series.astype(str).str.replace(",", "", regex=False).str.strip()
    numeric = pd.to_numeric(normalized, errors="coerce")
    if numeric.isna().any():
        raise ValueError(f"Column '{column_name}' contains non-numeric values")
    return numeric


def _validate_selected_skus(selected_skus: list[str]) -> None:
    if len(selected_skus) < 3:
        raise ValueError("Visualization requires at least 3 selected SKUs")


def _rows_to_dataframe(rows, base_cols: tuple[str, ...]) -> pd.DataFrame:
    out = []
    for row in rows:
        row_data = {column: getattr(row, column) for column in base_cols}
        row_data.update(row.data or {})
        out.append(row_data)
    return pd.DataFrame(out)


def _selected_dataset(case_id: UUID | str, dataset_type: str) -> Dataset | None:
    return (
        Dataset.objects.filter(
            case_id=case_id,
            type=dataset_type,
            is_selected=True,
            is_deleted=False,
            status=Dataset.Status.READY,
        )
        .order_by("-version", "-updated_at")
        .first()
    )


def _dataset_from_context(
    case_id: UUID | str,
    dataset_type: str,
    dataset_ids: dict[str, str | None] | None,
) -> Dataset | None:
    dataset_id = (dataset_ids or {}).get(str(dataset_type))
    if dataset_id:
        return (
            Dataset.objects.filter(
                id=dataset_id,
                case_id=case_id,
                type=dataset_type,
                is_deleted=False,
                status=Dataset.Status.READY,
            )
            .order_by("-version", "-updated_at")
            .first()
        )
    return _selected_dataset(case_id, dataset_type)


def build_visualization_input_from_frames(
    *,
    cross_df: pd.DataFrame,
    attributes_df: pd.DataFrame | None,
    selected_skus: list[str],
    include_attributes: bool = True,
) -> VisualizationInput:
    selected_skus = _unique_strings(selected_skus)
    _validate_selected_skus(selected_skus)

    required_cross = {"skuname_ean", "total_base_buyers", *selected_skus}
    missing_cross = sorted(required_cross.difference(cross_df.columns))
    if missing_cross:
        raise ValueError(
            f"CROSSPURCHASE is missing required columns: {', '.join(missing_cross)}"
        )

    cross = cross_df.copy()
    cross["skuname_ean"] = cross["skuname_ean"].astype(str)
    cross = cross[cross["skuname_ean"].isin(selected_skus)].copy()
    found_skus = set(cross["skuname_ean"].astype(str).tolist())
    missing_rows = [sku for sku in selected_skus if sku not in found_skus]
    if missing_rows:
        raise ValueError(
            "CROSSPURCHASE is missing rows for selected SKUs: "
            + ", ".join(missing_rows)
        )

    order = {sku: index for index, sku in enumerate(selected_skus)}
    cross["_visualization_order"] = cross["skuname_ean"].map(order)
    cross = cross.sort_values("_visualization_order").drop(
        columns=["_visualization_order"]
    )

    base_values = _numeric_series(cross["total_base_buyers"], "total_base_buyers")
    base = float(base_values.iloc[0])
    if base <= 0:
        raise ValueError("total_base_buyers must be positive")

    matrix_df = cross[selected_skus].apply(
        lambda column: _numeric_series(column, str(column.name))
    )
    matrix = matrix_df.to_numpy(dtype=float)
    if matrix.shape != (len(selected_skus), len(selected_skus)):
        raise ValueError("CROSSPURCHASE selected SKU block must be square")
    if not np.allclose(matrix, matrix.T, rtol=0.0, atol=1e-6):
        raise ValueError("CROSSPURCHASE selected SKU block must be symmetric")

    visual_cross = pd.DataFrame({"ID": selected_skus, "sku_name": selected_skus})
    for sku in selected_skus:
        visual_cross[sku] = matrix_df[sku].to_numpy(dtype=float)

    visual_attributes = None
    if include_attributes and attributes_df is not None:
        if "skuname_ean" not in attributes_df.columns:
            raise ValueError("ATTRIBUTES must contain 'skuname_ean'")
        attrs = attributes_df.copy()
        attrs["skuname_ean"] = attrs["skuname_ean"].astype(str)
        attrs = attrs[attrs["skuname_ean"].isin(selected_skus)].copy()
        attrs["_visualization_order"] = attrs["skuname_ean"].map(order)
        attrs = attrs.sort_values("_visualization_order").drop(
            columns=["_visualization_order"]
        )
        attrs = attrs.drop_duplicates(subset=["skuname_ean"], keep="first")
        visual_attributes = attrs.rename(columns={"skuname_ean": "ID"})
        visual_attributes.insert(1, "sku_name", visual_attributes["ID"])

    return VisualizationInput(
        cross_df=visual_cross,
        matrix=matrix,
        sku_ids=selected_skus,
        base=base,
        attributes=visual_attributes,
    )


def build_visualization_input_from_database(
    case_id: UUID | str,
    partition_id: UUID | str,
    *,
    selected_skus: list[str],
    dataset_ids: dict[str, str | None] | None = None,
    include_attributes: bool = True,
) -> VisualizationInput:
    del partition_id
    selected_skus = _unique_strings(selected_skus)
    _validate_selected_skus(selected_skus)

    cross_dataset = _dataset_from_context(
        case_id,
        Dataset.Type.CROSS_PURCHASE,
        dataset_ids,
    )
    if cross_dataset is None:
        raise ValueError("Select a ready CROSSPURCHASE dataset before visualization")

    cross_df = _rows_to_dataframe(
        RawCrossPurchaseData.objects.filter(
            case_id=case_id,
            metadata_id=cross_dataset.id,
        ).order_by("row_num"),
        base_cols=("id", "case_id", "metadata_id", "row_num", "version"),
    )
    if cross_df.empty:
        raise ValueError("No CROSSPURCHASE rows found for this partition")

    attributes_df = None
    if include_attributes:
        attributes_dataset = _dataset_from_context(
            case_id,
            Dataset.Type.ATTRIBUTES,
            dataset_ids,
        )
        if attributes_dataset is not None:
            attributes_df = _rows_to_dataframe(
                RawAttributesData.objects.filter(
                    case_id=case_id,
                    metadata_id=attributes_dataset.id,
                ).order_by("row_num"),
                base_cols=("id", "case_id", "metadata_id", "row_num", "version"),
            )
            if attributes_df.empty:
                attributes_df = None

    return build_visualization_input_from_frames(
        cross_df=cross_df,
        attributes_df=attributes_df,
        selected_skus=selected_skus,
        include_attributes=include_attributes,
    )
