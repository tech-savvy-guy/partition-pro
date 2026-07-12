# reports/services/workflow/step2_join_basemath.py
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from uuid import UUID
from collections import OrderedDict
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
import time
from .observability import log_event

from ...models import Workflow, Partitions, PreprocessedMetadata
from .base import register_step_calculator, get_partition, build_cache_key


# --- Helper: call the DB function core.get_selected_skus_with_basemath(...) ---
def _call_db_get_joined(case_id, partition, basemath_ppm_id, selected_ids, view_type):
    pp_metadata_id = partition.ppm_id
    sel_ids_param = selected_ids if selected_ids else None

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT core.get_basemath_full(%s::uuid, %s::uuid, %s::uuid, %s::uuid[], %s::text)::text;",
            [case_id, pp_metadata_id, basemath_ppm_id, sel_ids_param, view_type],
        )
        row = cursor.fetchone()

    raw = row[0] if row else None
    if not raw:
        return []

    merged = json.loads(raw, object_pairs_hook=OrderedDict)

    if isinstance(merged, dict):
        merged = [merged]
    return merged

'''Optimization'''
def _call_db_get_basemath_long_skuname( run_id,case_id, basemath_id, selected_skunames,batch_size=100_000):
    log_event("Started calling df_long",run_id=run_id)
    t_total = time.perf_counter()
    dfs = []
    rows_total = 0
    fetch_calls = 0
    fetch_time = 0.0
    df_build_time = 0.0
    t_conn = time.perf_counter()
    with connection.cursor() as cursor:
        conn_ms = int((time.perf_counter() - t_conn) * 1000)

        t_db = time.perf_counter()
        cursor.execute("""
            SELECT sku_l, sku_r, roi
            FROM core.get_basemath_matrix_rows_by_skuname(%s, %s, %s)
        """, [case_id, basemath_id, selected_skunames])
        db_exec_ms = int((time.perf_counter() - t_db) * 1000)

        while True:

            t_fetch = time.perf_counter()
            rows = cursor.fetchmany(batch_size)
            fetch_time += time.perf_counter() - t_fetch
            if not rows:
                break

            fetch_calls += 1
            rows_total += len(rows)

            t_df = time.perf_counter()
            df_chunk = pd.DataFrame(
                rows,
                columns=["skuname_ean_l", "skuname_ean_r", "roi"]
            )

            # Light optimizations per chunk
            df_chunk["roi"] = df_chunk["roi"].astype("float32")
            df_build_time += time.perf_counter() - t_df

            dfs.append(df_chunk)

        t_concat = time.perf_counter()
        df_long = pd.concat(dfs, ignore_index=True)
        concat_ms = int((time.perf_counter() - t_concat) * 1000)
        total_ms = int((time.perf_counter() - t_total) * 1000)
        log_event("roi_long.breakdown",run_id=run_id,rows=rows_total,chunks=fetch_calls,batch_size=batch_size,
            conn_ms=conn_ms,
            db_exec_ms=db_exec_ms,
            fetch_ms=int(fetch_time * 1000),
            df_build_ms=int(df_build_time * 1000),
            concat_ms=concat_ms,
            total_ms=total_ms,
        )
    return df_long
'''Optmization - END'''


def merged_list_to_df_like(
    merged_list: List[Dict[str, Any]]
) -> Dict[str, Any]:

    if not merged_list:
        return {"columns": [], "rows": [], "count": 0}

    priority = ["id", "case_id", "pp_metadata_id", "skuname_ean"]

    # source of truth: key order from first row
    first_keys = list(merged_list[0].keys())

    # priority columns in order (only if present)
    ordered = [k for k in priority if k in first_keys]

    # remaining columns in original DB order
    remainder = [k for k in first_keys if k not in ordered]

    columns = ordered + remainder

    rows = []
    for item in merged_list:
        # preserve column order
        rows.append([item.get(c) for c in columns])

    return {
        "columns": columns,
        "rows": rows,
        "count": len(rows),
    }


# def _get_selected_ids_from_step1(case_id: UUID, partition_id: UUID) -> List[UUID]:
#     try:
#         wf = Workflow.objects.get(
#             case_id=case_id,
#             partition_id=partition_id,
#             is_deleted=False,
#         )
#     except ObjectDoesNotExist:
#         return []
#
#     data = wf.data or {}
#     selected = data.get("steps").get("1").get("result").get("selected_ids") or []
#     uuids: List[UUID] = []
#     for s in selected:
#         try:
#             uuids.append(UUID(str(s)))
#         except Exception:
#             continue
#     return uuids


def _calculate_basemath_join(
    case_id: UUID,
    partition_id: UUID,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    raw_ids = params.get("selected_sku_ids", []) or []
    selected_ids: List[UUID] = [UUID(str(x)) for x in raw_ids]

    # cache_key = build_cache_key(
    #     prefix="step2_basemath_join",
    #     case_id=case_id,
    #     partition_id=partition_id,
    #     step_number=2,
    # )
    # cached = cache.get(cache_key)
    # if cached is not None:
    #     return cached

    partition = get_partition(case_id, partition_id)

    try:
        ppm = partition.ppm
    except Exception:
        ppm = None

    if ppm is None:
        result = {
            "step": 2,
            "case_id": str(case_id),
            "partition_id": str(partition_id),
            "columns": [],
            "rows": [],
            "count": 0,
            "message": "No preprocessed metadata (ppm) found for this partition",
            "calculated_at": timezone.now().isoformat(),
        }
        # cache.set(cache_key, result, timeout=30)
        return result


    basemath_ppm_id = getattr(ppm, "id", None)

    # selected_ids = _get_selected_ids_from_step1(case_id, partition_id)
    # if not selected_ids:
    #     result = {
    #         "step": 2,
    #         "case_id": str(case_id),
    #         "partition_id": str(partition_id),
    #         "columns": [],
    #         "rows": [],
    #         "count": 0,
    #         "message": "No selected SKUs found in step 1 workflow row",
    #         "calculated_at": timezone.now().isoformat(),
    #     }
    #     cache.set(cache_key, result, timeout=30)
    #     return result

    merged_list = _call_db_get_joined(
        case_id=case_id,
        partition=partition,
        basemath_ppm_id=basemath_ppm_id,
        selected_ids=selected_ids,
        view_type='FULL'
    )

    df_like = merged_list_to_df_like(merged_list)

    result = {
        "step": 2,
        "case_id": str(case_id),
        "partition_id": str(partition_id),
        "columns": df_like["columns"],
        "rows": df_like["rows"],
        "count": df_like["count"],
        "calculated_at": timezone.now().isoformat(),
    }

    # cache.set(cache_key, result, timeout=60)
    return result


register_step_calculator('base_math', _calculate_basemath_join)
