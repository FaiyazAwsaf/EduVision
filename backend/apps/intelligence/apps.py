"""
Phase 6: Intelligence & Adaptive Optimization (Foundation Layer)

This app provides advisory-only intelligence capabilities:
- Event consumption (immutable learning events)
- Learner insight computation (rule-based only)
- Recommendation generation (advisory output, never auto-applied)

STRICT CONSTRAINTS:
- NO machine learning or statistical inference
- NO automatic plan mutation
- NO Module 3 imports or dependencies
- Recommendations are suggestions only, never commands

EXTENSIBILITY:
- All estimators implement abstract interfaces
- Rule-based implementations can be swapped for ML later
- No refactoring required to add ML strategies
"""
from django.apps import AppConfig


class IntelligenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.intelligence'
    verbose_name = 'Phase 6: Intelligence & Adaptive Optimization'
    
    def ready(self):
        """
        App initialization.
        
        Future ML implementations can register here without
        modifying existing code.
        """
        pass
