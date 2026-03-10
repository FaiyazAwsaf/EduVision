"""
AI Outline Extraction Service

Sends raw PDF text to Gemini and extracts structured course data:
- Course contents / topics with hierarchy
- Course objectives
- Weekly plan mapping

Everything else in the PDF (grading, program outcomes, Bloom's mapping,
teacher info, assessment methods) is intentionally discarded.
"""
import json
import logging
import os
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """\
You are a university course outline parser.  Given the raw text extracted from
a course outline PDF, return **only** a JSON object with the structure below.

### Rules
1. Extract ONLY: course title, course code, course objectives, and the weekly plan.
2. IGNORE everything else: grading policy, assessment methods, program outcomes (POs),
   Bloom's taxonomy mapping tables, textbook info, teacher details, CO-PO mapping,
   credit hours, prerequisites, teaching aids, Google Classroom links, attendance rules,
   letter-grade tables, marks distribution, etc.
3. In the weekly plan, each week should list topics.  When a topic clearly has
   sub-topics (e.g. "Nonlinear Equations: Bisection method, Newton-Raphson method"),
   create a parent topic with subtopics.
4. Identify exam weeks (midterm, final) and mark them with `is_exam_week: true`.
5. Some weeks may be grouped (e.g. "Weeks 5-6"), expand them into separate week entries
   with the same topics.
6. Course outcomes (COs) mentioned alongside weekly topics should be captured as a list
   of strings, e.g. ["CO1", "CO2"].
7. Return valid JSON only — no markdown fences, no commentary.

### Output schema
{{
  "title": "string – course title",
  "course_code": "string – course code, e.g. 'Math 4543'",
  "course_objectives": ["objective 1", "objective 2", ...],
  "weeks": [
    {{
      "week_number": 1,
      "is_exam_week": false,
      "exam_label": "",
      "topics": [
        {{
          "title": "Parent topic title",
          "description": "",
          "subtopics": ["Subtopic A", "Subtopic B"],
          "course_outcomes": ["CO1", "CO2"]
        }}
      ]
    }}
  ]
}}

### Raw PDF text
---
{text}
---
"""


def extract_outline_from_text(raw_text: str) -> dict[str, Any]:
    """
    Send raw PDF text to Gemini and get structured course outline data.

    Returns:
        Dict matching the output schema above.

    Raises:
        ValueError: If the AI response is not valid JSON or missing required keys.
        RuntimeError: If the AI API call fails.
    """
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = EXTRACTION_PROMPT.format(text=raw_text[:30_000])  # limit context window

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Strip markdown code fences if present
        if response_text.startswith("```"):
            first_newline = response_text.index("\n")
            response_text = response_text[first_newline + 1:]
        if response_text.endswith("```"):
            response_text = response_text[:-3].strip()

        data = json.loads(response_text)

    except json.JSONDecodeError as exc:
        logger.error("AI returned invalid JSON: %s", exc)
        raise ValueError("Failed to parse AI response as JSON") from exc
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc)
        raise RuntimeError(f"AI extraction failed: {exc}") from exc

    # Validate required keys
    for key in ("title", "weeks"):
        if key not in data:
            raise ValueError(f"AI response missing required key: '{key}'")

    if not isinstance(data["weeks"], list):
        raise ValueError("'weeks' must be a list")

    # Ensure defaults
    data.setdefault("course_code", "")
    data.setdefault("course_objectives", [])

    logger.info(
        "AI extraction complete: title='%s', weeks=%d",
        data["title"],
        len(data["weeks"]),
    )
    return data


def _get_api_key() -> str:
    """Resolve Gemini API key from environment, supporting rotation keys."""
    for i in range(1, 10):
        key = os.getenv(f"GEMINI_API_KEY_{i}")
        if key:
            return key
    key = os.getenv("GEMINI_API_KEY")
    if key:
        return key
    raise RuntimeError("No GEMINI_API_KEY configured")
