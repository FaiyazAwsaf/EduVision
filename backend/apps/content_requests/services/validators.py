"""
Input validation for content request system.

This module provides validation functions for request data before it reaches
the domain layer. It performs:
- Type checking
- Format validation
- Business rule validation

Validation happens at the service boundary to fail fast with meaningful errors.
"""
from typing import Dict, Any, List, Optional

from ..domain.enums import ContentType, Style, OutputFormat, Difficulty


class ValidationError(Exception):
    """Raised when validation fails."""
    
    def __init__(self, errors: Dict[str, List[str]]):
        """
        Initialize validation error with field-level errors.
        
        Args:
            errors: Dictionary mapping field names to list of error messages
        """
        self.errors = errors
        super().__init__(f"Validation failed: {errors}")
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert to dictionary for API responses.
        
        Returns:
            Dictionary with errors and detail fields
        """
        return {
            "errors": self.errors,
            "detail": "Validation failed"
        }


class ContentRequestValidator:
    """
    Validator for content request data.
    
    This class validates incoming request data before creating domain entities.
    It ensures data integrity and provides meaningful error messages.
    """
    
    @staticmethod
    def validate_create_request(data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Validate data for creating a new content request.
        
        Args:
            data: Dictionary containing request data
            
        Returns:
            Dictionary of validation errors (empty if valid)
        """
        errors = {}
        
        # Validate topic
        if 'topic' not in data or not data['topic']:
            errors['topic'] = ['Topic is required']
        elif not isinstance(data['topic'], str):
            errors['topic'] = ['Topic must be a string']
        elif not data['topic'].strip():
            errors['topic'] = ['Topic cannot be empty']
        elif len(data['topic']) > 500:
            errors['topic'] = ['Topic must not exceed 500 characters']
        
        # Validate content_type
        if 'content_type' not in data:
            errors['content_type'] = ['Content type is required']
        elif data['content_type'] not in ContentType.values():
            errors['content_type'] = [
                f'Invalid content type. Must be one of: {", ".join(ContentType.values())}'
            ]
        
        # Validate style
        if 'style' not in data:
            errors['style'] = ['Style is required']
        elif data['style'] not in Style.values():
            errors['style'] = [
                f'Invalid style. Must be one of: {", ".join(Style.values())}'
            ]
        
        # Validate output_format
        if 'output_format' not in data:
            errors['output_format'] = ['Output format is required']
        elif data['output_format'] not in OutputFormat.values():
            errors['output_format'] = [
                f'Invalid output format. Must be one of: {", ".join(OutputFormat.values())}'
            ]
        
        # Validate difficulty (optional)
        if 'difficulty' in data and data['difficulty'] is not None:
            if data['difficulty'] not in Difficulty.values():
                errors['difficulty'] = [
                    f'Invalid difficulty. Must be one of: {", ".join(Difficulty.values())}'
                ]
        
        # Validate notes (optional)
        if 'notes' in data and data['notes'] is not None:
            if not isinstance(data['notes'], str):
                errors['notes'] = ['Notes must be a string']
            elif len(data['notes']) > 2000:
                errors['notes'] = ['Notes must not exceed 2000 characters']
        
        return errors
    
    @staticmethod
    def validate_and_raise(data: Dict[str, Any]) -> None:
        """
        Validate data and raise ValidationError if invalid.
        
        Args:
            data: Dictionary containing request data
            
        Raises:
            ValidationError: If validation fails
        """
        errors = ContentRequestValidator.validate_create_request(data)
        if errors:
            raise ValidationError(errors)
    
    @staticmethod
    def validate_uuid(value: Any) -> Optional[str]:
        """
        Validate and normalize UUID value.
        
        Args:
            value: Value to validate as UUID
            
        Returns:
            Normalized UUID string or None if invalid
        """
        if value is None:
            return None
        
        try:
            from uuid import UUID
            # Convert to UUID and back to ensure valid format
            uuid_obj = UUID(str(value))
            return str(uuid_obj)
        except (ValueError, AttributeError):
            return None
    
    @staticmethod
    def sanitize_input(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize input data by removing unknown fields and normalizing values.
        
        This prevents injection of unexpected fields into the domain model.
        
        Args:
            data: Raw input data
            
        Returns:
            Sanitized data with only known fields
        """
        allowed_fields = {
            'topic', 'content_type', 'style', 'output_format', 
            'difficulty', 'notes'
        }
        
        sanitized = {}
        for field in allowed_fields:
            if field in data:
                value = data[field]
                # Strip whitespace from string fields
                if isinstance(value, str):
                    value = value.strip()
                # Convert empty strings to None for optional fields
                if value == '' and field in {'difficulty', 'notes'}:
                    value = None
                sanitized[field] = value
        
        return sanitized
