/**
 * Rubrics API Client
 *
 * Provides functions to interact with the rubrics API endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api`;

// Types
type RuleType = "keyword" | "numeric" | "stepwise";

interface KeywordConfig {
  required_keywords: string[];
  scoring_mode: "proportional" | "all_or_nothing";
}

interface NumericConfig {
  expected_value: number;
  tolerance: number;
}

interface StepwiseConfig {
  step_description: string;
  expected_patterns: string[];
  allow_partial_credit: boolean;
}

interface RuleFeedback {
  on_success: string;
  on_partial?: string;
  on_failure: string;
}

export interface EvaluationRule {
  id: string;
  type: RuleType;
  marks: number;
  config: KeywordConfig | NumericConfig | StepwiseConfig;
  feedback: RuleFeedback;
}

export interface Rubric {
  id: string;
  version: number;
  state: "draft" | "published" | "archived";
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: EvaluationRule[];
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

export interface CreateRubricPayload {
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: EvaluationRule[];
}

export interface TestRubricPayload {
  sample_answer: string;
}

export interface TestRubricResult {
  total_score: number;
  max_score: number;
  percentage: number;
  rule_results: Array<{
    rule_id: string;
    rule_type: string;
    score_awarded: number;
    max_marks: number;
    matched: boolean;
    feedback_message: string;
  }>;
  feedback: string;
}

/**
 * Create a new rubric
 */
export async function createRubric(
  payload: CreateRubricPayload,
): Promise<Rubric> {
  const response = await fetch(`${API_URL}/rubrics/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to create rubric" }));
    throw new Error(error.detail || "Failed to create rubric");
  }

  return response.json();
}

/**
 * Update an existing rubric
 */
export async function updateRubric(
  id: string,
  payload: Partial<CreateRubricPayload>,
): Promise<Rubric> {
  const response = await fetch(`${API_URL}/rubrics/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to update rubric" }));
    throw new Error(error.detail || "Failed to update rubric");
  }

  return response.json();
}

/**
 * Publish a rubric (change state from draft to published)
 */
export async function publishRubric(id: string): Promise<Rubric> {
  const response = await fetch(`${API_URL}/rubrics/${id}/publish/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to publish rubric" }));
    throw new Error(error.detail || "Failed to publish rubric");
  }

  return response.json();
}

/**
 * List all rubrics with optional filtering
 */
export async function listRubrics(params?: {
  state?: "draft" | "published" | "archived";
  subject?: string;
}): Promise<RubricListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.state) queryParams.append("state", params.state);
  if (params?.subject) queryParams.append("subject", params.subject);

  const url = `${API_URL}/rubrics/${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to list rubrics");
  }

  const data = await response.json();
  return data.results || data;
}

/**
 * Get a specific rubric by ID
 */
export async function getRubric(id: string): Promise<Rubric> {
  const response = await fetch(`${API_URL}/rubrics/${id}/`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Rubric not found");
    }
    throw new Error("Failed to get rubric");
  }

  return response.json();
}

/**
 * Archive a rubric (change state to archived)
 */
export async function archiveRubric(id: string): Promise<Rubric> {
  const response = await fetch(`${API_URL}/rubrics/${id}/archive/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to archive rubric" }));
    throw new Error(error.detail || "Failed to archive rubric");
  }

  return response.json();
}

/**
 * Test a rubric against a sample answer
 * Can accept either a rubric ID or a rubric configuration for testing
 */
export async function testRubric(
  rubricOrId:
    | string
    | { evaluation_rules: EvaluationRule[]; total_marks: number },
  sampleAnswer: string,
): Promise<TestRubricResult> {
  let url: string;
  let body: any;

  if (typeof rubricOrId === "string") {
    // Testing a saved rubric by ID
    url = `${API_URL}/rubrics/${rubricOrId}/test/`;
    body = { sample_answer: sampleAnswer };
  } else {
    // Testing a rubric configuration directly
    url = `${API_URL}/rubrics/test/`;
    body = {
      rubric: rubricOrId,
      answer_text: sampleAnswer,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Failed to test rubric" }));
    throw new Error(error.detail || "Failed to test rubric");
  }

  return response.json();
}
