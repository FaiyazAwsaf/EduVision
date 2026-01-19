/**
 * API client for Rubric Builder operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Types
export interface RubricCreateData {
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: EvaluationRule[];
}

export interface RubricUpdateData extends Partial<RubricCreateData> {}

export interface EvaluationRule {
  id: string;
  type: "keyword" | "numeric" | "stepwise";
  marks: number;
  config: KeywordConfig | NumericConfig | StepwiseConfig;
  feedback: {
    on_success: string;
    on_partial?: string;
    on_failure: string;
  };
}

export interface KeywordConfig {
  required_keywords: string[];
  scoring_mode: "proportional" | "all_or_nothing";
}

export interface NumericConfig {
  expected_value: number;
  tolerance: number;
}

export interface StepwiseConfig {
  step_description: string;
  expected_patterns: string[];
  allow_partial_credit: boolean;
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
  created_by: string;
  created_at: string;
  updated_at: string;
  versions?: RubricVersion[];
}

export interface RubricVersion {
  id: string;
  version_number: number;
  snapshot: Record<string, any>;
  created_at: string;
}

export interface TestRubricResult {
  total_score: number;
  max_score: number;
  rule_results: RuleResult[];
  feedback: string;
}

export interface RuleResult {
  rule_id: string;
  rule_type: string;
  score_awarded: number;
  max_marks: number;
  matched: boolean;
  feedback_message: string;
}

export interface ApiError {
  detail?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Handle non-2xx responses
    if (!response.ok) {
      let errorData: ApiError = {};
      try {
        errorData = await response.json();
      } catch {
        // If JSON parsing fails, use status text
        errorData = { message: response.statusText };
      }

      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `API request failed with status ${response.status}`;

      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Parse JSON response
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Re-throw with more context if it's a network error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Network error: Unable to reach the API");
  }
}

/**
 * Create a new draft rubric
 */
export async function createRubric(data: RubricCreateData): Promise<Rubric> {
  return apiFetch<Rubric>("/rubrics/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get a list of all rubrics (filtered by user on backend)
 */
export async function listRubrics(): Promise<Rubric[]> {
  return apiFetch<Rubric[]>("/rubrics/");
}

/**
 * Get a specific rubric by ID
 */
export async function getRubric(id: string): Promise<Rubric> {
  return apiFetch<Rubric>(`/rubrics/${id}/`);
}

/**
 * Update an existing draft rubric
 */
export async function updateRubric(
  id: string,
  data: RubricUpdateData
): Promise<Rubric> {
  return apiFetch<Rubric>(`/rubrics/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Partially update an existing draft rubric
 */
export async function patchRubric(
  id: string,
  data: Partial<RubricUpdateData>
): Promise<Rubric> {
  return apiFetch<Rubric>(`/rubrics/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a draft rubric
 */
export async function deleteRubric(id: string): Promise<void> {
  return apiFetch<void>(`/rubrics/${id}/`, {
    method: "DELETE",
  });
}

/**
 * Publish a draft rubric (makes it read-only)
 */
export async function publishRubric(id: string): Promise<Rubric> {
  return apiFetch<Rubric>(`/rubrics/${id}/publish/`, {
    method: "POST",
  });
}

/**
 * Archive a published rubric
 */
export async function archiveRubric(id: string): Promise<Rubric> {
  return apiFetch<Rubric>(`/rubrics/${id}/archive/`, {
    method: "POST",
  });
}

/**
 * Get version history for a rubric
 */
export async function getRubricVersions(
  id: string
): Promise<RubricVersion[]> {
  return apiFetch<RubricVersion[]>(`/rubrics/${id}/versions/`);
}

/**
 * Test a rubric against a sample answer
 * Note: This uses the evaluation service to test the rubric
 */
export async function testRubric(
  rubricData: {
    evaluation_rules: EvaluationRule[];
    total_marks: number;
  },
  sampleAnswer: string
): Promise<TestRubricResult> {
  // Build the request payload
  const payload = {
    rubric: {
      evaluation_rules: rubricData.evaluation_rules,
      total_marks: rubricData.total_marks,
    },
    answer_text: sampleAnswer,
  };

  // Call the apply_rubric endpoint (you may need to create this endpoint)
  // For now, assuming an endpoint exists at /rubrics/test/
  return apiFetch<TestRubricResult>("/rubrics/test/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Export all API functions as a single object for convenience
 */
export const rubricsApi = {
  create: createRubric,
  list: listRubrics,
  get: getRubric,
  update: updateRubric,
  patch: patchRubric,
  delete: deleteRubric,
  publish: publishRubric,
  archive: archiveRubric,
  versions: getRubricVersions,
  test: testRubric,
};

export default rubricsApi;
