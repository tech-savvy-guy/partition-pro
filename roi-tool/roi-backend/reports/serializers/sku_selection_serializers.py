from rest_framework import serializers
from ..models import PreprocessedSkuSelection


class SkuSelectionRowSerializer(serializers.Serializer):
    """
    Not a ModelSerializer on purpose: we flatten JSON dynamically.
    """

    def to_representation(self, instance: PreprocessedSkuSelection):
        base = {
            "id": str(instance.id),
            "case_id": str(instance.case_id),
            "pp_metadata_id": str(instance.pp_metadata_id),
        }

        if isinstance(instance.data, dict):
            for k, v in instance.data.items():
                base[k] = v

        return base
