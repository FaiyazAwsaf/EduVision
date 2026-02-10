/**
 * Shared API Client
 *
 * Centralized fetch wrapper for all API calls.
 * Provides consistent error handling, JSON parsing, and content-type headers.
 */

import { API_BASE_URL } from "@/config/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error?: string;
  detail?: string;
  non_field_errors?: string[];
  message?: string;
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

/**
 * Shared fetch wrapper with consistent error handling.
 *
 * - Automatically resolves URLs relative to API_BASE_URL
 * - Parses error responses and throws a descriptive Error
 * - Sets Content-Type: application/json by default (unless body is FormData)
 *
 * @param endpoint - URL path (absolute) or relative to API_BASE_URL
 * @param options  - Standard RequestInit options
 * @returns The raw Response object
 * @throws Error with parsed server message on non-2xx responses
 */
export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  // Default to JSON content-type unless body is FormData
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });
  return response;
}

/**
 * Parse a non-OK response into a descriptive error message.
 *
 * Tries to extract `error`, `detail`, `non_field_errors`, or `message`
 * from the JSON body. Falls back to a generic HTTP status message.
 */
export async function parseApiError(
  response: Response,
  fallbackMessage = "An unexpected error occurred",
): Promise<string> {
  try {
    const body: ApiErrorResponse = await response.json();
    return (
      body.error ||
      body.detail ||
      body.non_field_errors?.[0] ||
      body.message ||
      fallbackMessage
    );
  } catch {
    return `${fallbackMessage} (Status: ${response.status})`;
  }
}

// Re-export base URL for modules that need to construct URLs directly
export { API_BASE_URL };
