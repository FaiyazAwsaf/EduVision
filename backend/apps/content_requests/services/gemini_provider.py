"""
Google Gemini AI Provider Implementation

This module implements the AIProvider interface using Google's Gemini AI API.
It handles all Gemini-specific logic including API calls, response parsing,
error handling, and retry logic.

Phase 4: Supports optional learning context for personalized generation.

Requirements:
- google-generativeai package
- GEMINI_API_KEY environment variable

Configuration:
- model: Gemini model to use (default: gemini-1.5-flash)
- temperature: Creativity level (0.0 to 1.0)
- max_tokens: Maximum response length
- retry_attempts: Number of retry attempts for transient failures
"""
import logging
import time
from typing import Dict, Any, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from .ai_provider import (
    AIProvider,
    GeneratedContent,
    AIProviderError,
    AIProviderRateLimitError,
    AIProviderAuthenticationError
)
from .prompt_builder import build_system_prompt, build_context_aware_prompt
from ..domain.content_request import ContentRequest

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """
    Concrete implementation of AIProvider using Google Gemini.
    
    This provider handles:
    - API authentication and configuration
    - Prompt construction for different content types
    - Response parsing and validation
    - Error handling with retries
    - Rate limit management
    
    Safety settings are configured to allow educational content while
    blocking harmful content.
    """
    
    # Default configuration
    DEFAULT_MODEL = "gemini-2.5-flash"
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 8192
    DEFAULT_RETRY_ATTEMPTS = 3
    DEFAULT_RETRY_DELAY = 2  # seconds
    
    def __init__(
        self,
        api_key: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        retry_attempts: Optional[int] = None,
        **config
    ):
        """
        Initialize Gemini provider with configuration.
        
        Args:
            api_key: Google AI API key
            model: Gemini model name (default: gemini-1.5-flash)
            temperature: Generation temperature 0.0-1.0 (default: 0.7)
            max_tokens: Maximum response length (default: 2048)
            retry_attempts: Number of retry attempts (default: 3)
            **config: Additional configuration options
        """
        super().__init__(api_key, **config)
        
        # Configuration
        self.model_name = model or self.DEFAULT_MODEL
        self.temperature = temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        self.max_tokens = max_tokens or self.DEFAULT_MAX_TOKENS
        self.retry_attempts = retry_attempts or self.DEFAULT_RETRY_ATTEMPTS
        
        # Configure Gemini API
        try:
            genai.configure(api_key=self.api_key)
            
            # Initialize model with safety settings
            self.model = genai.GenerativeModel(
                model_name=self.model_name,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            )
            
            logger.info(
                f"Initialized Gemini provider with model: {self.model_name}, "
                f"temperature: {self.temperature}, max_tokens: {self.max_tokens}"
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize Gemini provider: {str(e)}")
            raise AIProviderAuthenticationError(
                "Failed to initialize Gemini API",
                provider="gemini",
                original_error=e
            )
    
    def _call_api_with_retry(self, prompt: str) -> str:
        """
        Call Gemini API with retry logic for transient failures.
        
        Args:
            prompt: Full prompt to send to API
            
        Returns:
            Generated text content
            
        Raises:
            AIProviderError: If all retry attempts fail
        """
        last_error = None
        
        for attempt in range(1, self.retry_attempts + 1):
            try:
                logger.debug(f"Gemini API call attempt {attempt}/{self.retry_attempts}")
                
                # Generate content
                response = self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=self.temperature,
                        max_output_tokens=self.max_tokens,
                    )
                )
                
                # Extract text from response
                if not response.text:
                    raise AIProviderError(
                        "Gemini returned empty response",
                        provider="gemini"
                    )
                
                logger.info(
                    f"Gemini API call successful "
                    f"(attempt {attempt}, length: {len(response.text)})"
                )
                
                return response.text
                
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                
                # Check for rate limit errors
                if "quota" in error_str or "rate limit" in error_str:
                    logger.warning(f"Rate limit hit on attempt {attempt}: {str(e)}")
                    if attempt < self.retry_attempts:
                        # Exponential backoff
                        wait_time = self.DEFAULT_RETRY_DELAY * (2 ** (attempt - 1))
                        logger.info(f"Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                    raise AIProviderRateLimitError(
                        "Gemini API rate limit exceeded",
                        provider="gemini",
                        original_error=e
                    )
                
                # Check for authentication errors
                if "api key" in error_str or "authentication" in error_str:
                    raise AIProviderAuthenticationError(
                        "Gemini API authentication failed",
                        provider="gemini",
                        original_error=e
                    )
                
                # For other errors, retry with backoff
                logger.warning(f"Gemini API error on attempt {attempt}: {str(e)}")
                if attempt < self.retry_attempts:
                    wait_time = self.DEFAULT_RETRY_DELAY * attempt
                    logger.info(f"Retrying after {wait_time}s...")
                    time.sleep(wait_time)
                    continue
        
        # All retries failed
        raise AIProviderError(
            f"Gemini API failed after {self.retry_attempts} attempts",
            provider="gemini",
            original_error=last_error
        )
    
    def generate_summary(self, request: ContentRequest, learning_context: Optional[object] = None) -> GeneratedContent:
        """
        Generate a summary using Gemini with optional learning context (Phase 4).
        
        Args:
            request: Content request domain model
            learning_context: Optional LearningContextModel for personalization
            
        Returns:
            GeneratedContent with summary and metadata
            
        Phase 4: Accepts manual learning context to personalize prompts.
        Gracefully degrades if context is not provided.
        """
        logger.info(f"Generating summary for topic: {request.topic[:50]}...")
        if learning_context:
            logger.info("Using learning context for personalization")
        
        # Build prompts with context awareness
        system_prompt = build_system_prompt()
        user_prompt = build_context_aware_prompt(request, learning_context)
        
        # Combine prompts
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        # Call API
        content_text = self._call_api_with_retry(full_prompt)
        
        # Build metadata
        metadata = {
            "provider": "gemini",
            "model": self.model_name,
            "temperature": self.temperature,
            "content_type": request.content_type.value,
            "style": request.style.value,
            "difficulty": request.difficulty.value if request.difficulty else None,
            "prompt_length": len(full_prompt),
            "response_length": len(content_text),
            "has_learning_context": learning_context is not None  # Phase 4
        }
        
        return GeneratedContent(
            content_text=content_text,
            metadata=metadata
        )
    
    def generate_worked_examples(self, request: ContentRequest, learning_context: Optional[object] = None) -> GeneratedContent:
        """
        Generate worked examples using Gemini with optional learning context (Phase 4).
        
        Args:
            request: Content request domain model
            learning_context: Optional LearningContextModel for personalization
            
        Returns:
            GeneratedContent with examples and metadata
        """
        logger.info(f"Generating worked examples for topic: {request.topic[:50]}...")
        if learning_context:
            logger.info("Using learning context for personalization")
        
        # Build prompts with context awareness
        system_prompt = build_system_prompt()
        user_prompt = build_context_aware_prompt(request, learning_context)
        
        # Combine prompts
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        # Call API
        content_text = self._call_api_with_retry(full_prompt)
        
        # Build metadata
        metadata = {
            "provider": "gemini",
            "model": self.model_name,
            "temperature": self.temperature,
            "content_type": request.content_type.value,
            "style": request.style.value,
            "difficulty": request.difficulty.value if request.difficulty else None,
            "prompt_length": len(full_prompt),
            "response_length": len(content_text),
            "has_learning_context": learning_context is not None
        }
        
        return GeneratedContent(
            content_text=content_text,
            metadata=metadata
        )
    
    def generate_formula_sheet(self, request: ContentRequest, learning_context: Optional[object] = None) -> GeneratedContent:
        """
        Generate a formula sheet using Gemini with optional learning context (Phase 4).
        
        Args:
            request: Content request domain model
            learning_context: Optional LearningContextModel for personalization
            
        Returns:
            GeneratedContent with formulas and metadata
        """
        logger.info(f"Generating formula sheet for topic: {request.topic[:50]}...")
        if learning_context:
            logger.info("Using learning context for personalization")
        
        # Build prompts with context awareness
        system_prompt = build_system_prompt()
        user_prompt = build_context_aware_prompt(request, learning_context)
        
        # Combine prompts
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        # Call API
        content_text = self._call_api_with_retry(full_prompt)
        
        # Build metadata
        metadata = {
            "provider": "gemini",
            "model": self.model_name,
            "temperature": self.temperature,
            "content_type": request.content_type.value,
            "style": request.style.value,
            "difficulty": request.difficulty.value if request.difficulty else None,
            "prompt_length": len(full_prompt),
            "response_length": len(content_text),
            "has_learning_context": learning_context is not None
        }
        
        return GeneratedContent(
            content_text=content_text,
            metadata=metadata
        )
