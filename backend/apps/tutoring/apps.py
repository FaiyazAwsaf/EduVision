"""
Tutoring App Configuration
"""

from django.apps import AppConfig


class TutoringConfig(AppConfig):
    """Configuration for the tutoring app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tutoring'
    verbose_name = 'Tutoring Sessions'
