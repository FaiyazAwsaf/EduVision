from rest_framework import serializers
from .models import StudentPerformanceSnapshot, MisconceptionRecord


class StudentPerformanceSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentPerformanceSnapshot
        fields = [
            "id",
            "subject",
            "assessment_title",
            "total_score",
            "max_score",
            "percentage",
            "question_breakdown",
            "timestamp",
        ]


class MisconceptionRecordSerializer(serializers.ModelSerializer):
    misconception_type_display = serializers.CharField(
        source="get_misconception_type_display", read_only=True
    )
    question_number = serializers.IntegerField(
        source="question_rubric.question_number", read_only=True
    )

    class Meta:
        model = MisconceptionRecord
        fields = [
            "id",
            "question_number",
            "misconception_type",
            "misconception_type_display",
            "description",
            "frequency",
            "percentage_affected",
            "example_answers",
            "timestamp",
        ]
