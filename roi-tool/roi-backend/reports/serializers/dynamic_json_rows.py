from rest_framework import serializers

class DynamicJsonRowSerializer(serializers.Serializer):
    """
    Generic serializer:
    - starts with base fields (id, case_id, pp_metadata_id if present)
    - then expands all keys from instance.data into top-level fields
    """

    base_fields = ("id", "case_id")

    def to_representation(self, instance):
        base = {}

        for field_name in self.base_fields:
            if hasattr(instance, field_name):
                base[field_name] = str(getattr(instance, field_name))

        if hasattr(instance, "pp_metadata_id"):
            base["pp_metadata_id"] = str(instance.pp_metadata_id)

        data = getattr(instance, "data", {}) or {}
        if isinstance(data, dict):
            for k, v in data.items():
                base[k] = v

        return base