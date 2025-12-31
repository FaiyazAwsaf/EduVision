/**
 * Tutoring API Client
 *
 * API client for tutoring session management.
 * Handles session creation, joining, and status checking.
 */

import { API_BASE_URL } from "@/config/api";

// Types
export interface TutoringUser {
  id: string;
  email: string;
  full_name: string;
  role: "TEACHER" | "STUDENT";
  created_at: string;
}

export interface SessionCreateResponse {
  session_id: string;
  room_id: string;
  token: string;
  status: string;
  join_url: string;
  livekit_ws_url: string | null;
  teacher_id: string;
}

export interface SessionJoinResponse {
  session_id: string;
  token: string;
  status: string;
  teacher_name: string;
  room_id: string;
  livekit_ws_url: string | null;
}

export interface SessionStatus {
  id: string;
  room_id: string;
  status: "WAITING" | "ACTIVE" | "GRACE" | "ENDED";
  teacher_id: string;
  teacher_name: string;
  student_id: string | null;
  student_name: string | null;
  created_at: string;
  ended_at: string | null;
}

export interface ApiError {
  error: string;
  detail: string;
  code: string;
}

// API Base URL for tutoring
const TUTORING_API_URL = `${API_BASE_URL}/api/tutoring`;

// Utility to get user ID from localStorage
export function getCurrentUserId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tutoring_user_id");
  }
  return null;
}

// Utility to set user ID in localStorage
export function setCurrentUserId(userId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tutoring_user_id", userId);
  }
}

// Utility to clear user ID from localStorage
export function clearCurrentUserId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("tutoring_user_id");
  }
}

// Headers helper
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const userId = getCurrentUserId();
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  return headers;
}

// Error handler
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: "Unknown error",
      detail: "An unexpected error occurred",
      code: "unknown_error",
    }));
    throw errorData;
  }
  return response.json();
}

/**
 * Get all tutoring users (for testing/development)
 */
export async function getUsers(): Promise<TutoringUser[]> {
  const response = await fetch(`${TUTORING_API_URL}/users/`, {
    method: "GET",
    headers: getHeaders(),
  });
  return handleResponse<TutoringUser[]>(response);
}

/**
 * Create a new tutoring user
 */
export async function createUser(
  email: string,
  fullName: string,
  role: "TEACHER" | "STUDENT"
): Promise<TutoringUser> {
  const response = await fetch(`${TUTORING_API_URL}/users/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      email,
      full_name: fullName,
      role,
    }),
  });
  return handleResponse<TutoringUser>(response);
}

/**
 * Create a new tutoring session (Teacher only)
 */
export async function createSession(): Promise<SessionCreateResponse> {
  const response = await fetch(`${TUTORING_API_URL}/sessions/create/`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse<SessionCreateResponse>(response);
}

/**
 * Join an existing tutoring session (Student only)
 */
export async function joinSession(
  roomId: string
): Promise<SessionJoinResponse> {
  const response = await fetch(`${TUTORING_API_URL}/sessions/join/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ room_id: roomId }),
  });
  return handleResponse<SessionJoinResponse>(response);
}

/**
 * Get session status
 */
export async function getSessionStatus(
  sessionId: string
): Promise<SessionStatus> {
  const response = await fetch(
    `${TUTORING_API_URL}/sessions/${sessionId}/status/`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );
  return handleResponse<SessionStatus>(response);
}

/**
 * End a tutoring session (Teacher only)
 * @param sessionId - The session ID to end
 * @param teacherId - Optional teacher ID to use (overrides localStorage)
 */
export async function endSession(sessionId: string, teacherId?: string): Promise<SessionStatus> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  // Use provided teacherId or fall back to localStorage
  const userId = teacherId || getCurrentUserId();
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  const response = await fetch(
    `${TUTORING_API_URL}/sessions/${sessionId}/end/`,
    {
      method: "POST",
      headers,
    }
  );
  return handleResponse<SessionStatus>(response);
}

/**
 * List sessions for the current user
 */
export async function listSessions(status?: string): Promise<SessionStatus[]> {
  const url = new URL(`${TUTORING_API_URL}/sessions/`);
  if (status) {
    url.searchParams.append("status", status);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });
  return handleResponse<SessionStatus[]>(response);
}

/**
 * Get user-friendly error message from API error
 */
export function getErrorMessage(error: ApiError): string {
  switch (error.code) {
    case "auth_required":
      return "Please select a user to continue";
    case "user_not_found":
      return "Selected user not found. Please select a different user.";
    case "teacher_required":
      return "Only teachers can create tutoring sessions";
    case "student_required":
      return "Only students can join tutoring sessions";
    case "room_not_found":
      return "This session doesn't exist";
    case "session_ended":
      return "This session has already ended";
    case "session_full":
      return "Another student has already joined this session";
    case "already_in_session":
      return "You are already in another active tutoring session";
    case "not_participant":
      return "You are not authorized to view this session";
    case "token_generation_failed":
      return "Failed to generate video token. Please try again.";
    default:
      return error.detail || error.error || "An unexpected error occurred";
  }
}
