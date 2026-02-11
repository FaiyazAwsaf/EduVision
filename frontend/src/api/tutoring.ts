/**
 * Tutoring API Client
 *
 * Section-based batch tutoring session management.
 * Supports JWT Bearer auth via authenticatedFetch.
 */

import { API_BASE_URL } from "@/config/api";
import { authenticatedFetch } from "@/api/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  livekit_ws_url: string | null;
  teacher_id: string;
  section_id: number;
  section_name: string;
  class_name: string;
}

export interface SessionJoinResponse {
  session_id: string;
  token: string;
  status: string;
  teacher_name: string;
  room_id: string;
  livekit_ws_url: string | null;
  section_name: string;
  class_name: string;
  participant_count: number;
}

export interface Participant {
  user_id: string;
  name: string;
  role: string;
  joined_at: string;
  left_at: string | null;
}

export interface SessionStatus {
  id: string;
  room_id: string;
  status: "WAITING" | "ACTIVE" | "GRACE" | "ENDED";
  teacher_id: string;
  teacher_name: string;
  section_id: number | null;
  section_name: string | null;
  class_name: string | null;
  participants: Participant[];
  participant_count: number;
  created_at: string;
  ended_at: string | null;
}

export interface AvailableSession {
  id: string;
  room_id: string;
  status: "WAITING" | "ACTIVE";
  teacher_name: string;
  section_name: string | null;
  class_name: string | null;
  participant_count: number;
  created_at: string;
}

export interface ApiError {
  error: string;
  detail: string;
  code: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TUTORING_API_URL = `${API_BASE_URL}/tutoring`;

// ─── Utility ──────────────────────────────────────────────────────────────────

export function getCurrentUserId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tutoring_user_id");
  }
  return null;
}

export function setCurrentUserId(userId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tutoring_user_id", userId);
  }
}

export function clearCurrentUserId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("tutoring_user_id");
  }
}

function getContentHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

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

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Create a new tutoring session for a specific section (Teacher only)
 */
export async function createSession(
  sectionId: number,
): Promise<SessionCreateResponse> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/create/`,
    {
      method: "POST",
      headers: getContentHeaders(),
      body: JSON.stringify({ section_id: sectionId }),
    },
  );
  return handleResponse<SessionCreateResponse>(response);
}

/**
 * Join a tutoring session by session_id (Student only)
 */
export async function joinSession(
  sessionId: string,
): Promise<SessionJoinResponse> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/join/`,
    {
      method: "POST",
      headers: getContentHeaders(),
      body: JSON.stringify({ session_id: sessionId }),
    },
  );
  return handleResponse<SessionJoinResponse>(response);
}

/**
 * Get available sessions for the student's section
 */
export async function getAvailableSessions(): Promise<AvailableSession[]> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/available/`,
    {
      method: "GET",
      headers: getContentHeaders(),
    },
  );
  return handleResponse<AvailableSession[]>(response);
}

/**
 * Leave a tutoring session (Student only)
 */
export async function leaveSession(sessionId: string): Promise<void> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/${sessionId}/leave/`,
    {
      method: "POST",
      headers: getContentHeaders(),
    },
  );
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: "Unknown error",
      detail: "An unexpected error occurred",
      code: "unknown_error",
    }));
    throw errorData;
  }
}

/**
 * Get session status
 */
export async function getSessionStatus(
  sessionId: string,
): Promise<SessionStatus> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/${sessionId}/status/`,
    {
      method: "GET",
      headers: getContentHeaders(),
    },
  );
  return handleResponse<SessionStatus>(response);
}

/**
 * End a tutoring session (Teacher only)
 */
export async function endSession(sessionId: string): Promise<SessionStatus> {
  const response = await authenticatedFetch(
    `${TUTORING_API_URL}/sessions/${sessionId}/end/`,
    {
      method: "POST",
      headers: getContentHeaders(),
    },
  );
  return handleResponse<SessionStatus>(response);
}

/**
 * List sessions for the current user
 */
export async function listSessions(
  statusFilter?: string,
): Promise<SessionStatus[]> {
  const url = new URL(`${TUTORING_API_URL}/sessions/`);
  if (statusFilter) {
    url.searchParams.append("status", statusFilter);
  }

  const response = await authenticatedFetch(url.toString(), {
    method: "GET",
    headers: getContentHeaders(),
  });
  return handleResponse<SessionStatus[]>(response);
}

/**
 * Get user-friendly error message from API error
 */
export function getErrorMessage(error: ApiError): string {
  switch (error.code) {
    case "auth_required":
      return "Please sign in to continue";
    case "teacher_required":
      return "Only teachers can create tutoring sessions";
    case "student_required":
      return "Only students can join tutoring sessions";
    case "session_not_found":
    case "room_not_found":
      return "This session doesn't exist";
    case "section_not_found":
      return "Section not found";
    case "not_assigned":
      return "You are not assigned to this section";
    case "already_active":
      return "You already have an active session";
    case "session_ended":
      return "This session has already ended";
    case "wrong_section":
      return "This session is not for your section";
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
