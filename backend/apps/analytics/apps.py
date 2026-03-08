from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analytics"
    verbose_name = "Smart Analytics"

    def ready(self):
        # Register signal handlers so snapshot rebuilds happen automatically
        import apps.analytics.signals  # noqa: F401
