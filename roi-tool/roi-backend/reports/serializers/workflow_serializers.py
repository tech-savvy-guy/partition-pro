# reports/serializers/workflow_serializers.py
from rest_framework import serializers
from ..models import Workflow


class RunWorkflowStepSerializer(serializers.Serializer):
    parameters = serializers.JSONField(required=False)


class WorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workflow
        fields = [
            "id",
            "case_id",
            "partition_id",
            "step_number",
            "status",
            "data",
            "tags",
            "updated_by",
            "updated_on",
        ]
        read_only_fields = ["id", "case_id", "partition_id", "step_number", "updated_by", "updated_on"]
