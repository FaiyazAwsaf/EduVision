import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import status

from apps.authentication.backends import CustomUserJWTAuthentication
from .practice_service import PracticeService

logger = logging.getLogger(__name__)


class PracticeGenerateView(APIView):
    """
    POST /api/evaluation/practice/generate/

    Generate AI practice questions for a given subject.

    Request body (JSON):
        {
            "subject": "Mathematics",
            "num_questions": 5,  // 5, 10, or 15
            "topic": "Calculus"  // optional
        }

    Response:
        {
            "session_id": "<uuid>",
            "subject": "Mathematics",
            "questions": [
                {"id": "<uuid>", "number": 1, "text": "...", "marks": 5},
                ...
            ],
            "total_marks": 25
        }
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        subject = (request.data.get("subject") or "").strip()
        topic = (request.data.get("topic") or "").strip()
        num_questions_raw = request.data.get("num_questions", 5)

        if not subject:
            return Response(
                {"error": "subject is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            num_questions = int(num_questions_raw)
        except (ValueError, TypeError):
            return Response(
                {"error": "num_questions must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if num_questions not in (5, 10, 15):
            return Response(
                {"error": "num_questions must be 5, 10, or 15."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = PracticeService()
            result = service.generate_questions(subject=subject, num_questions=num_questions, topic=topic)
            return Response(result, status=status.HTTP_200_OK)
        except RuntimeError as exc:
            logger.error("Practice generation error: %s", exc)
            return Response(
                {"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as exc:
            logger.exception("Unexpected error during practice generation")
            return Response(
                {"error": "An unexpected error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PracticeSubmitView(APIView):
    """
    POST /api/evaluation/practice/submit/

    Submit all answers for a practice session and receive graded results.

    For TYPED answers (JSON body):
        Content-Type: application/json
        {
            "session_id": "<uuid>",
            "mode": "typed",
            "answers": [
                {"question_id": "<uuid>", "answer_text": "..."},
                ...
            ]
        }

    For IMAGE answers (multipart/form-data):
        Content-Type: multipart/form-data
        Fields:
            session_id   — UUID
            mode         — "image"
            question_id  — UUID of the question being answered
            image        — image file

    Response:
        {
            "total_score": 18,
            "max_score": 25,
            "percentage": 72.0,
            "subject": "Mathematics",
            "results": [
                {
                    "question_id": "<uuid>",
                    "number": 1,
                    "text": "...",
                    "marks_awarded": 4,
                    "max_marks": 5,
                    "model_answer": "...",
                    "feedback": "..."
                },
                ...
            ]
        }
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        session_id = (request.data.get("session_id") or "").strip()
        mode = (request.data.get("mode") or "typed").strip()

        if not session_id:
            return Response(
                {"error": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            service = PracticeService()

            if mode == "image":
                question_id = (request.data.get("question_id") or "").strip()
                image_file = request.FILES.get("image")

                if not question_id:
                    return Response(
                        {"error": "question_id is required for image mode."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not image_file:
                    return Response(
                        {"error": "image file is required for image mode."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                image_bytes = image_file.read()
                result = service.grade_image_answer(
                    session_id=session_id,
                    question_id=question_id,
                    image_bytes=image_bytes,
                )

            else:
                # typed mode
                answers = request.data.get("answers")
                if not isinstance(answers, list):
                    return Response(
                        {"error": "answers must be a list."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                result = service.grade_typed_answers(
                    session_id=session_id, answers=answers
                )

            return Response(result, status=status.HTTP_200_OK)

        except ValueError as exc:
            # Session not found / expired
            return Response(
                {"error": str(exc)}, status=status.HTTP_404_NOT_FOUND
            )
        except RuntimeError as exc:
            logger.error("Practice grading error: %s", exc)
            return Response(
                {"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as exc:
            logger.exception("Unexpected error during practice submission")
            return Response(
                {"error": "An unexpected error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
