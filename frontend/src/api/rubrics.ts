/**
 * Rubric API Client
 *
 * Handles multi-question assessment rubrics CRUD operations.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import type {
  QuestionRubric,
  RubricSet,
  RubricSetListItem,
  CreateRubricSetPayload,
  TestRubricSetResult,
  Rubric,
  RubricListItem,
  TestRubricResult,
  EvaluationRule,
  RubricVersion,
} from "@/types/rubrics";

// Re-export types for consumers
export type {
  QuestionRubric,
  RubricSet,
  RubricSetListItem,
  CreateRubricSetPayload,
  TestRubricSetResult,
  QuestionResult,
  Rubric,
  RubricListItem,
  TestRubricResult,
  EvaluationRule,
  RubricVersion,
} from "@/types/rubrics";

// ─── Helper ──────────────────────────────────────────────────────────────────

const RUBRICS_URL = `${API_BASE_URL}/rubrics`;

async function rubricsFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const message = await parseApiError(response, `Failed rubric operation`);
    throw new Error(message);
  }

  return response.json();
}

// ─── RubricSet CRUD ──────────────────────────────────────────────────────────

export async function createRubricSet(
  payload: CreateRubricSetPayload,
): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateRubricSet(
  id: string,
  payload: Partial<CreateRubricSetPayload>,
): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function publishRubricSet(id: string): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/${id}/publish/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function testRubricSet(
  rubricSet: { questions: QuestionRubric[] },
  answers: Record<number, string>,
): Promise<TestRubricSetResult> {
  return rubricsFetch<TestRubricSetResult>(`${RUBRICS_URL}/test/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rubric_set: rubricSet,
      answers: answers,
    }),
  });
}

export async function getRubricSet(id: string): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/${id}/`);
}

export async function listRubricSets(filters?: {
  state?: string;
  subject?: string;
}): Promise<RubricSetListItem[]> {
  const params = new URLSearchParams();
  if (filters?.state) params.append("state", filters.state);
  if (filters?.subject) params.append("subject", filters.subject);

  const query = params.toString() ? `?${params.toString()}` : "";
  return rubricsFetch<RubricSetListItem[]>(`${RUBRICS_URL}/${query}`);
}

export async function deleteRubricSet(id: string): Promise<void> {
  const response = await fetch(`${RUBRICS_URL}/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const message = await parseApiError(
      response,
      "Failed to delete rubric set",
    );
    throw new Error(message);
  }
}

export async function archiveRubricSet(id: string): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/${id}/archive/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function createDraftCopy(id: string): Promise<RubricSet> {
  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/${id}/create_draft_copy/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function parseRubricDocument(file: File): Promise<RubricSet> {
  const formData = new FormData();
  formData.append("file", file);

  return rubricsFetch<RubricSet>(`${RUBRICS_URL}/parse_document/`, {
    method: "POST",
    body: formData,
  });
}

export async function getRubricSetVersions(
  id: string,
): Promise<RubricVersion[]> {
  return rubricsFetch<RubricVersion[]>(`${RUBRICS_URL}/${id}/versions/`);
}

// ─── Legacy Single-Question API ──────────────────────────────────────────────
// For backward compatibility with existing components

/**
 * @deprecated Use listRubricSets instead
 */
export async function listRubrics(filters?: {
  state?: string;
  subject?: string;
}): Promise<RubricListItem[]> {
  const rubricSets = await listRubricSets(filters);
  return rubricSets.map((rs) => ({
    id: rs.id,
    title: rs.title,
    subject: rs.subject,
    state: rs.state,
    version: rs.version,
    total_marks: rs.total_marks,
    created_at: rs.created_at,
    updated_at: rs.updated_at,
  }));
}

/**
 * @deprecated Use getRubricSet instead
 */
export async function getRubric(id: string): Promise<Rubric> {
  const rubricSet = await getRubricSet(id);

  const firstQuestion = rubricSet.questions[0] || {
    question_text: "",
    evaluation_rules: [],
    max_marks: rubricSet.total_marks,
  };

  return {
    id: rubricSet.id,
    version: rubricSet.version,
    state: rubricSet.state,
    title: rubricSet.title,
    subject: rubricSet.subject,
    question_text: firstQuestion.question_text,
    reference_answer: "",
    total_marks: rubricSet.total_marks,
    evaluation_rules: firstQuestion.evaluation_rules,
    created_by: rubricSet.created_by,
    created_at: rubricSet.created_at,
    updated_at: rubricSet.updated_at,
  };
}

/**
 * @deprecated Use archiveRubricSet instead
 */
export async function archiveRubric(id: string): Promise<Rubric> {
  const rubricSet = await archiveRubricSet(id);
  const firstQuestion = rubricSet.questions[0] || {
    question_text: "",
    evaluation_rules: [],
    max_marks: rubricSet.total_marks,
  };

  return {
    id: rubricSet.id,
    version: rubricSet.version,
    state: rubricSet.state,
    title: rubricSet.title,
    subject: rubricSet.subject,
    question_text: firstQuestion.question_text,
    reference_answer: "",
    total_marks: rubricSet.total_marks,
    evaluation_rules: firstQuestion.evaluation_rules,
    created_by: rubricSet.created_by,
    created_at: rubricSet.created_at,
    updated_at: rubricSet.updated_at,
  };
}

/**
 * @deprecated Use testRubricSet for multi-question rubrics
 */
export async function testRubric(
  rubric: { evaluation_rules: EvaluationRule[]; total_marks: number },
  answer: string,
): Promise<TestRubricResult> {
  const rubricSet = {
    questions: [
      {
        question_number: 1,
        question_text: "Test Question",
        max_marks: rubric.total_marks,
        evaluation_rules: rubric.evaluation_rules,
      },
    ],
  };

  const answers = { 1: answer };
  const result = await testRubricSet(rubricSet, answers);
  const questionResult = result.question_results[0];

  return {
    total_score: questionResult.score,
    max_score: questionResult.max_marks,
    rule_results: questionResult.rule_results,
    feedback: questionResult.feedback,
  };
}
