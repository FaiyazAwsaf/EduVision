"""
Content Request domain model.

This is the core business entity representing a user's content generation intent.
It is immutable after creation and contains business rules for validation and state transitions.

Extension points:
- Additional fields can be added for future features (e.g., user_id, metadata)
- Custom validation rules can be extended
- Status transition logic is centralized for consistent behavior
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from .enums import ContentType, Style, OutputFormat, Difficulty, RequestStatus
from .exceptions import InvalidStatusTransitionError


@dataclass(frozen=True)
class ContentRequest:
    """
    Immutable domain model for a content generation request.
    
    This model represents the user's intent and is independent of infrastructure.
    Once created, the request cannot be modified except for status updates
    (which create new instances).
    
    Attributes:
        id: Unique identifier for the request
        topic: Subject matter for content generation (required)
        content_type: Type of content to generate (required)
        style: Generation style preference (required)
        output_format: Desired output format (required)
        difficulty: Optional difficulty level
        notes: Optional additional instructions or context
        status: Current lifecycle status (system-managed)
        created_at: Timestamp of creation
        updated_at: Timestamp of last update
    """
    
    # Required fields
    topic: str
    content_type: ContentType
    style: Style
    output_format: OutputFormat
    
    # System-managed fields
    id: UUID = field(default_factory=uuid4)
    status: RequestStatus = field(default=RequestStatus.PENDING)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # Optional fields
    difficulty: Optional[Difficulty] = None
    notes: Optional[str] = None
    
    def __post_init__(self):
        """
        Validate invariants after initialization.
        
        This ensures domain rules are enforced at creation time.
        """
        self._validate()
    
    def _validate(self):
        """
        Validate business rules.
        
        Raises:
            ValueError: If validation fails
        """
        if not self.topic or not self.topic.strip():
            raise ValueError("Topic is required and cannot be empty")
        
        if len(self.topic) > 500:
            raise ValueError("Topic must not exceed 500 characters")
        
        if self.notes and len(self.notes) > 2000:
            raise ValueError("Notes must not exceed 2000 characters")
    
    def with_status(self, new_status: RequestStatus) -> 'ContentRequest':
        """
        Create a new instance with updated status.
        
        Since the model is immutable, this returns a new instance with the
        updated status and updated_at timestamp.
        
        Args:
            new_status: The new status to transition to
            
        Returns:
            A new ContentRequest instance with updated status
            
        Raises:
            InvalidStatusTransitionError: If the transition is not valid
        """
        if not RequestStatus.is_valid_transition(self.status, new_status):
            raise InvalidStatusTransitionError(
                from_status=self.status.value,
                to_status=new_status.value
            )
        
        # Create new instance with updated fields
        # We need to work around frozen=True by using object.__setattr__
        from copy import copy
        new_instance = copy(self)
        object.__setattr__(new_instance, 'status', new_status)
        object.__setattr__(new_instance, 'updated_at', datetime.utcnow())
        return new_instance
    
    def to_dict(self) -> dict:
        """
        Convert to dictionary representation.
        
        Useful for serialization and debugging.
        
        Returns:
            Dictionary representation of the request
        """
        return {
            'id': str(self.id),
            'topic': self.topic,
            'content_type': self.content_type.value,
            'style': self.style.value,
            'output_format': self.output_format.value,
            'difficulty': self.difficulty.value if self.difficulty else None,
            'notes': self.notes,
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
    
    def is_terminal_state(self) -> bool:
        """
        Check if request is in a terminal state.
        
        Terminal states are COMPLETED or FAILED, meaning no further
        processing should occur.
        
        Returns:
            True if in terminal state, False otherwise
        """
        return self.status in {RequestStatus.COMPLETED, RequestStatus.FAILED}
    
    def can_be_processed(self) -> bool:
        """
        Check if request can be picked up for processing.
        
        Returns:
            True if status is PENDING, False otherwise
        """
        return self.status == RequestStatus.PENDING
