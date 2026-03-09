import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("evaluation", "0005_scriptsubmissionform_assignment_and_more"),
        ("rubrics", "0003_rubricset_questionrubric_rubricsetversion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentPerformanceSnapshot",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("subject", models.CharField(blank=True, default="", max_length=200)),
                (
                    "assessment_title",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                (
                    "total_score",
                    models.DecimalField(decimal_places=2, default=0, max_digits=8),
                ),
                (
                    "max_score",
                    models.DecimalField(decimal_places=2, default=0, max_digits=8),
                ),
                (
                    "percentage",
                    models.DecimalField(decimal_places=2, default=0, max_digits=5),
                ),
                ("question_breakdown", models.JSONField(blank=True, default=list)),
                ("timestamp", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "script",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="performance_snapshot",
                        to="evaluation.answerscript",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        limit_choices_to={"role": "student"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="performance_snapshots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "analytics_student_performance_snapshots",
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="studentperformancesnapshot",
            index=models.Index(
                fields=["student", "-timestamp"],
                name="analytics_s_student_timestamp_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="studentperformancesnapshot",
            index=models.Index(
                fields=["student", "subject"],
                name="analytics_s_student_subject_idx",
            ),
        ),
        migrations.CreateModel(
            name="MisconceptionRecord",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "misconception_type",
                    models.CharField(
                        choices=[
                            ("sign_error", "Sign Error"),
                            ("formula_misuse", "Formula Misuse"),
                            ("missing_keyword", "Missing Keyword"),
                            ("calculation_error", "Calculation Error"),
                            ("conceptual_error", "Conceptual Error"),
                            ("incorrect_steps", "Incorrect Solution Steps"),
                            ("unit_error", "Incorrect Unit Usage"),
                            ("other", "Other"),
                        ],
                        max_length=30,
                    ),
                ),
                ("description", models.TextField()),
                ("frequency", models.PositiveIntegerField(default=0)),
                (
                    "percentage_affected",
                    models.DecimalField(decimal_places=2, default=0, max_digits=5),
                ),
                ("example_answers", models.JSONField(blank=True, default=list)),
                ("timestamp", models.DateTimeField(auto_now=True)),
                (
                    "question_rubric",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="misconception_records",
                        to="rubrics.questionrubric",
                    ),
                ),
            ],
            options={
                "db_table": "analytics_misconception_records",
                "ordering": ["-frequency"],
            },
        ),
        migrations.AddIndex(
            model_name="misconceptionrecord",
            index=models.Index(
                fields=["question_rubric", "-frequency"],
                name="analytics_m_qrubric_freq_idx",
            ),
        ),
    ]
