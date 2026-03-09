"""
Domain exceptions for content request system.

These exceptions represent business rule violations and domain-level errors.
"""


class DomainException(Exception):
    """Base exception for all domain-level errors."""
    pass


class InvalidStatusTransitionError(DomainException):
    """Raised when attempting an invalid status transition."""
    
    def __init__(self, from_status: str, to_status: str):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Invalid status transition from {from_status} to {to_status}"
        )


class ValidationError(DomainException):
    """Raised when domain validation fails."""
    
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"Validation error for {field}: {message}")


class OffTopicError(DomainException):
    """Raised when AI detects the topic is not related to education."""

    def __init__(self, topic: str):
        self.topic = topic
        super().__init__(
            f"The topic '{topic[:80]}' is not related to academics or education. "
            "Please enter a study-related topic."
        )
