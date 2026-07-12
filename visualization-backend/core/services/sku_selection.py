from dataclasses import dataclass
from typing import Any

from core.models import (
    Dataset,
    RawAttributesData,
    RawCrossPurchaseData,
    RawPosData,
    WorkflowRun,
)


SKU_JOIN_KEY = "skuname_ean"
MIN_SELECTED_SKUS = 3
SKU_BASE_COLUMNS = [
    "category",
    "skuname_ean",
    "total_base_buyers",
    "raw_buyers",
    "is_branded",
    "is_client",
]


@dataclass(frozen=True)
class SelectedRawDatasets:
    pos: Dataset | None
    attributes: Dataset | None
    cross_purchase: Dataset | None

    def as_meta(self) -> dict[str, str | None]:
        return {
            "pos": str(self.pos.id) if self.pos else None,
            "attributes": str(self.attributes.id) if self.attributes else None,
            "cross_purchase": (
                str(self.cross_purchase.id) if self.cross_purchase else None
            ),
        }


def get_sku_selection_payload(case_id, partition_id) -> dict[str, Any]:
    selected = _get_selected_raw_datasets(case_id)
    if not selected.cross_purchase:
        return _empty_payload(case_id, partition_id, selected)

    cross_rows = list(
        RawCrossPurchaseData.objects.filter(
            case_id=case_id,
            metadata_id=selected.cross_purchase.id,
        ).order_by("row_num")
    )
    if not cross_rows:
        return _empty_payload(case_id, partition_id, selected)

    attr_rows = (
        RawAttributesData.objects.filter(
            case_id=case_id,
            metadata_id=selected.attributes.id,
        ).order_by("row_num")
        if selected.attributes
        else RawAttributesData.objects.none()
    )
    pos_rows = (
        RawPosData.objects.filter(case_id=case_id, metadata_id=selected.pos.id).order_by(
            "row_num"
        )
        if selected.pos
        else RawPosData.objects.none()
    )

    attributes_by_sku = _rows_by_sku(attr_rows)
    pos_by_sku = _rows_by_sku(pos_rows)

    columns = _build_columns(selected)
    rows = []

    for cross_row in cross_rows:
        cross_data = cross_row.data or {}
        sku = _normalize_key(cross_data.get(SKU_JOIN_KEY))

        out: dict[str, Any] = {
            "id": str(cross_row.id),
            "case_id": str(cross_row.case_id),
            "metadata_id": str(cross_row.metadata_id),
        }
        for column in SKU_BASE_COLUMNS:
            out[column] = cross_data.get(column)

        attr_data = attributes_by_sku.get(sku, {})
        pos_data = pos_by_sku.get(sku, {})

        for column in _dataset_columns(selected.attributes):
            if column == SKU_JOIN_KEY or column in out:
                continue
            out[column] = attr_data.get(column)

        for column in _dataset_columns(selected.pos):
            if column == SKU_JOIN_KEY or column in out:
                continue
            out[column] = pos_data.get(column)

        for column, value in attr_data.items():
            if column != SKU_JOIN_KEY and column not in out:
                out[column] = value
                if column not in columns:
                    columns.append(column)

        for column, value in pos_data.items():
            if column != SKU_JOIN_KEY and column not in out:
                out[column] = value
                if column not in columns:
                    columns.append(column)

        rows.append(out)

    return _with_selection_state(
        {
            "columns": columns,
            "rows": rows,
            "pagination": {
                "mode": "none",
                "total_rows": len(rows),
            },
            "meta": {
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "source": "raw_current",
                "dataset_ids": selected.as_meta(),
            },
        },
        partition_id,
    )


def normalize_selected_skus(values) -> list[str]:
    if not isinstance(values, list):
        raise ValueError("selected_skus must be a list.")

    selected_skus = []
    seen = set()
    for value in values:
        sku = _normalize_key(value)
        if not sku or sku in seen:
            continue
        seen.add(sku)
        selected_skus.append(sku)

    return selected_skus


