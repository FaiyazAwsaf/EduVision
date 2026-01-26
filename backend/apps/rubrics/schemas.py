"""
Pydantic schemas for the Rubric Builder system.

This module defines the data models for creating, validating, and managing
evaluation rubrics for educational assessments.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class DifficultyLevel(str, Enum):
    """Difficulty level of a question."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuestionType(str, Enum):
    """Type of question in the rubric."""
    SHORT_ANSWER = "short_answer"
    LONG_ANSWER = "long_answer"
    NUMERICAL = "numerical"
    DERIVATION = "derivation"
    PROBLEM_SOLVING = "problem_solving"


class RuleType(str, Enum):
    """Type of evaluation rule."""
    KEYWORD = "keyword"
    NUMERIC = "numeric"
    STEPWISE = "stepwise"


class ScoringMode(str, Enum):
    """Scoring mode for keyword-based evaluation."""
    PROPORTIONAL = "proportional"
    ALL_OR_NOTHING = "all_or_nothing"


class RubricState(str, Enum):
    """State of the rubric lifecycle."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class RubricMetadata(BaseModel):
    """Metadata information for a rubric."""
    title: str = Field(..., min_length=1, max_length=500, description="Title of the rubric")
    subject: str = Field(..., min_length=1, max_length=100, description="Subject area")
    difficulty: DifficultyLevel = Field(..., description="Difficulty level of the question")
    question_type: QuestionType = Field(..., description="Type of question")
    created_by: str = Field(..., min_length=1, description="Creator/author identifier")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """Ensure tags are non-empty strings and remove duplicates."""
        cleaned_tags = [tag.strip() for tag in v if tag.strip()]
        return list(dict.fromkeys(cleaned_tags))  # Remove duplicates while preserving order


class QuestionContext(BaseModel):
    """Context and information about the question being evaluated."""
    text: str = Field(..., min_length=1, description="The question text")
    reference_answer: str = Field(..., min_length=1, description="Model/reference answer")
    total_marks: float = Field(..., gt=0, description="Total marks for the question")

    @field_validator('total_marks')
    @classmethod
    def validate_total_marks(cls, v: float) -> float:
        """Ensure total marks is positive and reasonable."""
        if v <= 0:
            raise ValueError("Total marks must be greater than 0")
        if v > 1000:
            raise ValueError("Total marks cannot exceed 1000")
        return round(v, 2)


class FeedbackMessages(BaseModel):
    """Feedback messages for different evaluation outcomes."""
    on_success: str = Field(default="Correct", description="Message when rule passes completely")
    on_failure: str = Field(default="Incorrect", description="Message when rule fails")
    on_partial: Optional[str] = Field(default=None, description="Message for partial credit")


class KeywordRuleConfig(BaseModel):
    """Configuration for keyword-based evaluation rules."""
    required_keywords: List[str] = Field(..., min_length=1, description="List of required keywords")
    scoring_mode: ScoringMode = Field(
        default=ScoringMode.PROPORTIONAL,
        description="How to score keyword matches"
    )

    @field_validator('required_keywords')
    @classmethod
    def validate_keywords(cls, v: List[str]) -> List[str]:
        """Ensure keywords are non-empty strings."""
        cleaned = [kw.strip() for kw in v if kw.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty keyword is required")
        return cleaned


class NumericRuleConfig(BaseModel):
    """Configuration for numeric evaluation rules."""
    expected_value: float = Field(..., description="The expected numeric answer")
    tolerance: float = Field(
        default=0.0,
        ge=0,
        description="Acceptable deviation from expected value"
    )

    @field_validator('tolerance')
    @classmethod
    def validate_tolerance(cls, v: float) -> float:
        """Ensure tolerance is non-negative."""
        if v < 0:
            raise ValueError("Tolerance cannot be negative")
        return round(v, 4)


class StepwiseRuleConfig(BaseModel):
    """Configuration for stepwise evaluation rules."""
    step_description: str = Field(
        ...,
        min_length=1,
        description="Description of the step being evaluated"
    )
    expected_patterns: List[str] = Field(
        ...,
        min_length=1,
        description="List of regex patterns to match in the step"
    )
    allow_partial_credit: bool = Field(
        default=True,
        description="Whether partial credit is allowed for this step"
    )

    @field_validator('expected_patterns')
    @classmethod
    def validate_patterns(cls, v: List[str]) -> List[str]:
        """Ensure patterns are non-empty strings and valid regex."""
        import re
        
        if not v:
            raise ValueError("At least one pattern is required")
        
        cleaned = []
        for pattern in v:
            if not pattern.strip():
                continue
            try:
                # Test if the pattern is valid regex
                re.compile(pattern)
                cleaned.append(pattern)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern '{pattern}': {str(e)}")
        
        if not cleaned:
            raise ValueError("At least one valid pattern is required")
        
        return cleaned


class EvaluationRule(BaseModel):
    """
    A single evaluation rule that defines how to assess part of a student's answer.
    
    The config field must match the appropriate schema based on rule type:
    - keyword: KeywordRuleConfig
    - numeric: NumericRuleConfig
    - stepwise: StepwiseRuleConfig
    """
    id: UUID = Field(default_factory=uuid4, description="Unique identifier for the rule")
    type: RuleType = Field(..., description="Type of evaluation rule")
    marks: float = Field(..., ge=0, description="Marks allocated to this rule")
    config: Dict = Field(..., description="Type-specific configuration (validated against type-specific schema)")
    feedback: FeedbackMessages = Field(default_factory=FeedbackMessages, description="Feedback messages")

    @field_validator('marks')
    @classmethod
    def validate_marks(cls, v: float) -> float:
        """Ensure marks is non-negative and reasonable."""
        if v < 0:
            raise ValueError("Marks cannot be negative")
        if v > 1000:
            raise ValueError("Marks per rule cannot exceed 1000")
        return round(v, 2)

    @field_validator('config')
    @classmethod
    def validate_config(cls, v: Dict, info) -> Dict:
        """Validate config structure against type-specific schema based on rule type."""
        rule_type = info.data.get('type')
        
        try:
            if rule_type == RuleType.KEYWORD:
                # Validate against KeywordRuleConfig schema
                validated = KeywordRuleConfig(**v)
                return validated.model_dump()
                
            elif rule_type == RuleType.NUMERIC:
                # Validate against NumericRuleConfig schema
                validated = NumericRuleConfig(**v)
                return validated.model_dump()
                
            elif rule_type == RuleType.STEPWISE:
                # Validate against StepwiseRuleConfig schema
                validated = StepwiseRuleConfig(**v)
                return validated.model_dump()
            
            else:
                raise ValueError(f"Unknown rule type: {rule_type}")
                
        except Exception as e:
            raise ValueError(f"Config validation failed for {rule_type} rule: {str(e)}")
        
        return v


class Rubric(BaseModel):
    """
    Complete rubric definition for evaluating a question.
    
    A rubric combines metadata, question context, and evaluation rules
    to provide a comprehensive assessment framework.
    """
    id: UUID = Field(default_factory=uuid4, description="Unique identifier for the rubric")
    version: int = Field(default=1, ge=1, description="Version number of the rubric")
    state: RubricState = Field(default=RubricState.DRAFT, description="Current state of the rubric")
    metadata: RubricMetadata = Field(..., description="Rubric metadata")
    question: QuestionContext = Field(..., description="Question being evaluated")
    evaluation_rules: List[EvaluationRule] = Field(..., min_length=1, description="List of evaluation rules")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")

    @field_validator('evaluation_rules')
    @classmethod
    def validate_evaluation_rules(cls, v: List[EvaluationRule], info) -> List[EvaluationRule]:
        """Ensure evaluation rules don't exceed total marks."""
        if not v:
            raise ValueError("At least one evaluation rule is required")
        
        # Check if we have access to question data
        if 'question' in info.data:
            total_marks = info.data['question'].total_marks
            rules_total = sum(rule.marks for rule in v)
            
            if rules_total > total_marks:
                raise ValueError(
                    f"Sum of rule marks ({rules_total}) exceeds total question marks ({total_marks})"
                )
        
        return v

    @field_validator('updated_at')
    @classmethod
    def validate_updated_at(cls, v: datetime, info) -> datetime:
        """Ensure updated_at is not before created_at."""
        created_at = info.data.get('created_at')
        if created_at and v < created_at:
            raise ValueError("updated_at cannot be before created_at")
        return v

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        use_enum_values = False
