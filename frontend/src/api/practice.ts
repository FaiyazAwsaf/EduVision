/**
 * Practice Quiz API Client
 *
 * Handles communication with the AI practice quiz backend endpoints.
 */

import { API_BASE_URL } from "@/config/api";
import { authenticatedFetch } from "@/api/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PracticeQuestion {
  id: string;
  number: number;
  text: string;
  marks: number;
}

export interface GeneratePracticeResponse {
  session_id: string;
  subject: string;
  topic: string;
  questions: PracticeQuestion[];
  total_marks: number;
}

export interface TypedAnswer {
  question_id: string;
  answer_text: string;
}

export interface QuestionResult {
  question_id: string;
  number: number;
  text: string;
  marks_awarded: number;
  max_marks: number;
  model_answer: string;
  feedback: string;
}

export interface PracticeResultsResponse {
  total_score: number;
  max_score: number;
  percentage: number;
  subject: string;
  results: QuestionResult[];
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Generate AI practice questions for a subject.
 */
export async function generatePractice(
  subject: string,
  numQuestions: 5 | 10 | 15,
  topic?: string,
): Promise<GeneratePracticeResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/evaluation/practice/generate/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, num_questions: numQuestions, ...(topic ? { topic } : {}) }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate practice questions.");
  }

  return response.json();
}

/**
 * Submit typed answers for grading.
 */
export async function submitTypedAnswers(
  sessionId: string,
  answers: TypedAnswer[],
): Promise<PracticeResultsResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/evaluation/practice/submit/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, mode: "typed", answers }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to grade answers.");
  }

  return response.json();
}

/**
 * Submit a single image answer for grading (OCR + AI grade).
 */
export async function submitImageAnswer(
  sessionId: string,
  questionId: string,
  imageFile: File,
): Promise<PracticeResultsResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("mode", "image");
  formData.append("question_id", questionId);
  formData.append("image", imageFile);

  const response = await authenticatedFetch(
    `${API_BASE_URL}/evaluation/practice/submit/`,
    {
      method: "POST",
      body: formData,
      // No Content-Type header — browser sets multipart boundary automatically
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to grade image answer.");
  }

  return response.json();
}
