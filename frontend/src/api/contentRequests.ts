/**
 * Content Request API Service
 *
 * Centralized API layer for all content request operations.
 * Handles HTTP communication, error handling, and response parsing.
 *
 * Design principles:
 * - No UI logic here
 * - Throw errors for callers to handle
 * - Type-safe responses
 */

import { API_ENDPOINTS } from "@/config/api";
import { authenticatedFetch } from "@/api/auth";
import type {
  CreateContentRequestPayload,
  ContentRequest,
  GeneratedContent,
  ApiError,
  OutputFormat,
  Feedback,
  FeedbackPayload,
  LearningContext,
  LearningContextPayload,
  StudyPlan,
  StudyPlanItem,
  CreateStudyPlanPayload,
  CreateStudyPlanItemPayload,
  UpdateStudyPlanItemPayload,
} from "@/types/content";

/**
 * Create a new content generation request
 *
 * @param payload - Request creation data
 * @returns Created content request with assigned ID
 * @throws Error if request fails
 */
export async function createContentRequest(
  payload: CreateContentRequestPayload,
): Promise<ContentRequest> {
  const response = await authenticatedFetch(API_ENDPOINTS.CONTENT_REQUESTS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to create content request",
    }));
    // Extract field-level validation errors (e.g. off-topic) for a clearer message
    const fieldErrors = (error as Record<string, unknown>).errors as
      | Record<string, string[]>
      | undefined;
    if (fieldErrors) {
      const firstMsg = Object.values(fieldErrors).flat()[0];
      if (firstMsg) throw new Error(firstMsg);
    }
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

/**
 * Get status and details of a content request
 *
 * @param requestId - UUID of the content request
 * @returns Current request status and metadata
 * @throws Error if request not found or network fails
 */
export async function getRequestStatus(
  requestId: string,
): Promise<ContentRequest> {
  const response = await authenticatedFetch(
    API_ENDPOINTS.CONTENT_REQUEST_DETAIL(requestId),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Content request not found");
    }
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to fetch request status",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

/**
 * Get generated content for a completed request
 *
 * For TEXT format: Returns JSON with content_text
 * For PDF/WORKSHEET: Use downloadGeneratedContent instead
 *
 * @param requestId - UUID of the content request
 * @param format - Output format (defaults to 'json')
 * @returns Generated content data
 * @throws Error if content not available or request fails
 */
export async function getGeneratedContent(
  requestId: string,
  format: "json" | "text" = "json",
): Promise<GeneratedContent> {
  const url = `${API_ENDPOINTS.GENERATED_CONTENT(requestId)}?format=${format}`;

  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const error: ApiError = await response.json().catch(() => ({
        error: "Content not yet generated",
      }));
      throw new Error(error.error || error.detail || "Content not available");
    }
    throw new Error("Failed to fetch generated content");
  }

  return response.json();
}

/**
 * Download generated content as a file (PDF or WORKSHEET)
 *
 * Triggers browser download with appropriate filename.
 *
 * @param requestId - UUID of the content request
 * @param format - Output format ('pdf' or 'worksheet')
 * @throws Error if download fails
 */
export async function downloadGeneratedContent(
  requestId: string,
  format: Extract<OutputFormat, OutputFormat.PDF | OutputFormat.WORKSHEET>,
): Promise<void> {
  const formatParam = format.toLowerCase();
  const url = `${API_ENDPOINTS.GENERATED_CONTENT(
    requestId,
  )}download/?format=${formatParam}`;

  const response = await authenticatedFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    // Try to get error details from response
    let errorMessage = "Failed to download content";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.detail || errorMessage;
    } catch {
      // Response is not JSON, use default message
      if (response.status === 404) {
        errorMessage = "Content not available for download";
      }
    }
    throw new Error(`${errorMessage} (Status: ${response.status})`);
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `content_${requestId.slice(0, 8)}.pdf`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  // Create blob and trigger download
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Filter options for listing content requests
 */
export interface ContentRequestFilters {
  status?: string;
  content_type?: string;
  subject?: string;
  search?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
}

export interface ContentRequestListResponse {
  results: ContentRequest[];
  count: number;
  total: number;
}

/**
 * List content requests with optional filters
 *
 * @param filters - Optional filter parameters
 * @returns Paginated content request list with total count
 */
export async function listContentRequests(
  filters?: ContentRequestFilters,
): Promise<ContentRequestListResponse> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        params.append(key, String(value));
      }
    });
  }

  const url = params.toString()
    ? `${API_ENDPOINTS.CONTENT_REQUESTS}?${params.toString()}`
    : API_ENDPOINTS.CONTENT_REQUESTS;

  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch content requests");
  }

  return response.json();
}

