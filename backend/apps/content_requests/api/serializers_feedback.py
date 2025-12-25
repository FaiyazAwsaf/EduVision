"""
Feedback Serializers - Phase 3

Data validation and transformation for feedback API.
"""
from rest_framework import serializers
from ..models import FeedbackModel, DifficultyRating


class FeedbackSerializer(serializers.ModelSerializer):
    """
    Serializer for feedback submission and retrieval.
    
    Validation:
    - Usefulness rating must be 1-5
    - Difficulty rating must be valid enum value
    - Correctness flag is required
    - Optional fields can be empty
    """
    
    # Read-only fields
    id = serializers.UUIDField(read_only=True)
    submitted_at = serializers.DateTimeField(read_only=True)
    generated_content_id = serializers.UUIDField(source='generated_content.id', read_only=True)
    
    # Write fields
    usefulness_rating = serializers.IntegerField(
        min_value=1,
        max_value=5,
        help_text="How useful was this content? (1-5)"
    )
    
    difficulty_rating = serializers.ChoiceField(
        choices=DifficultyRating.choices,
        help_text="Was the difficulty level appropriate?"
    )
    
    correctness_flag = serializers.BooleanField(
        help_text="Was the content factually correct?"
    )
    
    missing_topics = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=2000,
        help_text="Topics that should have been included (optional)"
    )
    
    freeform_comment = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=5000,
        help_text="Additional feedback or suggestions (optional)"
    )
    
    class Meta:
        model = FeedbackModel
        fields = [
            'id',
            'generated_content_id',
            'usefulness_rating',
            'difficulty_rating',
            'correctness_flag',
            'missing_topics',
            'freeform_comment',
            'submitted_at'
        ]
        read_only_fields = ['id', 'generated_content_id', 'submitted_at']
    
    def validate_usefulness_rating(self, value):
        """Validate usefulness rating is in valid range"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError(
                "Usefulness rating must be between 1 and 5"
            )
        return value
    
    def validate_difficulty_rating(self, value):
        """Validate difficulty rating is a valid choice"""
        valid_choices = [choice[0] for choice in DifficultyRating.choices]
        if value not in valid_choices:
            raise serializers.ValidationError(
                f"Difficulty rating must be one of: {', '.join(valid_choices)}"
            )
        return value


class FeedbackCreateSerializer(serializers.Serializer):
    """
    Serializer for feedback creation requests.
    
    This is separate from FeedbackSerializer to avoid exposing
    the generated_content foreign key in the request body.
    The content ID comes from the URL path.
    """
    
    usefulness_rating = serializers.IntegerField(
        min_value=1,
        max_value=5,
        help_text="How useful was this content? (1-5)"
    )
    
    difficulty_rating = serializers.ChoiceField(
        choices=DifficultyRating.choices,
        help_text="Was the difficulty level appropriate?"
    )
    
    correctness_flag = serializers.BooleanField(
        help_text="Was the content factually correct?"
    )
    
    missing_topics = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=2000,
        help_text="Topics that should have been included (optional)"
    )
    
    freeform_comment = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=5000,
        help_text="Additional feedback or suggestions (optional)"
    )
    
    def validate_usefulness_rating(self, value):
        """Validate usefulness rating is in valid range"""
        if not 1 <= value <= 5:
            raise serializers.ValidationError(
                "Usefulness rating must be between 1 and 5"
            )
        return value
