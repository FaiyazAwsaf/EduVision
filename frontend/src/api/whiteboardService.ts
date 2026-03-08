/**
 * Whiteboard API Service
 * Handles communication with backend for session and state management
 */

import { API_BASE_URL } from "@/config/api";
import { getAccessToken } from "@/api/auth";

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  role: "teacher" | "student";
  is_authenticated: boolean;
}

export interface WhiteboardSession {
  id: string;
  name: string;
  owner: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  created_at: string;
  updated_at: string;
  is_active: boolean;
  metadata: Record<string, any>;
  members: Array<{
    id: string;
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
    role: string;
    joined_at: string;
    last_active_at: string;
  }>;
}

export interface WhiteboardSessionDetail extends WhiteboardSession {
  latest_state?: WhiteboardState;
}

export interface WhiteboardState {
  id: string;
  version: number;
  snapshot_json: any;
  latex_objects: any[];
  created_by: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  created_at: string;
  description: string;
}

/**
 * Helper to get auth headers with Bearer token
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  return headers;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me/`, {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Not authenticated. Please log in.");
      }
      if (response.status === 404) {
        throw new Error("Authentication endpoint not found. Please check if backend is configured correctly.");
      }
      throw new Error(`Failed to get current user: ${response.statusText}`);
    }

    const data = await response.json();
    // Extract user data from the payload wrapper
    return data.payload;
  } 
  catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Whiteboard API] Error getting current user:", errorMsg);
    
    // Provide more specific error messages
    if (errorMsg.includes("Failed to fetch")) {
      throw new Error("Cannot connect to backend. Is the server running? Check console for details.");
    }
    
    throw error;
  }
}

/**
 * Create a new whiteboard session
 */
export async function createSession(
  name: string,
  metadata?: Record<string, any>,
): Promise<WhiteboardSessionDetail> {
  try {
    const response = await fetch(`${API_BASE_URL}/whiteboard/sessions/`, {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        metadata: metadata || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return await response.json();
  } 
  catch (error) {
    console.error("[Whiteboard API] Error creating session:", error);
    throw error;
  }
}

/**
 * Get a specific whiteboard session with latest state
 */
export async function getSession(
  sessionId: string,
): Promise<WhiteboardSessionDetail> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/whiteboard/sessions/${sessionId}/`,
      {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Session not found");
      }
      if (response.status === 403) {
        throw new Error("Access denied to this session");
      }
      throw new Error(`Failed to get session: ${response.statusText}`);
    }

    return await response.json();
  } 
  catch (error) {
    console.error("[Whiteboard API] Error getting session:", error);
    throw error;
  }
}

/**
 * Get user's sessions (where they are owner or member)
 */
export async function getUserSessions(): Promise<WhiteboardSession[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/whiteboard/sessions/`, {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }

    return await response.json();
  } 
  catch (error) {
    console.error("[Whiteboard API] Error getting sessions:", error);
    throw error;
  }
}

/**
 * Get latest state of a session
 */
export async function getLatestState(
  sessionId: string,
): Promise<WhiteboardState | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/whiteboard/sessions/${sessionId}/latest-state/`,
      {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        // No state yet
        return null;
      }
      throw new Error(`Failed to get latest state: ${response.statusText}`);
    }

    return await response.json();
  } 
  catch (error) {
    console.error("[Whiteboard API] Error getting latest state:", error);
    throw error;
  }
}

/**
 * Save a whiteboard state snapshot
 */
export async function saveState(
  sessionId: string,
  snapshotJson: any,
  latexObjects: any[] = [],
  description?: string,
): Promise<WhiteboardState> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/whiteboard/sessions/${sessionId}/states/`,
      {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          snapshot_json: snapshotJson,
          latex_objects: latexObjects,
          description: description || "",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to save state: ${response.statusText}`);
    }

    return await response.json();
  } 
  catch (error) {
    console.error("[Whiteboard API] Error saving state:", error);
    throw error;
  }
}