def validate_selected_skus(payload: dict[str, Any], selected_skus: list[str]):
    if len(selected_skus) < MIN_SELECTED_SKUS:
        return {
            "selected_skus": [
                f"Select at least {MIN_SELECTED_SKUS} SKUs."
            ]
        }

    available_skus = set(_payload_skus(payload))
    missing_skus = [sku for sku in selected_skus if sku not in available_skus]
    if missing_skus:
        return {
            "selected_skus": [
                "Unknown SKU(s): " + ", ".join(missing_skus) + "."
            ]
        }

    return {}


def _latest_workflow(partition_id):
    # One unified workflow row per partition holds the saved SKU selection in
    # ``parameters.selected_skus``.
    return (
        WorkflowRun.objects.filter(partition_id=partition_id)
        .order_by("-started_at")
        .first()
    )


def _payload_skus(payload: dict[str, Any]) -> list[str]:
    skus = []
    seen = set()
    for row in payload.get("rows", []) or []:
        sku = _normalize_key((row or {}).get(SKU_JOIN_KEY))
        if sku and sku not in seen:
            seen.add(sku)
            skus.append(sku)
    return skus


def _saved_skus(workflow: WorkflowRun | None) -> tuple[list[str], bool]:
    if workflow is None:
        return [], False
    parameters = workflow.parameters or {}
    if "selected_skus" not in parameters:
        return [], False
    try:
        return normalize_selected_skus(parameters.get("selected_skus")), True
    except ValueError:
        return [], False


def _with_selection_state(payload: dict[str, Any], partition_id):
    available_skus = _payload_skus(payload)
    saved_skus, has_saved_selection = _saved_skus(_latest_workflow(partition_id))
    available_set = set(available_skus)
    effective_skus = (
        [sku for sku in saved_skus if sku in available_set]
        if has_saved_selection
        else available_skus
    )

    meta = payload.setdefault("meta", {})
    meta["has_saved_selection"] = has_saved_selection
    payload["selected_skus"] = effective_skus
    return payload


def _empty_payload(case_id, partition_id, selected: SelectedRawDatasets):
    columns = _build_columns(selected)
    return _with_selection_state(
        {
            "columns": columns,
            "rows": [],
            "pagination": {
                "mode": "none",
                "total_rows": 0,
            },
            "meta": {
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "source": "raw_current",
                "dataset_ids": selected.as_meta(),
            },
        },
        partition_id,
    )


def _get_selected_raw_datasets(case_id) -> SelectedRawDatasets:
    selected = {
        dataset.type: dataset
        for dataset in Dataset.objects.filter(
            case_id=case_id,
            is_deleted=False,
            is_selected=True,
        )
    }
    return SelectedRawDatasets(
        pos=selected.get(Dataset.Type.POS),
        attributes=selected.get(Dataset.Type.ATTRIBUTES),
        cross_purchase=selected.get(Dataset.Type.CROSS_PURCHASE),
    )


def _dataset_columns(dataset: Dataset | None) -> list[str]:
    if not dataset:
        return []
    columns = (dataset.tags or {}).get("columns_order")
    if isinstance(columns, list):
        return [str(column) for column in columns]
    return []


def _build_columns(selected: SelectedRawDatasets) -> list[str]:
    columns = ["id", "case_id", "metadata_id", *SKU_BASE_COLUMNS]
    for dataset in (selected.attributes, selected.pos):
        for column in _dataset_columns(dataset):
            if column == SKU_JOIN_KEY or column in columns:
                continue
            columns.append(column)
    return columns


def _rows_by_sku(rows) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        data = row.data or {}
        key = _normalize_key(data.get(SKU_JOIN_KEY))
        if key and key not in out:
            out[key] = data
    return out


def _normalize_key(value) -> str:
    return str(value or "").strip()
