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
  getUserData,
  refreshAccessToken,
  type LoginPayload,
  type User,
} from "@/api/auth";

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

  // On mount: restore session from sessionStorage, then try to refresh the cookie-based token
  useEffect(() => {
    async function bootstrap() {
      const access = getAccessToken();
      const userData = getUserData();

      if (access && userData) {
        // Restore user immediately, then proactively refresh in background
        setIsAuthenticated(true);
        setUser(userData);
        refreshAccessToken().catch(() => {});
      } else {
        // No access token cached — try to get one via the httpOnly refresh cookie
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          const restoredUser = getUserData();
          if (restoredUser) {
            setIsAuthenticated(true);
            setUser(restoredUser);
          }
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
