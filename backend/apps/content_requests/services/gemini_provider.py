"""
Google Gemini AI Provider Implementation

This module implements the AIProvider interface using Google's Gemini AI API.
It handles all Gemini-specific logic including API calls, response parsing,
error handling, retry logic, and automatic API key rotation.

Phase 4: Supports optional learning context for personalized generation.

API Key Rotation:
- Supports multiple API keys for automatic quota handling
- When one key exceeds quota, automatically switches to next available key
- Provides seamless experience without returning errors to users
- Configure multiple keys via GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.

Requirements:
- google-generativeai package
- GEMINI_API_KEY_1 (and optionally GEMINI_API_KEY_2, _3, _4...) environment variables
- Or single GEMINI_API_KEY for backward compatibility

Configuration:
- model: Gemini model to use (default: gemini-2.5-flash)
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
        api_key: str | list[str],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        retry_attempts: Optional[int] = None,
        **config
    ):
        """
        Initialize Gemini provider with configuration.
        
        Args:
            api_key: Google AI API key or list of API keys for rotation
            model: Gemini model name (default: gemini-1.5-flash)
            temperature: Generation temperature 0.0-1.0 (default: 0.7)
            max_tokens: Maximum response length (default: 2048)
            retry_attempts: Number of retry attempts (default: 3)
            **config: Additional configuration options
        """
        # Handle multiple API keys for rotation
        if isinstance(api_key, list):
            self.api_keys = api_key
            primary_key = api_key[0]
        else:
            self.api_keys = [api_key]
            primary_key = api_key
        
        super().__init__(primary_key, **config)
        
        # Configuration
        self.model_name = model or self.DEFAULT_MODEL
        self.temperature = temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        self.max_tokens = max_tokens or self.DEFAULT_MAX_TOKENS
        self.retry_attempts = retry_attempts or self.DEFAULT_RETRY_ATTEMPTS
        self.current_key_index = 0  # Track which API key is currently active
        
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
                f"temperature: {self.temperature}, max_tokens: {self.max_tokens}, "
                f"api_keys: {len(self.api_keys)}"
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize Gemini provider: {str(e)}")
            raise AIProviderAuthenticationError(
                "Failed to initialize Gemini API",
                provider="gemini",
                original_error=e
            )
    
    def _reconfigure_with_key(self, api_key: str) -> bool:
        """
        Reconfigure Gemini API with a different API key.
        
        Args:
            api_key: New API key to use
            
        Returns:
            True if reconfiguration successful, False otherwise
        """
        try:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(
                model_name=self.model_name,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            )
            self.api_key = api_key
            logger.info(f"Successfully switched to API key #{self.current_key_index + 1}")
            return True
        except Exception as e:
            logger.error(f"Failed to reconfigure with new API key: {str(e)}")
            return False
    
    def _call_api_with_retry(self, prompt: str) -> str:
        """
        Call Gemini API with retry logic for transient failures and automatic API key rotation.
        
        Args:
            prompt: Full prompt to send to API
            
        Returns:
            Generated text content
            
        Raises:
            AIProviderError: If all retry attempts fail with all available API keys
        """
        last_error = None
        keys_tried = set()  # Track which keys we've tried to avoid infinite loops
        
        for attempt in range(1, self.retry_attempts + 1):
            try:
                logger.debug(f"Gemini API call attempt {attempt}/{self.retry_attempts} with key #{self.current_key_index + 1}")
                
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
                    f"Gemini API call successful with key #{self.current_key_index + 1} "
                    f"(attempt {attempt}, length: {len(response.text)})"
                )
                
                return response.text
                
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                
                # Check for quota/rate limit errors - try switching API keys
                if "quota" in error_str or "rate limit" in error_str or "resource exhausted" in error_str:
                    logger.warning(f"Quota/Rate limit hit with key #{self.current_key_index + 1}: {str(e)}")
                    keys_tried.add(self.current_key_index)
                    
                    # Try switching to next API key if we have more keys available
                    if len(keys_tried) < len(self.api_keys):
                        # Find next untried key
                        original_index = self.current_key_index
                        for _ in range(len(self.api_keys)):
                            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
                            if self.current_key_index not in keys_tried:
                                break
                        
                        next_key = self.api_keys[self.current_key_index]
                        logger.info(f"Switching from key #{original_index + 1} to key #{self.current_key_index + 1}...")
                        
                        if self._reconfigure_with_key(next_key):
                            logger.info("API key switched successfully, retrying immediately...")
                            # Reset attempt counter for new key, but keep trying
                            continue
                        else:
                            logger.error("Failed to switch API key, marking as tried")
                            keys_tried.add(self.current_key_index)
                    
                    # If all keys exhausted, fail with rate limit error
                    if len(keys_tried) >= len(self.api_keys):
                        logger.error(f"All {len(self.api_keys)} API keys have exceeded their quota")
                        raise AIProviderRateLimitError(
                            f"All {len(self.api_keys)} Gemini API keys have exceeded their quota",
                            provider="gemini",
                            original_error=e
                        )
                    
                    # Wait before retry with same key
                    if attempt < self.retry_attempts:
                        wait_time = self.DEFAULT_RETRY_DELAY * (2 ** (attempt - 1))
                        logger.info(f"Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                
                # Check for authentication errors
                if "api key" in error_str or "authentication" in error_str or "invalid" in error_str:
                    logger.error(f"Authentication failed with key #{self.current_key_index + 1}")
                    keys_tried.add(self.current_key_index)
                    
                    # Try next key if available
                    if len(keys_tried) < len(self.api_keys):
                        original_index = self.current_key_index
                        for _ in range(len(self.api_keys)):
                            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
                            if self.current_key_index not in keys_tried:
                                break
                        
                        next_key = self.api_keys[self.current_key_index]
                        logger.info(f"Trying next key #{self.current_key_index + 1}...")
                        
                        if self._reconfigure_with_key(next_key):
                            continue
                    else:
                        raise AIProviderAuthenticationError(
                            f"All {len(self.api_keys)} API keys failed authentication",
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
