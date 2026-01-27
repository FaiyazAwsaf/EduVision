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

// ========================================
// Legacy Single-Question Rubric API
// (For backward compatibility with existing components)
// ========================================

export interface Rubric {
  id: string;
  version: number;
  state: "draft" | "published" | "archived";
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: any[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RubricListItem {
  id: string;
  title: string;
  subject: string;
  state: string;
  version: number;
  total_marks: number;
  created_at: string;
  updated_at: string;
}

export interface TestRubricResult {
  total_score: number;
  max_score: number;
  rule_results: {
    rule_id: string;
    rule_type: string;
    score_awarded: number;
    max_marks: number;
    matched: boolean;
    feedback_message: string;
  }[];
  feedback: string;
}

/**
 * List all rubrics (single-question)
 * @deprecated Use listRubricSets instead
 */
export async function listRubrics(filters?: {
  state?: string;
  subject?: string;
}): Promise<RubricListItem[]> {
  // Map to RubricSet API - convert multi-question rubrics to single-question format
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
 * Get a single rubric by ID
 * @deprecated Use getRubricSet instead
 */
export async function getRubric(id: string): Promise<Rubric> {
  // Map to RubricSet API
  const rubricSet = await getRubricSet(id);
  
  // Convert first question to legacy format
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
 * Archive a rubric
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
 * Test a single-question rubric with a sample answer
 * @deprecated Use testRubricSet for multi-question rubrics
 */
export async function testRubric(
  rubric: { evaluation_rules: any[]; total_marks: number },
  answer: string
): Promise<TestRubricResult> {
  // Create a temporary single-question rubric set for testing
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

  // Extract first question result
  const questionResult = result.question_results[0];

  return {
    total_score: questionResult.score,
    max_score: questionResult.max_marks,
    rule_results: questionResult.rule_results,
    feedback: questionResult.feedback,
  };
}
