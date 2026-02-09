/**
 * Authentication API Client
 *
 * Handles login, token refresh, and token management.
 * Built to match the backend authentication module's contract:
 *   POST /api/auth/login/    → { email, password }  → { message, payload: { access_token, refresh_token, user } }
 *   POST /api/auth/refresh/  → { refresh_token }     → { message, payload: <access_token> }
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

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
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUserData(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(USER_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string, user: User): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.non_field_errors?.[0] ??
      body?.detail ??
      body?.message ??
      "Login failed";
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
    const res = await fetch(`${API_URL}/auth/refresh/`, {
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
    localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
    return newAccess;
  } catch {
    clearTokens();
    return null;
  }
}

export function logout(): void {
  clearTokens();
}

/**
 * Helper: returns headers with Bearer token attached.
 * Use this for authenticated API requests.
 */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
