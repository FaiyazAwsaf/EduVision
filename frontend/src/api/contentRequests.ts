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
import type {
  CreateContentRequestPayload,
  ContentRequest,
  GeneratedContent,
  ApiError,
  OutputFormat,
} from "@/types/content";

/**
 * Create a new content generation request
 *
 * @param payload - Request creation data
 * @returns Created content request with assigned ID
 * @throws Error if request fails
 */
export async function createContentRequest(
  payload: CreateContentRequestPayload
): Promise<ContentRequest> {
  const response = await fetch(API_ENDPOINTS.CONTENT_REQUESTS, {
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
  requestId: string
): Promise<ContentRequest> {
  const response = await fetch(
    API_ENDPOINTS.CONTENT_REQUEST_DETAIL(requestId),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
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
  format: "json" | "text" = "json"
): Promise<GeneratedContent> {
  const url = `${API_ENDPOINTS.GENERATED_CONTENT(requestId)}?format=${format}`;

  const response = await fetch(url, {
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
  format: Extract<OutputFormat, OutputFormat.PDF | OutputFormat.WORKSHEET>
): Promise<void> {
  const formatParam = format.toLowerCase();
  const url = `${API_ENDPOINTS.GENERATED_CONTENT(
    requestId
  )}download/?format=${formatParam}`;

  const response = await fetch(url, {
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
 * List all content requests (for future use)
 *
 * @returns Array of content requests
 */
export async function listContentRequests(): Promise<ContentRequest[]> {
  const response = await fetch(API_ENDPOINTS.CONTENT_REQUESTS, {
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

// ============================================================================
// Phase 3: Feedback API Functions
// ============================================================================

import type { Feedback, FeedbackPayload } from "@/types/content";

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
  feedback: FeedbackPayload
): Promise<Feedback> {
  const response = await fetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}generated-content/${contentId}/feedback/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedback),
    }
  );

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.detail || "Failed to submit feedback"
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
  const response = await fetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}generated-content/${contentId}/feedback/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 404) {
    return null; // No feedback exists yet
  }

  if (!response.ok) {
    throw new Error("Failed to check feedback status");
  }

  return response.json();
}

// ============================================================================
// Phase 4: Learning Context API Functions
// ============================================================================

import type { LearningContext, LearningContextPayload } from "@/types/content";

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
  context: LearningContextPayload
): Promise<LearningContext> {
  const response = await fetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}${requestId}/context/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context),
    }
  );

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.detail || "Failed to submit learning context"
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
  requestId: string
): Promise<LearningContext | null> {
  const response = await fetch(
    `${API_ENDPOINTS.CONTENT_REQUESTS}${requestId}/context/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 404) {
    return null; // No context exists yet
  }

  if (!response.ok) {
    throw new Error("Failed to get learning context");
  }

  return response.json();
}
