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
  refreshAccessToken,
  type LoginPayload,
} from "@/lib/api/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Whether the initial auth check has finished */
  isReady: boolean;
  /** True when a valid access token exists */
  isAuthenticated: boolean;
  /** Sign in with email + password. Throws on failure. */
  login: (payload: LoginPayload) => Promise<void>;
  /** Clear tokens and reset state */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On mount: check if we have a stored token, try to refresh it
  useEffect(() => {
    async function bootstrap() {
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (access) {
        // We have an access token — assume valid (JWT is verified server-side)
        setIsAuthenticated(true);
      } else if (refresh) {
        // Try to get a new access token with the refresh token
        const newAccess = await refreshAccessToken();
        setIsAuthenticated(!!newAccess);
      }

      setIsReady(true);
    }
    bootstrap();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    await apiLogin(payload);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isAuthenticated, login, logout }}>
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
