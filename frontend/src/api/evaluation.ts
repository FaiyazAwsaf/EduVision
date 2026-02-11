/**
 * Evaluation API Client
 *
 * Handles script upload, evaluation, and report retrieval.
 * Rubric fetching is delegated to the rubrics API module.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import { authenticatedFetch } from "@/api/auth";
import type {
  RubricSet,
  RubricSetListItem,
  QuestionRubric,
} from "@/types/rubrics";

// Re-export rubric helpers so existing consumers keep working
export { listRubricSets as getRubricSets, getRubricSet } from "@/api/rubrics";
export type { RubricSet, RubricSetListItem, QuestionRubric };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnswerScript {
  id: string;
  student_name?: string;
  student_id?: string;
  student_full_name?: string;
  student_roll_number?: string;
  student_section?: string;
  student_class?: string;
  rubric_set: RubricSet | string;
  rubric_set_title?: string;
  submission_form?: string;
  submission_form_title?: string;
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

/** Authenticated version of evaluationFetch for endpoints requiring JWT. */
async function authenticatedEvaluationFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${EVALUATION_URL}${endpoint}`;
  const response = await authenticatedFetch(url, {
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

// ─── Answer Scripts ──────────────────────────────────────────────────────────

export async function getScripts(filters?: {
  rubric_set?: string;
  status?: string;
}): Promise<AnswerScript[]> {
  const params = new URLSearchParams();
  if (filters?.rubric_set) params.set("rubric_set", filters.rubric_set);
  if (filters?.status) params.set("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await authenticatedEvaluationFetch<
    AnswerScript[] | { results: AnswerScript[] }
  >(`/scripts/${query}`);
  return Array.isArray(data) ? data : data.results;
}

export async function getScript(id: string): Promise<AnswerScript> {
  return authenticatedEvaluationFetch<AnswerScript>(`/scripts/${id}/`);
}

export async function uploadScript(data: {
  rubric_set?: string;
  student_name?: string;
  student_id?: string;
  roll_number?: string;
  submission_form?: string;
  pages: File[];
}): Promise<AnswerScript> {
  const formData = new FormData();
  if (data.rubric_set) formData.append("rubric_set", data.rubric_set);
  if (data.student_name) formData.append("student_name", data.student_name);
  if (data.student_id) formData.append("student_id", data.student_id);
  if (data.roll_number) formData.append("roll_number", data.roll_number);
  if (data.submission_form)
    formData.append("submission_form", data.submission_form);
  data.pages.forEach((page) => {
    formData.append("pages", page);
  });

  return authenticatedEvaluationFetch<AnswerScript>("/scripts/", {
    method: "POST",
    body: formData,
  });
}

export async function evaluateScript(scriptId: string): Promise<AnswerScript> {
  return authenticatedEvaluationFetch<AnswerScript>(
    `/scripts/${scriptId}/evaluate/`,
    { method: "POST" },
  );
}

export async function getEvaluationReport(
  scriptId: string,
): Promise<EvaluationReport> {
  return authenticatedEvaluationFetch<EvaluationReport>(
    `/scripts/${scriptId}/report/`,
  );
}

export async function deleteScript(id: string): Promise<void> {
  await authenticatedEvaluationFetch(`/scripts/${id}/`, { method: "DELETE" });
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

// ─── Submission Forms ───────────────────────────────────────────────────────

export interface SubmissionForm {
  id: string;
  assignment: string;
  title: string;
  description: string;
  status: "open" | "closed";
  deadline: string | null;
  subject_name: string;
  subject_code: string;
  section_name: string;
  class_name: string;
  teacher_name: string;
  submission_count: number;
  pending_count: number;
  evaluated_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionFormCreate {
  assignment: string;
  title: string;
  description?: string;
  deadline?: string;
}

export interface BatchEvaluateResult {
  total: number;
  success: number;
  failed: number;
  errors: { script_id: string; error: string }[];
}

/** List teacher's submission forms. */
export async function getSubmissionForms(): Promise<SubmissionForm[]> {
  return authenticatedEvaluationFetch<SubmissionForm[]>("/forms/");
}

/** Create a new submission form. */
export async function createSubmissionForm(
  data: SubmissionFormCreate,
): Promise<SubmissionForm> {
  return authenticatedEvaluationFetch<SubmissionForm>("/forms/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Get a single submission form. */
export async function getSubmissionForm(
  formId: string,
): Promise<SubmissionForm> {
  return authenticatedEvaluationFetch<SubmissionForm>(`/forms/${formId}/`);
}

/** Close a submission form. */
export async function closeSubmissionForm(
  formId: string,
): Promise<SubmissionForm> {
  return authenticatedEvaluationFetch<SubmissionForm>(`/forms/${formId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "closed" }),
  });
}

/** Re-open a submission form. */
export async function reopenSubmissionForm(
  formId: string,
): Promise<SubmissionForm> {
  return authenticatedEvaluationFetch<SubmissionForm>(`/forms/${formId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "open" }),
  });
}

/** List scripts submitted to a form. */
export async function getFormSubmissions(
  formId: string,
): Promise<AnswerScript[]> {
  return authenticatedEvaluationFetch<AnswerScript[]>(
    `/forms/${formId}/submissions/`,
  );
}

/** Batch evaluate all pending scripts in a form. */
export async function evaluateAllScripts(
  formId: string,
  rubricSetId: string,
): Promise<BatchEvaluateResult> {
  return authenticatedEvaluationFetch<BatchEvaluateResult>(
    `/forms/${formId}/evaluate-all/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rubric_set_id: rubricSetId }),
    },
  );
}

// ─── Student Submission Endpoints ───────────────────────────────────────────

/** List open submission forms for the logged-in student. */
export async function getStudentOpenForms(): Promise<SubmissionForm[]> {
  return authenticatedEvaluationFetch<SubmissionForm[]>("/my-forms/");
}

/** Student submits script pages to an open form. */
export async function submitStudentScript(
  formId: string,
  pages: File[],
): Promise<AnswerScript> {
  const formData = new FormData();
  pages.forEach((page) => formData.append("pages", page));

  return authenticatedEvaluationFetch<AnswerScript>(
    `/my-forms/${formId}/submit/`,
    {
      method: "POST",
      body: formData,
    },
  );
}

/** Get the student's own submitted scripts. */
export async function getMyScripts(): Promise<AnswerScript[]> {
  return authenticatedEvaluationFetch<AnswerScript[]>("/my-scripts/");
}

// ─── Insights / Analytics ───────────────────────────────────────────────────

export interface EvaluationInsights {
  overview: {
    total_scripts: number;
    evaluated_count: number;
    pending_count: number;
    avg_score: number;
    avg_percentage: number;
  };
  section_performance: {
    section_name: string;
    class_name: string;
    avg_percentage: number;
    script_count: number;
  }[];
  score_distribution: {
    bucket: string;
    count: number;
  }[];
  question_analysis: {
    question_number: string;
    question_text: string;
    avg_marks: number;
    max_marks: number;
  }[];
  top_performers: PerformerEntry[];
  bottom_performers: PerformerEntry[];
  submission_timeline: {
    week: string;
    submitted: number;
    evaluated: number;
  }[];
}

export interface PerformerEntry {
  user_id: string;
  name: string;
  roll_number: string;
  section: string;
  class_name: string;
  avg_percentage: number;
  script_count: number;
}

/** Fetch aggregated evaluation analytics for the logged-in teacher. */
export async function getEvaluationInsights(): Promise<EvaluationInsights> {
  return authenticatedEvaluationFetch<EvaluationInsights>("/insights/");
}
