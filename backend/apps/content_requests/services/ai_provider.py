"""
AI Provider Abstraction Layer

This module defines the interface for AI content generation providers.
It allows the system to be provider-agnostic and easily swap between
different AI engines (Gemini, OpenAI, Anthropic, etc.).

Design principles:
- Abstract base class defines the contract
- Concrete implementations handle provider-specific logic
- Errors are provider-agnostic (wrapped in domain exceptions)
- Providers are stateless and can be easily mocked for testing
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
import logging

from ..domain.content_request import ContentRequest
from ..domain.enums import ContentType, Style, Difficulty

logger = logging.getLogger(__name__)


@dataclass
class GeneratedContent:
    """
    Domain model for generated content.
    
    This is the result of AI generation, independent of any specific provider.
    It contains the raw content and metadata about the generation process.
    """
    content_text: str
    metadata: Dict[str, Any]
    
    def __post_init__(self):
        """Validate generated content."""
        if not self.content_text or not self.content_text.strip():
            raise ValueError("Generated content cannot be empty")
        
        if not isinstance(self.metadata, dict):
            raise ValueError("Metadata must be a dictionary")


class AIProviderError(Exception):
    """
    Base exception for AI provider errors.
    
    This wraps provider-specific errors into a generic exception
    that can be handled uniformly by the application.
    """
    
    def __init__(self, message: str, provider: str, original_error: Optional[Exception] = None):
        self.message = message
        self.provider = provider
        self.original_error = original_error
        super().__init__(self.message)


class AIProviderRateLimitError(AIProviderError):
    """Raised when API rate limit is exceeded."""
    pass


class AIProviderAuthenticationError(AIProviderError):
    """Raised when API authentication fails."""
    pass


class AIProvider(ABC):
    """
    Abstract base class for AI content generation providers.
    
    All AI providers must implement this interface to ensure consistency
    across different AI engines. This allows the system to be provider-agnostic.
    
    Implementations should:
    - Handle provider-specific API calls
    - Convert provider responses to GeneratedContent
    - Wrap provider errors in AIProviderError
    - Include retry logic for transient failures
    - Log all API interactions
    """
    
    def __init__(self, api_key: str, **config):
        """
        Initialize the AI provider.
        
        Args:
            api_key: API key for the provider
            **config: Additional provider-specific configuration
        """
        if not api_key or not api_key.strip():
            raise ValueError(f"API key is required for {self.__class__.__name__}")
        
        self.api_key = api_key
        self.config = config
        logger.info(f"Initialized {self.__class__.__name__} provider")
    
    @abstractmethod
    def generate_summary(self, request: ContentRequest) -> GeneratedContent:
        """
        Generate a summary for the given topic.
        
        Args:
            request: Content request domain model
            
        Returns:
            GeneratedContent with summary text and metadata
            
        Raises:
            AIProviderError: If generation fails
        """
        pass
    
    @abstractmethod
    def generate_worked_examples(self, request: ContentRequest) -> GeneratedContent:
        """
        Generate worked examples for the given topic.
        
        Args:
            request: Content request domain model
            
        Returns:
            GeneratedContent with worked examples and metadata
            
        Raises:
            AIProviderError: If generation fails
        """
        pass
    
    @abstractmethod
    def generate_formula_sheet(self, request: ContentRequest) -> GeneratedContent:
        """
        Generate a formula sheet for the given topic.
        
        Args:
            request: Content request domain model
            
        Returns:
            GeneratedContent with formulas and metadata
            
        Raises:
            AIProviderError: If generation fails
        """
        pass
    
    def generate_content(self, request: ContentRequest) -> GeneratedContent:
        """
        Main entry point for content generation.
        
        Routes to the appropriate generation method based on content type.
        
        Args:
            request: Content request domain model
            
        Returns:
            GeneratedContent with appropriate content and metadata
            
        Raises:
            AIProviderError: If generation fails
            ValueError: If content type is not supported
        """
        logger.info(
            f"Generating {request.content_type.value} content for topic: "
            f"{request.topic[:50]}..."
        )
        
        # Route to appropriate method based on content type
        if request.content_type == ContentType.SUMMARY:
            return self.generate_summary(request)
        elif request.content_type == ContentType.WORKED_EXAMPLES:
            return self.generate_worked_examples(request)
        elif request.content_type == ContentType.FORMULA_SHEET:
            return self.generate_formula_sheet(request)
        else:
            raise ValueError(f"Unsupported content type: {request.content_type}")
    
    def _build_system_prompt(self) -> str:
        """
        Build the system prompt for the AI model.
        
        This defines the AI's role and behavior guidelines.
        
        Returns:
            System prompt string
        """
        return (
            "You are an expert educational content generator. "
            "Your role is to create high-quality, accurate, and engaging educational content. "
            "Always prioritize clarity, accuracy, and pedagogical value. "
            "Adapt your response style based on the specified difficulty level and learning style."
        )
    
    def _build_user_prompt(
        self,
        topic: str,
        content_type: ContentType,
        style: Style,
        difficulty: Optional[Difficulty],
        notes: Optional[str]
    ) -> str:
        """
        Build the user prompt based on request parameters.
        
        Args:
            topic: Subject matter
            content_type: Type of content to generate
            style: Generation style preference
            difficulty: Optional difficulty level
            notes: Optional additional instructions
            
        Returns:
            User prompt string
        """
        # Base prompt
        prompt_parts = [f"Generate educational content about: {topic}"]
        
        # Add content type specific instructions
        if content_type == ContentType.SUMMARY:
            prompt_parts.append(
                "Provide a comprehensive summary that covers key concepts, "
                "important definitions, and main ideas."
            )
        elif content_type == ContentType.WORKED_EXAMPLES:
            prompt_parts.append(
                "Provide detailed worked examples with step-by-step solutions. "
                "Include explanations for each step and highlight key insights."
            )
        elif content_type == ContentType.FORMULA_SHEET:
            prompt_parts.append(
                "Create a formula sheet with relevant equations, formulas, and constants. "
                "Include brief descriptions of when to use each formula."
            )
        
        # Add style instructions
        if style == Style.BRIEF:
            prompt_parts.append("Keep the content concise and to-the-point.")
        elif style == Style.DETAILED:
            prompt_parts.append("Provide comprehensive, in-depth explanations with examples.")
        elif style == Style.STEP_BY_STEP:
            prompt_parts.append("Structure the content as a step-by-step guide with clear progression.")
        
        # Add difficulty level
        if difficulty:
            difficulty_map = {
                Difficulty.EASY: "beginner/introductory",
                Difficulty.MEDIUM: "intermediate",
                Difficulty.HARD: "advanced"
            }
            prompt_parts.append(
                f"Target difficulty level: {difficulty_map.get(difficulty, 'intermediate')}"
            )
        
        # Add custom notes
        if notes and notes.strip():
            prompt_parts.append(f"Additional requirements: {notes}")
        
        return "\n\n".join(prompt_parts)


def get_ai_provider(provider_name: str = "gemini", **config) -> AIProvider:
    """
    Factory function to get an AI provider instance.
    
    This allows easy switching between providers via configuration.
    
    Args:
        provider_name: Name of the provider ('gemini', 'openai', etc.)
        **config: Provider-specific configuration
        
    Returns:
        Configured AIProvider instance
        
    Raises:
        ValueError: If provider is not supported
    """
    if provider_name.lower() == "gemini":
        from .gemini_provider import GeminiProvider
        return GeminiProvider(**config)
    # Future providers can be added here
    # elif provider_name.lower() == "openai":
    #     from .openai_provider import OpenAIProvider
    #     return OpenAIProvider(**config)
    else:
        raise ValueError(f"Unsupported AI provider: {provider_name}")