/**
 * Regenerate content from an existing request
 *
 * @param requestId - UUID of the original content request
 * @returns Newly created content request
 */
export async function regenerateContentRequest(
  requestId: string,
): Promise<ContentRequest> {
  const response = await authenticatedFetch(
    API_ENDPOINTS.REGENERATE_CONTENT(requestId),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to regenerate content",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

// ============================================================================
// Phase 3: Feedback API Functions
// ============================================================================

/**
 * Submit feedback for generated content
 *
 * @param contentId - UUID of the generated content
 * @param feedback - Feedback data
 * @returns Created feedback record
 * @throws Error if submission fails or feedback already exists
 */
export async function submitFeedback(
  contentId: string,
  feedback: FeedbackPayload,
): Promise<Feedback> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}generated-content/${contentId}/feedback/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedback),
    },
  );

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.detail || "Failed to submit feedback",
    );
  }

  return response.json();
}

/**
 * Get existing feedback for generated content
 *
 * @param contentId - UUID of the generated content
 * @returns Feedback if it exists, null if not found
 * @throws Error if request fails (other than 404)
 */
export async function getFeedback(contentId: string): Promise<Feedback | null> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}generated-content/${contentId}/feedback/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to check feedback status");
  }

  const data = await response.json();
  return data.feedback ?? data;
}

// ============================================================================
// Phase 4: Learning Context API Functions
// ============================================================================

/**
 * Submit learning context for a content request
 *
 * Creates or updates learning context to personalize AI generation.
 * Should be called AFTER creating the content request but BEFORE generation starts.
 *
 * @param requestId - UUID of the content request
 * @param context - Learning context data
 * @returns Created/updated learning context record
 * @throws Error if submission fails or request not found
 */
export async function submitLearningContext(
  requestId: string,
  context: LearningContextPayload,
): Promise<LearningContext> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}${requestId}/context/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
    },
  );

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        errorData.detail ||
        "Failed to submit learning context",
    );
  }

  return response.json();
}

/**
 * Get learning context for a content request
 *
 * @param requestId - UUID of the content request
 * @returns Learning context if it exists, null if not found
 * @throws Error if request fails (other than 404)
 */
export async function getLearningContext(
  requestId: string,
): Promise<LearningContext | null> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}${requestId}/context/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null; // No context exists yet
  }

  if (!response.ok) {
    throw new Error("Failed to get learning context");
  }

  return response.json();
}

// ============================================================================
// Phase 5: Study Plan API Functions (Manual Mode Only)
// ============================================================================

/**
 * Create a new study plan
 *
 * Phase 5: Always creates in manual mode with auto_detect_weakness=false
 *
 * @param payload - Study plan creation data
 * @returns Created study plan with assigned ID
 * @throws Error if request fails
 */
export async function createStudyPlan(
  payload: CreateStudyPlanPayload,
): Promise<StudyPlan> {
  const response = await authenticatedFetch(API_ENDPOINTS.STUDY_PLANS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to create study plan",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

/**
 * List all study plans
 *
 * [FUTURE] When auth is implemented, will filter by current user
 *
 * @returns Array of study plans with their items
 * @throws Error if request fails
 */
export async function listStudyPlans(): Promise<StudyPlan[]> {
  const response = await authenticatedFetch(API_ENDPOINTS.STUDY_PLANS, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch study plans");
  }

  return response.json();
}

/**
 * Get a specific study plan with all its items
 *
 * @param planId - UUID of the study plan
 * @returns Study plan with all items
 * @throws Error if request fails or plan not found
 */
export async function getStudyPlan(planId: string): Promise<StudyPlan> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLANS}${planId}/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Study plan not found");
    }
    throw new Error("Failed to fetch study plan");
  }

  return response.json();
}

/**
 * Delete a study plan and all its items
 *
 * @param planId - UUID of the study plan
 * @throws Error if request fails
 */
