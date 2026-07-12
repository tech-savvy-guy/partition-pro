# reports/services/workflow/base.py
from typing import Callable, Dict, Any, List
from uuid import UUID

from django.core.cache import cache

from ...models import Partitions
from ...serializers.dynamic_json_rows import DynamicJsonRowSerializer

StepCalculator = Callable[[UUID, UUID, Dict[str, Any]], Dict[str, Any]]

_STEP_CALCULATORS: dict[str, StepCalculator] = {}


def register_step_calculator(step_name: str, func: StepCalculator) -> None:
    _STEP_CALCULATORS[step_name] = func


def get_step_calculator(step_name: str) -> StepCalculator | None:
    return _STEP_CALCULATORS.get(step_name)


def get_partition(case_id: UUID, partition_id: UUID) -> Partitions:
    return Partitions.objects.get(
        id=partition_id,
        case_id=case_id,
        is_deleted=False,
    )


def build_cache_key(
    prefix: str,
    case_id: UUID,
    partition_id: UUID,
    step_number: int,
    params: Dict[str, Any] | None = None,
) -> str:
    params = params or {}
    return (
        f"{prefix}:case={case_id}:partition={partition_id}:"
        f"step={step_number}:extra={hash(frozenset(params.items()))}"
    )


def queryset_to_flat_rows(qs, base_fields: tuple[str, ...]) -> List[Dict[str, Any]]:
    """
    Use DynamicJsonRowSerializer the same way JsonStagingTableView does:
    - includes base_fields (e.g. id, case_id, pp_metadata_id)
    - expands instance.data JSON keys into top-level fields
    Returns a list of dicts suitable for building a df.
    """
    serializer = DynamicJsonRowSerializer(qs, many=True)
    # let the serializer know which base fields to include
    serializer.child.base_fields = base_fields  # type: ignore
    return list(serializer.data)


def run_step_calculation(
    case_id: str | Any,
    partition_id: str | Any,
    step_name: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    from uuid import UUID as _UUID
    case_uuid = _UUID(str(case_id))
    partition_uuid = _UUID(str(partition_id))

    calculator = get_step_calculator(step_name)
    if calculator is None:
        return {
            "message": f"No specific calculation for step {step_name}",
            "step": step_name,
            "case_id": str(case_uuid),
            "partition_id": str(partition_uuid),
        }

    return calculator(case_uuid, partition_uuid, params)
