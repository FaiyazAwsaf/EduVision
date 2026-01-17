from rest_framework import serializers
from .models import Rubric, RubricVersion
from .schemas import (
    RubricMetadata, QuestionContext, EvaluationRule,
    RuleType, DifficultyLevel, QuestionType
)
from pydantic import ValidationError as PydanticValidationError
import uuid


class RubricVersionSerializer(serializers.ModelSerializer):
    """Serializer for RubricVersion model."""
    
    class Meta:
        model = RubricVersion
        fields = ['id', 'version_number', 'snapshot', 'created_at']
        read_only_fields = ['id', 'version_number', 'snapshot', 'created_at']


class RubricSerializer(serializers.ModelSerializer):
    """Serializer for Rubric model with Pydantic validation."""
    
    versions = RubricVersionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Rubric
        fields = [
            'id', 'version', 'state', 'title', 'subject',
            'question_text', 'reference_answer', 'total_marks',
            'evaluation_rules', 'created_by', 'created_at',
            'updated_at', 'versions'
        ]
        read_only_fields = ['id', 'version', 'created_by', 'created_at', 'updated_at', 'versions']
    
    def validate_evaluation_rules(self, value):
        """Validate evaluation rules using Pydantic schemas."""
        if not isinstance(value, list):
            raise serializers.ValidationError("evaluation_rules must be a list")
        
        if not value:
            raise serializers.ValidationError("At least one evaluation rule is required")
        
        validated_rules = []
        total_rule_marks = 0
        
        for idx, rule_data in enumerate(value):
            try:
                # Validate each rule using Pydantic EvaluationRule schema
                rule = EvaluationRule(**rule_data)
                # Use mode='json' to properly serialize UUID and other special types
                validated_rules.append(rule.model_dump(mode='json'))
                total_rule_marks += rule.marks
            except PydanticValidationError as e:
                raise serializers.ValidationError(
                    f"Rule {idx + 1} validation error: {str(e)}"
                )
            except Exception as e:
                raise serializers.ValidationError(
                    f"Rule {idx + 1} error: {str(e)}"
                )
        
        return validated_rules
    
    def validate(self, data):
        """Cross-field validation."""
        # Check if evaluation rules total doesn't exceed total marks
        evaluation_rules = data.get('evaluation_rules', [])
        total_marks = data.get('total_marks')
        
        if evaluation_rules and total_marks:
            rules_total = sum(rule.get('marks', 0) for rule in evaluation_rules)
            if rules_total > float(total_marks):
                raise serializers.ValidationError({
                    'evaluation_rules': f"Sum of rule marks ({rules_total}) exceeds total marks ({total_marks})"
                })
        
        # Validate state transitions
        if self.instance:  # Update operation
            current_state = self.instance.state
            new_state = data.get('state', current_state)
            
            # Enforce that published rubrics cannot be edited (except state change to archived)
            if current_state == Rubric.STATE_PUBLISHED:
                # Only allow state change to archived
                if new_state == Rubric.STATE_ARCHIVED:
                    # When archiving, don't allow other field changes
                    allowed_fields = {'state'}
                    changed_fields = set(data.keys()) - {'state'}
                    if changed_fields:
                        raise serializers.ValidationError(
                            "Published rubrics can only be archived. No other changes allowed."
                        )
                else:
                    raise serializers.ValidationError(
                        "Published rubrics cannot be modified. They can only be archived."
                    )
            
            # Draft can transition to published
            if current_state == Rubric.STATE_DRAFT and new_state == Rubric.STATE_PUBLISHED:
                pass  # Allowed
            
            # Archived rubrics cannot be modified at all
            if current_state == Rubric.STATE_ARCHIVED:
                raise serializers.ValidationError(
                    "Archived rubrics cannot be modified."
                )
        
        return data
    
    def create(self, validated_data):
        """Create a new rubric."""
        # Ensure created_by is set from the request user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user.id
        
        # Ensure state is draft for new rubrics
        validated_data['state'] = Rubric.STATE_DRAFT
        
        return super().create(validated_data)


class RubricListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing rubrics."""
    
    class Meta:
        model = Rubric
        fields = [
            'id', 'version', 'state', 'title', 'subject',
            'total_marks', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = fields


class RubricPublishSerializer(serializers.ModelSerializer):
    """Serializer for publishing a rubric."""
    
    class Meta:
        model = Rubric
        fields = ['state']
    
    def validate_state(self, value):
        """Ensure only valid state transitions."""
        if value != Rubric.STATE_PUBLISHED:
            raise serializers.ValidationError("This endpoint only publishes rubrics.")
        
        if self.instance.state != Rubric.STATE_DRAFT:
            raise serializers.ValidationError("Only draft rubrics can be published.")
        
        return value
