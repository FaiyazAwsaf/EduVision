"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  getAccessToken,
  getRefreshToken,
  getUserData,
  refreshAccessToken,
  type LoginPayload,
  type User,
} from "@/lib/api/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Whether the initial auth check has finished */
  isReady: boolean;
  /** True when a valid access token exists */
  isAuthenticated: boolean;
  /** Current user data (null if not authenticated) */
  user: User | null;
  /** Sign in with email + password. Throws on failure. Returns user data. */
  login: (payload: LoginPayload) => Promise<User>;
  /** Clear tokens and reset state */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // On mount: check if we have a stored token, try to refresh it
  useEffect(() => {
    async function bootstrap() {
      const access = getAccessToken();
      const refresh = getRefreshToken();
      const userData = getUserData();

      if (access && userData) {
        // We have an access token and user data — assume valid
        setIsAuthenticated(true);
        setUser(userData);
      } else if (refresh) {
        // Try to get a new access token with the refresh token
        const newAccess = await refreshAccessToken();
        if (newAccess && userData) {
          setIsAuthenticated(true);
          setUser(userData);
        }
      }

      setIsReady(true);
    }
    bootstrap();
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<User> => {
    const response = await apiLogin(payload);
    const userData = response.payload.user;
    setIsAuthenticated(true);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthenticated, user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
