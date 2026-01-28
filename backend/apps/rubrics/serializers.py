"""
Serializers for RubricSet and QuestionRubric models.
Handles multi-question assessment rubrics.
"""

from rest_framework import serializers
from .models import RubricSet, QuestionRubric, RubricSetVersion
from .schemas import EvaluationRule
from pydantic import ValidationError as PydanticValidationError


class QuestionRubricSerializer(serializers.ModelSerializer):
    """Serializer for QuestionRubric model."""
    
    class Meta:
        model = QuestionRubric
        fields = [
            'id', 'question_number', 'question_text', 'max_marks',
            'evaluation_rules', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
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
                rule = EvaluationRule(**rule_data)
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
        evaluation_rules = data.get('evaluation_rules', [])
        max_marks = data.get('max_marks')
        
        if evaluation_rules and max_marks:
            rules_total = sum(rule.get('marks', 0) for rule in evaluation_rules)
            if rules_total > float(max_marks):
                raise serializers.ValidationError({
                    'evaluation_rules': f"Sum of rule marks ({rules_total}) exceeds question max marks ({max_marks})"
                })
        
        return data


class RubricSetVersionSerializer(serializers.ModelSerializer):
    """Serializer for RubricSetVersion model."""
    
    class Meta:
        model = RubricSetVersion
        fields = ['id', 'version_number', 'snapshot', 'created_at']
        read_only_fields = ['id', 'version_number', 'snapshot', 'created_at']


class RubricSetSerializer(serializers.ModelSerializer):
    """Serializer for RubricSet model with nested questions."""
    
    questions = QuestionRubricSerializer(many=True, required=False)
    versions = RubricSetVersionSerializer(many=True, read_only=True)
    
    class Meta:
        model = RubricSet
        fields = [
            'id', 'version', 'state', 'title', 'subject', 'total_marks',
            'metadata', 'questions', 'created_by', 'created_at',
            'updated_at', 'versions'
        ]
        read_only_fields = ['id', 'version', 'created_by', 'created_at', 'updated_at', 'versions']
    
    def validate(self, data):
        """Cross-field validation."""
        # No state restrictions - all rubric sets can be edited
        return data
    
    def create(self, validated_data):
        """Create RubricSet with nested questions."""
        questions_data = validated_data.pop('questions', [])
        rubric_set = RubricSet.objects.create(**validated_data)
        
        for question_data in questions_data:
            QuestionRubric.objects.create(rubric_set=rubric_set, **question_data)
        
        return rubric_set
    
    def update(self, instance, validated_data):
        """Update RubricSet with nested questions."""
        questions_data = validated_data.pop('questions', None)
        
        # Update rubric set fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update questions if provided
        if questions_data is not None:
            # Get existing questions by both ID and question_number
            existing_by_id = {q.id: q for q in instance.questions.all()}
            existing_by_number = {q.question_number: q for q in instance.questions.all()}
            
            # Track which questions are in the update
            updated_question_ids = set()
            
            for question_data in questions_data:
                question_id = question_data.get('id')
                question_number = question_data.get('question_number')
                
                question_to_update = None
                
                # Try to find existing question by ID first, then by question_number
                if question_id and question_id in existing_by_id:
                    question_to_update = existing_by_id[question_id]
                elif question_number and question_number in existing_by_number:
                    question_to_update = existing_by_number[question_number]
                
                if question_to_update:
                    # Update existing question
                    for attr, value in question_data.items():
                        if attr != 'id':
                            setattr(question_to_update, attr, value)
                    question_to_update.save()
                    updated_question_ids.add(question_to_update.id)
                else:
                    # Create new question
                    new_question = QuestionRubric.objects.create(
                        rubric_set=instance,
                        **{k: v for k, v in question_data.items() if k != 'id'}
                    )
                    updated_question_ids.add(new_question.id)
            
            # Delete questions that are no longer in the update
            for question_id, question in existing_by_id.items():
                if question_id not in updated_question_ids:
                    question.delete()
        
        return instance


class RubricSetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing rubric sets."""
    
    question_count = serializers.SerializerMethodField()
    
    class Meta:
        model = RubricSet
        fields = [
            'id', 'title', 'subject', 'state', 'version',
            'total_marks', 'question_count', 'created_at', 'updated_at'
        ]
    
    def get_question_count(self, obj):
        """Return the number of questions in this rubric set."""
        return obj.questions.count()


class RubricSetPublishSerializer(serializers.Serializer):
    """Serializer for publishing a rubric set."""
    
    def validate(self, data):
        """Validate that the rubric set is ready to be published."""
        rubric_set = self.context.get('rubric_set')
        
        if not rubric_set:
            raise serializers.ValidationError("Rubric set not found in context")
        
        # Check if there are any questions
        questions = rubric_set.questions.all()
        if not questions.exists():
            raise serializers.ValidationError(
                "Cannot publish: At least one question is required"
            )
        
        # Validate that sum of question max_marks equals total_marks
        questions_total = sum(float(q.max_marks) for q in questions)
        total_marks = float(rubric_set.total_marks)
        
        if abs(questions_total - total_marks) > 0.01:
            raise serializers.ValidationError(
                f"Cannot publish: Sum of question marks ({questions_total}) "
                f"must equal total marks ({total_marks})"
            )
        
        # Validate that each question has rules and rule marks equal max_marks
        for question in questions:
            if not question.evaluation_rules:
                raise serializers.ValidationError(
                    f"Cannot publish: Question {question.question_number} has no evaluation rules"
                )
            
            rules_total = sum(rule.get('marks', 0) for rule in question.evaluation_rules)
            question_max = float(question.max_marks)
            
            if abs(rules_total - question_max) > 0.01:
                raise serializers.ValidationError(
                    f"Cannot publish: Question {question.question_number} rule marks ({rules_total}) "
                    f"must equal question max marks ({question_max})"
                )
        
        return data
