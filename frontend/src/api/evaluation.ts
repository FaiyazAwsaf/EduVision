/**
 * Evaluation API Client
 *
 * Handles script upload, evaluation, and report retrieval.
 * Uses function exports for consistency with other API modules.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import type { RubricSet, QuestionRubric } from "@/types/rubrics";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnswerScript {
  id: string;
  student_name?: string;
  student_id?: string;
  rubric_set: RubricSet | string;
  rubric_set_title?: string;
  status: "pending" | "processing" | "evaluated" | "error";
  total_score?: number;
  percentage?: number;
  feedback_summary?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  pages?: ScriptPage[];
  page_count?: number;
  question_evaluations?: QuestionEvaluation[];
  created_at: string;
  evaluated_at?: string;
}

export interface ScriptPage {
  id: string;
  page_number: number;
  image: string;
  image_url?: string;
  extracted_text?: string;
  extracted_equations?: string[];
  ocr_confidence?: number;
}

export interface QuestionEvaluation {
  id: string;
  question_number: string;
  question_text: string;
  max_marks: number;
  method_marks_awarded: number;
  calculation_marks_awarded: number;
  answer_marks_awarded: number;
  total_marks_awarded: number;
  student_answer_text?: string;
  method_feedback?: string;
  calculation_feedback?: string;
  answer_feedback?: string;
  key_points_found?: string[];
  key_points_missing?: string[];
  mistakes_identified?: string[];
  overall_feedback?: string;
  confidence_score?: number;
  needs_manual_review?: boolean;
  review_reason?: string;
}

export interface EvaluationReport {
  script_id: string;
  student_name?: string;
  student_id?: string;
  rubric_set: {
    id: string;
    title: string;
    subject: string;
    total_marks: number;
  };
  evaluation_summary: {
    total_score: number;
    max_score: number;
    percentage: number;
    status: string;
    evaluated_at?: string;
  };
  question_results: {
    question_number: string;
    question_text: string;
    marks: {
      method: { awarded: number; max: number; feedback?: string };
      calculation: { awarded: number; max: number; feedback?: string };
      answer: { awarded: number; max: number; feedback?: string };
      total: number;
      max_total: number;
    };
    student_answer?: string;
    key_points_found?: string[];
    key_points_missing?: string[];
    mistakes_identified?: string[];
    overall_feedback?: string;
    confidence_score?: number;
    needs_manual_review?: boolean;
    review_reason?: string;
  }[];
  overall_feedback: {
    summary?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const EVALUATION_URL = `${API_BASE_URL}/evaluation`;

async function evaluationFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${EVALUATION_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await parseApiError(
      response,
      `API Error: ${response.status}`,
    );
    throw new Error(message);
  }

  return response.json();
}

// ─── Rubric Sets (from rubrics module) ───────────────────────────────────────

export async function getRubricSets(filters?: {
  state?: "draft" | "published" | "archived";
  subject?: string;
}): Promise<RubricSet[]> {
  const params = new URLSearchParams();
  if (filters?.state) params.set("state", filters.state);
  if (filters?.subject) params.set("subject", filters.subject);

  const query = params.toString() ? `?${params.toString()}` : "";
  const url = `${API_BASE_URL}/rubrics/${query}`;
  const response = await fetch(url);
  if (!response.ok) {
    const message = await parseApiError(
      response,
      "Failed to fetch rubric sets",
    );
    throw new Error(message);
  }
  return response.json();
}

export async function getRubricSet(id: string): Promise<RubricSet> {
  const url = `${API_BASE_URL}/rubrics/${id}/`;
  const response = await fetch(url);
  if (!response.ok) {
    const message = await parseApiError(response, "Failed to fetch rubric set");
    throw new Error(message);
  }
  return response.json();
}

// ─── Answer Scripts ──────────────────────────────────────────────────────────

export async function getScripts(filters?: {
  rubric_set?: string;
  status?: string;
}): Promise<AnswerScript[]> {
  const params = new URLSearchParams();
  if (filters?.rubric_set) params.set("rubric_set", filters.rubric_set);
  if (filters?.status) params.set("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  return evaluationFetch<AnswerScript[]>(`/scripts/${query}`);
}

export async function getScript(id: string): Promise<AnswerScript> {
  return evaluationFetch<AnswerScript>(`/scripts/${id}/`);
}

export async function uploadScript(data: {
  rubric_set: string;
  student_name?: string;
  student_id?: string;
  pages: File[];
}): Promise<AnswerScript> {
  const formData = new FormData();
  formData.append("rubric_set", data.rubric_set);
  if (data.student_name) formData.append("student_name", data.student_name);
  if (data.student_id) formData.append("student_id", data.student_id);
  data.pages.forEach((page) => {
    formData.append("pages", page);
  });

  return evaluationFetch<AnswerScript>("/scripts/", {
    method: "POST",
    body: formData,
  });
}

export async function evaluateScript(scriptId: string): Promise<AnswerScript> {
  return evaluationFetch<AnswerScript>(`/scripts/${scriptId}/evaluate/`, {
    method: "POST",
  });
}

export async function getEvaluationReport(
  scriptId: string,
): Promise<EvaluationReport> {
  return evaluationFetch<EvaluationReport>(`/scripts/${scriptId}/report/`);
}

export async function deleteScript(id: string): Promise<void> {
  await evaluationFetch(`/scripts/${id}/`, { method: "DELETE" });
}

// ─── Question Evaluations ────────────────────────────────────────────────────

export async function overrideMarks(
  evaluationId: string,
  data: {
    method_marks_awarded?: number;
    calculation_marks_awarded?: number;
    answer_marks_awarded?: number;
    overall_feedback?: string;
  },
): Promise<QuestionEvaluation> {
  return evaluationFetch<QuestionEvaluation>(
    `/evaluations/${evaluationId}/override_marks/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

// Re-export types from rubrics for backward compatibility
export type { RubricSet, QuestionRubric };