export async function deleteStudyPlan(planId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLANS}${planId}/`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to delete study plan");
  }
}

/**
 * Add an item to a study plan
 *
 * Phase 5: All items created with source='manual'
 *
 * @param planId - UUID of the study plan
 * @param payload - Item creation data
 * @returns Created study plan item
 * @throws Error if request fails
 */
export async function addStudyPlanItem(
  planId: string,
  payload: CreateStudyPlanItemPayload,
): Promise<StudyPlanItem> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLANS}${planId}/items/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to add study plan item",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

/**
 * List study plan items
 *
 * @param studyPlanId - Optional: filter items by study plan
 * @returns Array of study plan items
 * @throws Error if request fails
 */
export async function listStudyPlanItems(
  studyPlanId?: string,
): Promise<StudyPlanItem[]> {
  const url = studyPlanId
    ? `${API_ENDPOINTS.STUDY_PLAN_ITEMS}?study_plan_id=${studyPlanId}`
    : API_ENDPOINTS.STUDY_PLAN_ITEMS;

  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch study plan items");
  }

  return response.json();
}

/**
 * Get a specific study plan item
 *
 * @param itemId - UUID of the study plan item
 * @returns Study plan item details
 * @throws Error if request fails
 */
export async function getStudyPlanItem(itemId: string): Promise<StudyPlanItem> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLAN_ITEMS}${itemId}/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Study plan item not found");
    }
    throw new Error("Failed to fetch study plan item");
  }

  return response.json();
}

/**
 * Update a study plan item
 *
 * Commonly used to update status, priority, scheduled_date, or link content request
 *
 * @param itemId - UUID of the study plan item
 * @param payload - Fields to update
 * @returns Updated study plan item
 * @throws Error if request fails
 */
export async function updateStudyPlanItem(
  itemId: string,
  payload: UpdateStudyPlanItemPayload,
): Promise<StudyPlanItem> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLAN_ITEMS}${itemId}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to update study plan item",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

/**
 * Delete a study plan item
 *
 * @param itemId - UUID of the study plan item
 * @throws Error if request fails
 */
export async function deleteStudyPlanItem(itemId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLAN_ITEMS}${itemId}/`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to delete study plan item");
  }
}

/**
 * Mark a study plan item as completed
 *
 * Convenience function that calls the complete endpoint
 *
 * @param itemId - UUID of the study plan item
 * @returns Updated study plan item
 * @throws Error if request fails
 */
export async function markStudyPlanItemComplete(
  itemId: string,
): Promise<StudyPlanItem> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLAN_ITEMS}${itemId}/complete/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark item as complete");
  }

  return response.json();
}

/**
 * Link a content request to a study plan item
 *
 * @param itemId - UUID of the study plan item
 * @param requestId - UUID of the content request to link
 * @returns Updated study plan item
 * @throws Error if request fails
 */
export async function linkRequestToStudyPlanItem(
  itemId: string,
  requestId: string,
): Promise<StudyPlanItem> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.STUDY_PLAN_ITEMS}${itemId}/link-request/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request_id: requestId }),
    },
  );

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: "Failed to link content request",
    }));
    throw new Error(error.error || error.detail || "Unknown error occurred");
  }

  return response.json();
}

// ─── Shared Content (for students) ─────────────────────────────────────────

export interface SharedContentItem {
  id: string;
  topic: string;
  content_type: string;
  subject: string | null;
  difficulty: string | null;
  style: string;
  teacher_name: string | null;
  class_name: string | null;
  section_name: string | null;
  created_at: string;
}

export interface SharedContentListResponse {
  results: SharedContentItem[];
  total: number;
  count: number;
}

export interface SharedContentFilters {
  content_type?: string;
  subject?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * List content shared with the student's class/section by teachers.
 */
export async function listSharedContent(
  filters?: SharedContentFilters,
): Promise<SharedContentListResponse> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        params.append(key, String(value));
      }
    });
  }

  const base = `${API_ENDPOINTS.CONTENT_REQUESTS}shared/`;
  const url = params.toString() ? `${base}?${params.toString()}` : base;

  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch shared content");
  }

  return response.json();
}

// ─── Curriculum-Grouped Materials (for students) ───────────────────────────

export interface CurriculumMaterialItem {
  id: string;
  topic: string;
  content_type: string;
  subject: string | null;
  difficulty: string | null;
  style: string;
  teacher_name: string | null;
  curriculum_topic_title: string;
  week_number: number | null;
  created_at: string;
}

export interface CurriculumCourseGroup {
  course_id: string;
  course_title: string;
  course_code: string;
  materials: CurriculumMaterialItem[];
}

export interface CurriculumMaterialsResponse {
  courses: CurriculumCourseGroup[];
}

/**
 * List generated content linked to curriculum topics, grouped by course.
 * Only for students enrolled in the corresponding sections.
 */
export async function listCurriculumMaterials(): Promise<CurriculumMaterialsResponse> {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}shared/curriculum/`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch curriculum materials");
  }

  return response.json();
}
