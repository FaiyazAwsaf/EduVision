# Generated manually - make created_by field nullable

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rubrics', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='rubric',
            name='created_by',
            field=models.UUIDField(blank=True, db_index=True, help_text='UUID of the user who created this rubric', null=True),
        ),
    ]
