# Generated migration: Add evaluation pipeline event types

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('intelligence', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='learningevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('content_started', 'Content Started'),
                    ('content_completed', 'Content Completed'),
                    ('content_abandoned', 'Content Abandoned'),
                    ('content_regenerated', 'Content Regenerated'),
                    ('topic_viewed', 'Topic Viewed'),
                    ('topic_retried', 'Topic Retried'),
                    ('topic_mastered', 'Topic Mastered'),
                    ('plan_viewed', 'Plan Viewed'),
                    ('plan_item_started', 'Plan Item Started'),
                    ('plan_item_completed', 'Plan Item Completed'),
                    ('plan_item_skipped', 'Plan Item Skipped'),
                    ('session_started', 'Session Started'),
                    ('session_ended', 'Session Ended'),
                    ('feedback_submitted', 'Feedback Submitted'),
                    ('script_submitted', 'Script Submitted'),
                    ('script_evaluated', 'Script Evaluated'),
                    ('content_generated', 'Content Generated'),
                    ('content_viewed', 'Content Viewed'),
                    ('session_joined', 'Session Joined'),
                ],
                db_index=True,
                help_text='Type of learning event',
                max_length=50,
            ),
        ),
    ]
