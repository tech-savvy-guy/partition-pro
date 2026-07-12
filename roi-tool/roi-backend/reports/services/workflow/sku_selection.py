# reports/services/workflow/sku_selection.py
import json
from typing import Dict, Any, List
from uuid import UUID

from django.core.cache import cache
from django.db import connection
from django.utils import timezone

from .base import (
    register_step_calculator,
    get_partition,
    build_cache_key,
)
from ...models import Partitions, PreprocessedMetadata


def _call_overall_coverage_db(
    case_id: UUID,
    partition_id: UUID,
    selected_ids: List[UUID],
) -> Dict[str, Any]:
    """
    Wrapper around DB function:
        core.get_overall_coverage(
            _case_id         uuid,
            _pos_metadata_id uuid,
            _cp_metadata_id  uuid,
            _pp_metadata_id  uuid,
            _selected_ids    uuid[]
        )
    """

    partition: Partitions = Partitions.objects.select_related("ppm").get(
        id=partition_id,
        case_id=case_id,
        is_deleted=False,
    )
    ppm: PreprocessedMetadata = partition.ppm  # type: ignore

    pos_metadata_id = ppm.pos_dataset_id
    cp_metadata_id = ppm.cp_dataset_id
    pp_metadata_id = ppm.id

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT core.get_overall_coverage(%s, %s, %s, %s, %s);
            """,
            [
                str(case_id),
                str(pos_metadata_id),
                str(cp_metadata_id),
                str(pp_metadata_id),
                selected_ids,
            ],
        )
        row = cursor.fetchone()

    return json.loads(row[0])  # JSONB → dict


def _call_attribute_coverage_db(
    case_id: UUID,
    partition_id: UUID,
    selected_ids: List[UUID],
) -> Dict[str, Any]:
    """
    Wrapper around DB function:
        core.get_attribute_coverage(
            _case_id         uuid,
            _pos_metadata_id uuid,
            _pp_metadata_id  uuid,
            _att_metadata_id uuid,
            _selected_ids    uuid[]
        )
    """

    partition: Partitions = Partitions.objects.select_related("ppm").get(
        id=partition_id,
        case_id=case_id,
        is_deleted=False,
    )
    ppm: PreprocessedMetadata = partition.ppm  # type: ignore

    pos_metadata_id = ppm.pos_dataset_id
    pp_metadata_id = ppm.id
    att_metadata_id = ppm.att_dataset_id

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT core.get_attribute_coverage(%s, %s, %s, %s, %s);
            """,
            [
                str(case_id),
                str(pos_metadata_id),
                str(pp_metadata_id),
                str(att_metadata_id),
                selected_ids,
            ],
        )
        row = cursor.fetchone()

    return json.loads(row[0])  # JSONB → dict: {"coverage": [...]}


def _calculate_sku_selection(
    case_id: UUID,
    partition_id: UUID,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Step 1 = SKU_SELECTION

    - Reads params["selected_sku_ids"] (rows in preprocessed_sku_selection)
    - Calls:
        - core.get_overall_coverage(...)
        - core.get_attribute_coverage(...)
    - Combines both into a single result dict, stored in Workflow.data["calculation"]["result"].
    """

    raw_ids = params.get("selected_sku_ids", []) or []
    selected_ids: List[UUID] = [UUID(str(x)) for x in raw_ids]

    if not selected_ids:
        # No selection → minimal structure
        return {
            "step": 1,
            "case_id": str(case_id),
            "partition_id": str(partition_id),
            "calculated_at": timezone.now().isoformat(),
            "overall_coverage": {
                "total_pos": {},
                "current_selection": {
                    "min_n_cutoff_selected": None,
                    "skus": 0,
                    "client_skus": 0,
                    "pos_coverage_value_pct": 0.0,
                    "pos_coverage_volume_pct": 0.0,
                    "client_coverage_value_pct": 0.0,
                    "client_coverage_volume_pct": 0.0,
                    "percent_zeroes": None,
                },
                "all_panel_skus": {},
            },
            "coverage": [],
            "message": "No SKUs selected",
        }

    # Ensure partition exists (sanity check)
    _ = get_partition(case_id, partition_id)

    # 1) Overall coverage
    overall_coverage_json = _call_overall_coverage_db(
        case_id=case_id,
        partition_id=partition_id,
        selected_ids=selected_ids,
    )
    # expected: {"overall_coverage": {...}}

    # 2) Attribute coverage (df_attribute logic)
    attribute_coverage_json = _call_attribute_coverage_db(
        case_id=case_id,
        partition_id=partition_id,
        selected_ids=selected_ids,
    )
    # expected: {"coverage": [...]}

    result: Dict[str, Any] = {
        "step": 1,
        "case_id": str(case_id),
        "partition_id": str(partition_id),
        "calculated_at": timezone.now().isoformat(),
        "overall_coverage": overall_coverage_json.get("overall_coverage", {}),
        "coverage": attribute_coverage_json.get("coverage", []),
        "selected_ids": raw_ids,
    }
    return result


# Register this as the step-1 calculator
register_step_calculator('sku_selection', _calculate_sku_selection)
