/**
 * Rubric API Client
 * Handles multi-question assessment rubrics
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api`;

// Types
export interface QuestionRubric {
  id?: string;
  question_number: number;
  question_text: string;
  max_marks: number;
  evaluation_rules: any[]; // Reuse existing EvaluationRule type
  created_at?: string;
  updated_at?: string;
}

export interface RubricSet {
  id: string;
  version: number;
  state: "draft" | "published" | "archived";
  title: string;
  subject: string;
  total_marks: number;
  metadata?: Record<string, any>;
  questions: QuestionRubric[];
  created_by?: string;
  created_at: string;
  updated_at: string;
  versions?: any[];
}

export interface RubricSetListItem {
  id: string;
  title: string;
  subject: string;
  state: string;
  version: number;
  total_marks: number;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRubricSetPayload {
  title: string;
  subject: string;
  total_marks: number;
  metadata?: Record<string, any>;
  questions: Omit<QuestionRubric, "id" | "created_at" | "updated_at">[];
}

export interface QuestionResult {
  question_number: number;
  question_text: string;
  score: number;
  max_marks: number;
  percentage: number;
  rule_results: any[];
  feedback: string;
}

export interface TestRubricSetResult {
  total_score: number;
  max_score: number;
  percentage: number;
  question_results: QuestionResult[];
  feedback: string;
}

/**
 * Create a new rubric set
 */
export async function createRubricSet(
  payload: CreateRubricSetPayload
): Promise<RubricSet> {
  const response = await fetch(`${API_URL}/rubrics/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create rubric set");
  }

  return response.json();
}

/**
 * Update an existing rubric set
 */
export async function updateRubricSet(
  id: string,
  payload: Partial<CreateRubricSetPayload>
): Promise<RubricSet> {
  const response = await fetch(`${API_URL}/rubrics/${id}/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update rubric set");
  }

  return response.json();
}

/**
 * Publish a draft rubric set
 */
export async function publishRubricSet(id: string): Promise<RubricSet> {
  const response = await fetch(`${API_URL}/rubrics/${id}/publish/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to publish rubric set");
  }

  return response.json();
}

/**
 * Test a rubric set with sample answers
 */
export async function testRubricSet(
  rubricSet: { questions: QuestionRubric[] },
  answers: Record<number, string>
): Promise<TestRubricSetResult> {
  const response = await fetch(`${API_URL}/rubrics/test/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rubric_set: rubricSet,
      answers: answers,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to test rubric set");
  }

  return response.json();
}

/**
 * Get a single rubric set
 */
export async function getRubricSet(id: string): Promise<RubricSet> {
  const response = await fetch(`${API_URL}/rubrics/${id}/`);

  if (!response.ok) {
    throw new Error("Failed to fetch rubric set");
  }

  return response.json();
}

/**
 * List all rubric sets
 */
export async function listRubricSets(filters?: {
  state?: string;
  subject?: string;
}): Promise<RubricSetListItem[]> {
  const params = new URLSearchParams();
  if (filters?.state) params.append("state", filters.state);
  if (filters?.subject) params.append("subject", filters.subject);

  const url = `${API_URL}/rubrics/${params.toString() ? "?" + params.toString() : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch rubric sets");
  }

  return response.json();
}

/**
 * Delete a draft rubric set
 */
export async function deleteRubricSet(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/rubrics/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete rubric set");
  }
}

/**
 * Archive a published rubric set
 */
export async function archiveRubricSet(id: string): Promise<RubricSet> {
  const response = await fetch(`${API_URL}/rubrics/${id}/archive/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to archive rubric set");
  }

  return response.json();
}

/**
 * Get version history of a rubric set
 */
export async function getRubricSetVersions(id: string): Promise<any[]> {
  const response = await fetch(`${API_URL}/rubrics/${id}/versions/`);

  if (!response.ok) {
    throw new Error("Failed to fetch rubric set versions");
  }

  return response.json();
}
