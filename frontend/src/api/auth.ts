/**
 * Authentication API Client
 *
 * Handles login, token refresh, and token management.
 * Built to match the backend authentication module's contract:
 *   POST /api/auth/login/    → { email, password }  → { message, payload: { access_token, refresh_token, user } }
 *   POST /api/auth/refresh/  → { refresh_token }     → { message, payload: <access_token> }
 */

import { API_BASE_URL, parseApiError } from "@/api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role: "teacher" | "student";
  date_joined: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface LoginResponse {
  message: string;
  payload: AuthTokens;
}

export interface RefreshResponse {
  message: string;
  payload: string; // new access token
}

// ─── Token storage helpers ───────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = "eduvision_access_token";
const REFRESH_TOKEN_KEY = "eduvision_refresh_token";
const USER_DATA_KEY = "eduvision_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUserData(): User | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(USER_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string, user: User): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  sessionStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(USER_DATA_KEY);
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await parseApiError(res, "Login failed");
    throw new Error(message);
  }

  const data: LoginResponse = await res.json();
  setTokens(
    data.payload.access_token,
    data.payload.refresh_token,
    data.payload.user,
  );
  return data;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data: RefreshResponse = await res.json();
    const newAccess = data.payload;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
    return newAccess;
  } catch {
    clearTokens();
    return null;
  }
}

export function logout(): void {
  clearTokens();
}

// ─── Change password ──────────────────────────────────────────────────────────

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<{ message: string }> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/auth/change-password/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await parseApiError(res, "Failed to change password");
    throw new Error(message);
  }

  return res.json();
}

/**
 * Helper: returns headers with Bearer token attached.
 * Use this for authenticated API requests.
 */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Authenticated fetch with auto-refresh ───────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

/**
 * A fetch wrapper that automatically refreshes the JWT access token on 401.
 * - Attaches the current access token as a Bearer header.
 * - On 401, refreshes the token once and retries the original request.
 * - Deduplicates concurrent refresh attempts so only one runs at a time.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = (token: string | null) => {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  };

  // First attempt with current token
  let token = getAccessToken();
  let response = await doFetch(token);

  if (response.status === 401) {
    // Try to refresh – deduplicate concurrent refreshes
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;

    if (newToken) {
      // Retry with the fresh token
      response = await doFetch(newToken);
    }
  }

  return response;
}
