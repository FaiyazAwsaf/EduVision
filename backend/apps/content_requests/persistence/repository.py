"""
Repository pattern implementation for ContentRequest.

The repository layer abstracts data access and provides a clean interface
for the service layer. It handles:
- ORM to domain model mapping
- Database queries
- Transaction management

Extension points:
- Add caching layer (Redis) for frequently accessed requests
- Add pagination support for list operations
- Add filtering/search capabilities
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from ..models import ContentRequestModel
from ..domain.content_request import ContentRequest
from ..domain.enums import ContentType, Style, OutputFormat, Difficulty, RequestStatus
from ..domain.exceptions import InvalidStatusTransitionError


class ContentRequestRepository:
    """
    Repository for ContentRequest domain entities.
    
    This class provides data access methods and handles mapping between
    ORM models (ContentRequestModel) and domain models (ContentRequest).
    
    All business logic must be in the domain layer or service layer,
    not in this repository.
    """
    
    @staticmethod
    def _to_domain(model: ContentRequestModel) -> ContentRequest:
        """
        Convert ORM model to domain entity.
        
        Args:
            model: ContentRequestModel instance from database
            
        Returns:
            ContentRequest domain entity
        """
        return ContentRequest(
            id=model.id,
            topic=model.topic,
            content_type=ContentType(model.content_type),
            style=Style(model.style),
            output_format=OutputFormat(model.output_format),
            difficulty=Difficulty(model.difficulty) if model.difficulty else None,
            notes=model.notes,
            status=RequestStatus(model.status),
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
    
    @staticmethod
    def _to_model(domain: ContentRequest) -> ContentRequestModel:
        """
        Convert domain entity to ORM model.
        
        Args:
            domain: ContentRequest domain entity
            
        Returns:
            ContentRequestModel instance ready for persistence
        """
        return ContentRequestModel(
            id=domain.id,
            topic=domain.topic,
            content_type=domain.content_type.value,
            style=domain.style.value,
            output_format=domain.output_format.value,
            difficulty=domain.difficulty.value if domain.difficulty else None,
            notes=domain.notes,
            status=domain.status.value,
            created_at=domain.created_at,
            updated_at=domain.updated_at,
        )
    
    def create(self, request: ContentRequest) -> ContentRequest:
        """
        Persist a new content request.
        
        Args:
            request: ContentRequest domain entity to persist
            
        Returns:
            The persisted ContentRequest with updated timestamps
            
        Raises:
            django.db.IntegrityError: If constraint violation occurs
        """
        model = self._to_model(request)
        model.save()
        return self._to_domain(model)
    
    def get_by_id(self, request_id: UUID) -> Optional[ContentRequest]:
        """
        Retrieve a content request by ID.
        
        Args:
            request_id: UUID of the request
            
        Returns:
            ContentRequest if found, None otherwise
        """
        try:
            model = ContentRequestModel.objects.get(id=request_id)
            return self._to_domain(model)
        except ContentRequestModel.DoesNotExist:
            return None
    
    def list_all(self, limit: int = 100, offset: int = 0) -> List[ContentRequest]:
        """
        List all content requests with pagination.
        
        Args:
            limit: Maximum number of requests to return (default: 100)
            offset: Number of requests to skip (default: 0)
            
        Returns:
            List of ContentRequest entities
        """
        models = ContentRequestModel.objects.all()[offset:offset + limit]
        return [self._to_domain(model) for model in models]
    
    def list_by_status(
        self, 
        status: RequestStatus, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[ContentRequest]:
        """
        List content requests by status.
        
        Useful for workers to fetch pending requests or monitor processing.
        
        Args:
            status: Status to filter by
            limit: Maximum number of requests to return
            offset: Number of requests to skip
            
        Returns:
            List of ContentRequest entities with the specified status
        """
        models = ContentRequestModel.objects.filter(
            status=status.value
        ).order_by('created_at')[offset:offset + limit]
        return [self._to_domain(model) for model in models]
    
    def update_status(
        self, 
        request_id: UUID, 
        new_status: RequestStatus
    ) -> Optional[ContentRequest]:
        """
        Update the status of a content request.
        
        This method handles status transitions and validates business rules
        at the domain level.
        
        Args:
            request_id: UUID of the request
            new_status: New status to transition to
            
        Returns:
            Updated ContentRequest if successful, None if not found
            
        Raises:
            InvalidStatusTransitionError: If transition is not valid
        """
        try:
            model = ContentRequestModel.objects.get(id=request_id)
            current_domain = self._to_domain(model)
            
            # Use domain logic for validation
            updated_domain = current_domain.with_status(new_status)
            
            # Persist the change
            model.status = new_status.value
            model.updated_at = updated_domain.updated_at
            model.save(update_fields=['status', 'updated_at'])
            
            return updated_domain
        except ContentRequestModel.DoesNotExist:
            return None
    
    def count_by_status(self, status: RequestStatus) -> int:
        """
        Count requests by status.
        
        Useful for monitoring and analytics.
        
        Args:
            status: Status to count
            
        Returns:
            Number of requests with the specified status
        """
        return ContentRequestModel.objects.filter(status=status.value).count()
    
    def exists(self, request_id: UUID) -> bool:
        """
        Check if a request exists.
        
        Args:
            request_id: UUID of the request
            
        Returns:
            True if request exists, False otherwise
        """
        return ContentRequestModel.objects.filter(id=request_id).exists()
    
    def delete(self, request_id: UUID) -> bool:
        """
        Delete a content request.
        
        Note: In Phase 1, deletion is supported but should be used carefully.
        In future phases, consider soft deletion or archival instead.
        
        Args:
            request_id: UUID of the request
            
        Returns:
            True if deleted, False if not found
        """
        deleted_count, _ = ContentRequestModel.objects.filter(
            id=request_id
        ).delete()
        return deleted_count > 0
