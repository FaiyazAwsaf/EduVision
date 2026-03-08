"""
Analytics Services
==================
All heavy computation lives here so views stay thin.
No new evaluation logic is introduced — we only read from existing models.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone

from apps.evaluation.models import AnswerScript, QuestionEvaluation
from apps.rubrics.models import QuestionRubric

from .models import MisconceptionRecord, StudentPerformanceSnapshot


# ─── Snapshot Helpers ─────────────────────────────────────────────────────────


def rebuild_snapshot_for_script(script: AnswerScript) -> None:
    """
    Create or update a StudentPerformanceSnapshot for an evaluated script.
    Called after every successful evaluation so future queries are cheap.
    """
    if script.status != "evaluated" or script.student_user is None:
        return

    subject = ""
    assessment_title = ""
    if script.submission_form:
        try:
            assignment = script.submission_form.assignment
            subject = assignment.subject.name
            assessment_title = script.submission_form.title
        except Exception:
            pass
    elif script.rubric_set:
        subject = script.rubric_set.subject
        assessment_title = script.rubric_set.title

    # Build per-question breakdown
    question_breakdown = []
    for qe in script.question_evaluations.select_related("question_rubric").order_by(
        "question_rubric__question_number"
    ):
        max_m = float(qe.question_rubric.max_marks) if qe.question_rubric else 0
        awarded = float(qe.total_marks_awarded)
        pct = round((awarded / max_m * 100), 2) if max_m else 0
        question_breakdown.append(
            {
                "question_number": qe.question_rubric.question_number
                if qe.question_rubric
                else "?",
                "question_text": (qe.question_rubric.question_text[:80] + "…")
                if qe.question_rubric and len(qe.question_rubric.question_text) > 80
                else (qe.question_rubric.question_text if qe.question_rubric else ""),
                "marks_awarded": awarded,
                "max_marks": max_m,
                "percentage": pct,
            }
        )

    StudentPerformanceSnapshot.objects.update_or_create(
        script=script,
        defaults={
            "student": script.student_user,
            "subject": subject,
            "assessment_title": assessment_title,
            "total_score": script.total_score or 0,
            "max_score": script.rubric_set.total_marks
            if script.rubric_set
            else 0,
            "percentage": script.percentage or 0,
            "question_breakdown": question_breakdown,
            "timestamp": script.evaluated_at or timezone.now(),
        },
    )


# ─── Student Analytics ────────────────────────────────────────────────────────


def generate_student_progress(student_id: str) -> list[dict[str, Any]]:
    """
    Time-series performance data for a student across all evaluated scripts.
    Returns list sorted oldest→newest, ready for line chart rendering.
    """
    snapshots = (
        StudentPerformanceSnapshot.objects.filter(student_id=student_id)
        .order_by("timestamp")
        .values(
            "assessment_title",
            "subject",
            "total_score",
            "max_score",
            "percentage",
            "timestamp",
        )
    )
    return [
        {
            "assessment": s["assessment_title"] or "Assessment",
            "subject": s["subject"] or "General",
            "score": float(s["total_score"]),
            "max_score": float(s["max_score"]),
            "percentage": float(s["percentage"]),
            "date": s["timestamp"].strftime("%Y-%m-%d") if s["timestamp"] else None,
        }
        for s in snapshots
    ]


def compute_student_subject_performance(student_id: str) -> list[dict[str, Any]]:
    """
    Average performance per subject for a student.
    """
    from django.db.models import Avg

    rows = (
        StudentPerformanceSnapshot.objects.filter(student_id=student_id)
        .values("subject")
        .annotate(
            avg_percentage=Avg("percentage"),
            exam_count=Count("id"),
        )
        .order_by("subject")
    )
    return [
        {
            "subject": r["subject"] or "General",
            "avg_percentage": round(float(r["avg_percentage"]), 2),
            "exam_count": r["exam_count"],
        }
        for r in rows
    ]


def compute_topic_performance(student_id: str) -> list[dict[str, Any]]:
    """
    Question-level aggregated performance across all scripts for a student.
    Groups by question text (normalised) to show topic-level strengths and weaknesses.
    Returns a list suited for radar chart rendering.
    """
    evaluations = (
        QuestionEvaluation.objects.filter(
            script__student_user_id=student_id,
            script__status="evaluated",
        )
        .select_related("question_rubric")
        .values(
            "question_rubric__question_text",
            "question_rubric__question_number",
            "question_rubric__max_marks",
            "total_marks_awarded",
        )
    )

    # Aggregate per question number
    aggregated: dict[str, dict] = {}
    for ev in evaluations:
        q_num = ev["question_rubric__question_number"] or "?"
        q_text = ev["question_rubric__question_text"] or ""
        label = f"Q{q_num}"
        max_m = float(ev["question_rubric__max_marks"] or 0)
        awarded = float(ev["total_marks_awarded"] or 0)

        if label not in aggregated:
            aggregated[label] = {
                "topic": label,
                "question_text": q_text[:60],
                "total_awarded": 0,
                "total_max": 0,
                "count": 0,
            }
        aggregated[label]["total_awarded"] += awarded
        aggregated[label]["total_max"] += max_m
        aggregated[label]["count"] += 1

    result = []
    for label, data in sorted(aggregated.items()):
        pct = (
            round(data["total_awarded"] / data["total_max"] * 100, 2)
            if data["total_max"]
            else 0
        )
        result.append(
            {
                "topic": data["topic"],
                "question_text": data["question_text"],
                "avg_percentage": pct,
                "attempts": data["count"],
            }
        )
    return result


def get_student_overview(student_id: str) -> dict[str, Any]:
    """
    Quick KPI summary for the student dashboard header cards.
    """
    snapshots = StudentPerformanceSnapshot.objects.filter(student_id=student_id)
    total = snapshots.count()
    if total == 0:
        return {
            "total_assessments": 0,
            "avg_percentage": 0,
            "best_percentage": 0,
            "subjects_count": 0,
        }

    agg = snapshots.aggregate(
        avg_pct=Avg("percentage"),
        best_pct=Max("percentage"),
    )
    subjects = snapshots.values("subject").distinct().count()
    return {
        "total_assessments": total,
        "avg_percentage": round(float(agg["avg_pct"] or 0), 2),
        "best_percentage": round(float(agg["best_pct"] or 0), 2),
        "subjects_count": subjects,
    }


# ─── Class / Teacher Analytics ────────────────────────────────────────────────


def compute_class_distribution(assessment_id: str) -> dict[str, Any]:
    """
    Score distribution histogram for all students in a submission form.
    Returns 10 percentage buckets (0-10, 10-20, …, 90-100).
    """
    scripts = AnswerScript.objects.filter(
        submission_form_id=assessment_id,
        status="evaluated",
        percentage__isnull=False,
    ).values_list("percentage", flat=True)

    buckets = [f"{i*10}-{(i+1)*10}" for i in range(10)]
    counts = Counter({b: 0 for b in buckets})

    for pct in scripts:
        idx = min(int(float(pct) // 10), 9)
        counts[buckets[idx]] += 1

    total = len(scripts)
    return {
        "distribution": [
            {"bucket": b, "count": counts[b]} for b in buckets
        ],
        "total_students": total,
        "avg_percentage": round(
            sum(float(p) for p in scripts) / total if total else 0, 2
        ),
    }


def compute_class_question_performance(assessment_id: str) -> list[dict[str, Any]]:
    """
    Per-question average marks for all evaluated scripts in a submission form.
    """
    evals = (
        QuestionEvaluation.objects.filter(
            script__submission_form_id=assessment_id,
            script__status="evaluated",
        )
        .select_related("question_rubric")
        .values(
            "question_rubric__question_number",
            "question_rubric__question_text",
            "question_rubric__max_marks",
            "total_marks_awarded",
        )
    )

    aggregated: dict[int, dict] = {}
    for ev in evals:
        q_num = ev["question_rubric__question_number"] or 0
        if q_num not in aggregated:
            aggregated[q_num] = {
                "question_number": q_num,
                "question_text": ev["question_rubric__question_text"] or "",
                "max_marks": float(ev["question_rubric__max_marks"] or 0),
                "total_awarded": 0,
                "count": 0,
            }
        aggregated[q_num]["total_awarded"] += float(ev["total_marks_awarded"] or 0)
        aggregated[q_num]["count"] += 1

    result = []
    for q_num, data in sorted(aggregated.items()):
        avg = data["total_awarded"] / data["count"] if data["count"] else 0
        pct = (avg / data["max_marks"] * 100) if data["max_marks"] else 0
        result.append(
            {
                "question_number": q_num,
                "question_text": data["question_text"][:80],
                "avg_marks": round(avg, 2),
                "max_marks": data["max_marks"],
                "avg_percentage": round(pct, 2),
                "response_count": data["count"],
            }
        )
    return result


# ─── Misconception Detection ──────────────────────────────────────────────────

# Keyword patterns used to classify misconception types deterministically
_MISCONCEPTION_PATTERNS: list[tuple[str, str]] = [
    ("sign_error", r"\b(sign|negative|positive|minus|wrong sign)\b"),
    ("formula_misuse", r"\b(formula|equation|law|rule|theorem)\b"),
    ("unit_error", r"\b(unit|units|m/s|kg|newton|joule|watt|metre)\b"),
    ("calculation_error", r"\b(calculat|arithmet|compute|result|answer|value|wrong number)\b"),
    ("incorrect_steps", r"\b(step|method|procedure|process|approach|work)\b"),
    ("conceptual_error", r"\b(concept|definition|understand|principle|theory|meaning)\b"),
    ("missing_keyword", r"\b(missing|omit|forgot|key|keyword|term|word)\b"),
]


def _classify_misconception(text: str) -> str:
    text_lower = text.lower()
    for mtype, pattern in _MISCONCEPTION_PATTERNS:
        if re.search(pattern, text_lower):
            return mtype
    return "other"


def detect_misconceptions(question_rubric_id: str) -> list[dict[str, Any]]:
    """
    Analyses all QuestionEvaluation records for a question and clusters
    common mistakes into misconception categories using deterministic rules.

    Also persists/updates MisconceptionRecord rows for caching.
    """
    try:
        question_rubric = QuestionRubric.objects.get(pk=question_rubric_id)
    except QuestionRubric.DoesNotExist:
        return []

    evaluations = QuestionEvaluation.objects.filter(
        question_rubric_id=question_rubric_id,
        script__status="evaluated",
    ).values(
        "mistakes_identified",
        "key_points_missing",
        "method_feedback",
        "calculation_feedback",
        "answer_feedback",
        "student_answer_text",
    )

    total_count = evaluations.count()
    if total_count == 0:
        return []

    # Collect all text fragments that signal a mistake
    mistake_texts: list[str] = []
    missing_keywords: list[str] = []
    example_answers_pool: list[str] = []

    for ev in evaluations:
        # mistakes_identified is a JSON list of strings
        if isinstance(ev["mistakes_identified"], list):
            mistake_texts.extend(str(m) for m in ev["mistakes_identified"] if m)
        # key_points_missing
        if isinstance(ev["key_points_missing"], list):
            missing_keywords.extend(str(k) for k in ev["key_points_missing"] if k)
        # Feedback text
        for fb_field in ("method_feedback", "calculation_feedback", "answer_feedback"):
            if ev.get(fb_field):
                mistake_texts.append(str(ev[fb_field]))
        # Collect example answers for display (up to 20)
        if ev.get("student_answer_text") and len(example_answers_pool) < 20:
            example_answers_pool.append(str(ev["student_answer_text"])[:200])

    # Classify each mistake text
    classified: dict[str, list[str]] = defaultdict(list)
    for text in mistake_texts:
        mtype = _classify_misconception(text)
        classified[mtype].append(text)

    # Missing keywords always map to missing_keyword type
    if missing_keywords:
        classified["missing_keyword"].extend(missing_keywords)

    # Build result list, persist to DB
    # Delete stale records for this question first
    MisconceptionRecord.objects.filter(question_rubric=question_rubric).delete()

    results = []
    for mtype, texts in sorted(classified.items(), key=lambda x: -len(x[1])):
        # Deduplicate and count
        text_counts = Counter(texts)
        top_texts = [t for t, _ in text_counts.most_common(5)]
        freq = len(texts)
        pct = round(freq / total_count * 100, 2)

        # Build a concise description
        description = _build_description(mtype, top_texts)

        # Pick up to 3 example answers from pool
        examples = example_answers_pool[:3]

        record = MisconceptionRecord.objects.create(
            question_rubric=question_rubric,
            misconception_type=mtype,
            description=description,
            frequency=freq,
            percentage_affected=pct,
            example_answers=examples,
        )

        results.append(
            {
                "id": str(record.id),
                "misconception_type": mtype,
                "misconception_type_display": record.get_misconception_type_display(),
                "description": description,
                "frequency": freq,
                "percentage_affected": pct,
                "example_answers": examples,
            }
        )

    return sorted(results, key=lambda r: -r["frequency"])


def _build_description(mtype: str, texts: list[str]) -> str:
    """Construct a readable description from top mistake texts."""
    labels = {
        "sign_error": "Sign error detected in student responses",
        "formula_misuse": "Incorrect formula or equation used",
        "unit_error": "Incorrect or missing unit in answer",
        "calculation_error": "Arithmetic or calculation mistake",
        "incorrect_steps": "Incorrect solution steps or method",
        "conceptual_error": "Conceptual misunderstanding identified",
        "missing_keyword": "Missing key terms or concepts",
        "other": "Other mistake pattern",
    }
    base = labels.get(mtype, "Mistake pattern detected")
    # Append up to 2 unique text snippets for context
    snippets = list(dict.fromkeys(t[:60] for t in texts[:2]))
    if snippets:
        base += ": " + "; ".join(snippets)
    return base


def get_cached_misconceptions(question_rubric_id: str) -> list[dict[str, Any]]:
    """Return already-computed MisconceptionRecords without re-computing."""
    records = MisconceptionRecord.objects.filter(
        question_rubric_id=question_rubric_id
    ).order_by("-frequency")

    return [
        {
            "id": str(r.id),
            "misconception_type": r.misconception_type,
            "misconception_type_display": r.get_misconception_type_display(),
            "description": r.description,
            "frequency": r.frequency,
            "percentage_affected": float(r.percentage_affected),
            "example_answers": r.example_answers,
        }
        for r in records
    ]
