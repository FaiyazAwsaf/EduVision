from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("whiteboard", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="whiteboardsession",
            name="page_count",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="whiteboardstate",
            name="page",
            field=models.PositiveIntegerField(db_index=True, default=1),
        ),
        migrations.AlterUniqueTogether(
            name="whiteboardstate",
            unique_together={("session", "page", "version")},
        ),
        migrations.AlterModelOptions(
            name="whiteboardstate",
            options={"ordering": ["page", "-version"]},
        ),
    ]
