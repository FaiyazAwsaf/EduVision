"""
Extensibility Interfaces for Phase 6: Intelligence & Adaptive Optimization.

These interfaces define the contract for intelligence components.
Current implementations are RULE-BASED, but interfaces are designed
to be swapped with ML implementations later WITHOUT refactoring.

Design principles:
- Interfaces are stable (won't change when implementations change)
- Implementations are pluggable
- Rule-based and ML implementations have same interface
- No assumptions about internal implementation strategy
"""

from .base import (
    BaseEstimator,
    EstimatorResult,
    EstimatorConfig,
)
from .difficulty_estimator import DifficultyEstimator
from .pace_evaluator import PaceEvaluator
from .dropout_risk_assessor import DropoutRiskAssessor
from .consistency_analyzer import ConsistencyAnalyzer
from .recommendation_strategy import RecommendationStrategy

__all__ = [
    # Base classes
    'BaseEstimator',
    'EstimatorResult',
    'EstimatorConfig',
    # Interfaces
    'DifficultyEstimator',
    'PaceEvaluator',
    'DropoutRiskAssessor',
    'ConsistencyAnalyzer',
    'RecommendationStrategy',
]
