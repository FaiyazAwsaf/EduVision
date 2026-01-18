"""
Base classes and common structures for estimator interfaces.

These provide the foundation for all intelligence estimators,
ensuring consistent behavior and enabling future ML swaps.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Generic, TypeVar, Optional
from uuid import UUID

# Type variable for estimator results
T = TypeVar('T')


@dataclass
class EstimatorConfig:
    """
    Configuration for an estimator.
    
    This allows estimators to be configured without code changes,
    enabling A/B testing and gradual rollout of new strategies.
    
    Attributes:
        name: Human-readable name
        version: Version string for tracking
        parameters: Configurable parameters
        enabled: Whether this estimator is active
        fallback_value: Value to use if estimation fails
        
    Example:
        >>> config = EstimatorConfig(
        ...     name="RuleBased Difficulty Estimator",
        ...     version="1.0.0",
        ...     parameters={
        ...         "retry_weight": 0.4,
        ...         "time_weight": 0.3,
        ...         "completion_weight": 0.3
        ...     }
        ... )
    """
    name: str
    version: str
    parameters: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    fallback_value: Optional[Any] = None
    
    def get_param(self, key: str, default: Any = None) -> Any:
        """Get a configuration parameter with a default."""
        return self.parameters.get(key, default)


@dataclass
class EstimatorResult(Generic[T]):
    """
    Result of an estimation operation.
    
    Wraps the estimated value with metadata for explainability
    and debugging.
    
    Attributes:
        value: The estimated value
        confidence: Confidence in the estimate (0.0 to 1.0)
        explanation: Human-readable explanation
        factors: Contributing factors and their weights
        computed_at: When the estimate was made
        estimator_name: Which estimator produced this
        estimator_version: Version of the estimator
        raw_inputs: Input data summary (for debugging)
        
    Example:
        >>> result = EstimatorResult(
        ...     value=0.75,
        ...     confidence=0.82,
        ...     explanation="High difficulty due to 3 retries and 45min avg time",
        ...     factors={"retry_factor": 0.3, "time_factor": 0.25, "completion_factor": 0.2},
        ...     computed_at=datetime.now(),
        ...     estimator_name="RuleBased Difficulty Estimator",
        ...     estimator_version="1.0.0"
        ... )
    """
    value: T
    confidence: float
    explanation: str
    factors: dict[str, float]
    computed_at: datetime
    estimator_name: str
    estimator_version: str
    raw_inputs: dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate result data."""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"confidence must be between 0.0 and 1.0, got {self.confidence}")
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'value': self.value if not hasattr(self.value, 'value') else self.value.value,
            'confidence': self.confidence,
            'explanation': self.explanation,
            'factors': self.factors,
            'computed_at': self.computed_at.isoformat(),
            'estimator_name': self.estimator_name,
            'estimator_version': self.estimator_version,
        }


class BaseEstimator(ABC, Generic[T]):
    """
    Abstract base class for all intelligence estimators.
    
    This defines the contract that all estimators must follow,
    enabling seamless swapping between rule-based and ML implementations.
    
    Type Parameters:
        T: The type of value this estimator produces
        
    Contract:
        - Estimators must be deterministic for same inputs
        - Estimators must provide explanations
        - Estimators must report confidence
        - Estimators must be configurable
    """
    
    def __init__(self, config: Optional[EstimatorConfig] = None):
        """
        Initialize the estimator.
        
        Args:
            config: Optional configuration override
        """
        self._config = config or self._default_config()
    
    @property
    def config(self) -> EstimatorConfig:
        """Get the estimator configuration."""
        return self._config
    
    @property
    def name(self) -> str:
        """Get the estimator name."""
        return self._config.name
    
    @property
    def version(self) -> str:
        """Get the estimator version."""
        return self._config.version
    
    @property
    def is_enabled(self) -> bool:
        """Check if the estimator is enabled."""
        return self._config.enabled
    
    @abstractmethod
    def _default_config(self) -> EstimatorConfig:
        """
        Get the default configuration for this estimator.
        
        Subclasses must implement this to provide sensible defaults.
        """
        pass
    
    @abstractmethod
    def estimate(self, *args, **kwargs) -> EstimatorResult[T]:
        """
        Perform the estimation.
        
        Subclasses must implement this with their specific logic.
        The signature may vary by estimator type.
        
        Returns:
            EstimatorResult containing the estimate and metadata
        """
        pass
    
    def _create_result(
        self,
        value: T,
        confidence: float,
        explanation: str,
        factors: dict[str, float],
        raw_inputs: Optional[dict[str, Any]] = None
    ) -> EstimatorResult[T]:
        """
        Helper to create a properly formatted result.
        
        Args:
            value: The estimated value
            confidence: Confidence level (0.0 to 1.0)
            explanation: Human-readable explanation
            factors: Contributing factors
            raw_inputs: Optional input summary
            
        Returns:
            Properly formatted EstimatorResult
        """
        return EstimatorResult(
            value=value,
            confidence=confidence,
            explanation=explanation,
            factors=factors,
            computed_at=datetime.now(),
            estimator_name=self.name,
            estimator_version=self.version,
            raw_inputs=raw_inputs or {},
        )
    
    def _fallback_result(self, reason: str) -> EstimatorResult[T]:
        """
        Create a fallback result when estimation fails.
        
        Args:
            reason: Why the estimation failed
            
        Returns:
            EstimatorResult with fallback value
        """
        if self._config.fallback_value is None:
            raise ValueError(f"Estimation failed and no fallback configured: {reason}")
        
        return EstimatorResult(
            value=self._config.fallback_value,
            confidence=0.0,
            explanation=f"Fallback value used: {reason}",
            factors={},
            computed_at=datetime.now(),
            estimator_name=self.name,
            estimator_version=self.version,
            raw_inputs={'fallback_reason': reason},
        )
