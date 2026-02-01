"""
Rule-Based Implementations for Phase 6.

All estimators in this package are:
- Deterministic (same inputs = same outputs)
- Configurable (thresholds can be adjusted)
- Explainable (provide human-readable justifications)
- ML-Ready (can be swapped for ML implementations later)

⚠️ NO machine learning or statistical inference is used.
"""

from .difficulty_rules import RuleBasedDifficultyEstimator
from .pace_rules import RuleBasedPaceEvaluator
from .dropout_rules import RuleBasedDropoutRiskAssessor
from .consistency_rules import RuleBasedConsistencyAnalyzer
from .recommendation_rules import RuleBasedRecommendationStrategy

__all__ = [
    'RuleBasedDifficultyEstimator',
    'RuleBasedPaceEvaluator',
    'RuleBasedDropoutRiskAssessor',
    'RuleBasedConsistencyAnalyzer',
    'RuleBasedRecommendationStrategy',
]
