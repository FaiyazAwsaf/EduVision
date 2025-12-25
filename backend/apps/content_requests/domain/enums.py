"""
Domain enums for content request system.

These enums represent valid values for content request fields.
They are designed to be reusable across multiple modules and phases.
"""
from enum import Enum


class ContentType(str, Enum):
    """
    Types of content that can be generated.
    
    Extensible for future content types like PRACTICE_PROBLEMS, LESSON_PLANS, etc.
    """
    SUMMARY = "SUMMARY"
    WORKED_EXAMPLES = "WORKED_EXAMPLES"
    FORMULA_SHEET = "FORMULA_SHEET"

    @classmethod
    def choices(cls):
        """Return Django-compatible choices for model fields."""
        return [(item.value, item.name) for item in cls]

    @classmethod
    def values(cls):
        """Return list of valid values."""
        return [item.value for item in cls]


class Style(str, Enum):
    """
    Content generation styles.
    
    Defines how detailed or structured the output should be.
    """
    BRIEF = "BRIEF"
    DETAILED = "DETAILED"
    STEP_BY_STEP = "STEP_BY_STEP"

    @classmethod
    def choices(cls):
        """Return Django-compatible choices for model fields."""
        return [(item.value, item.name) for item in cls]

    @classmethod
    def values(cls):
        """Return list of valid values."""
        return [item.value for item in cls]


class OutputFormat(str, Enum):
    """
    Output format for generated content.
    
    Extensible for future formats like HTML, MARKDOWN, SLIDES, etc.
    """
    TEXT = "TEXT"
    PDF = "PDF"
    WORKSHEET = "WORKSHEET"

    @classmethod
    def choices(cls):
        """Return Django-compatible choices for model fields."""
        return [(item.value, item.name) for item in cls]

    @classmethod
    def values(cls):
        """Return list of valid values."""
        return [item.value for item in cls]


class Difficulty(str, Enum):
    """
    Optional difficulty level for content.
    
    Can be used by AI generation in Phase 2 to adjust complexity.
    """
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"

    @classmethod
    def choices(cls):
        """Return Django-compatible choices for model fields."""
        return [(item.value, item.name) for item in cls]

    @classmethod
    def values(cls):
        """Return list of valid values."""
        return [item.value for item in cls]


class RequestStatus(str, Enum):
    """
    Request lifecycle status.
    
    Status transitions:
    - PENDING -> PROCESSING (when worker picks up the job)
    - PROCESSING -> COMPLETED (when generation succeeds)
    - PROCESSING -> FAILED (when generation fails)
    
    No other transitions are allowed.
    """
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

    @classmethod
    def choices(cls):
        """Return Django-compatible choices for model fields."""
        return [(item.value, item.name) for item in cls]

    @classmethod
    def values(cls):
        """Return list of valid values."""
        return [item.value for item in cls]

    @classmethod
    def is_valid_transition(cls, from_status: 'RequestStatus', to_status: 'RequestStatus') -> bool:
        """
        Validate status transitions according to business rules.
        
        Valid transitions:
        - PENDING -> PROCESSING
        - PROCESSING -> COMPLETED
        - PROCESSING -> FAILED
        - FAILED -> PENDING (for retry)
        
        Args:
            from_status: Current status
            to_status: Desired new status
            
        Returns:
            True if transition is valid, False otherwise
        """
        valid_transitions = {
            cls.PENDING: {cls.PROCESSING},
            cls.PROCESSING: {cls.COMPLETED, cls.FAILED},
            cls.COMPLETED: set(),  # Terminal state
            cls.FAILED: {cls.PENDING},  # Allow retry
        }
        return to_status in valid_transitions.get(from_status, set())
