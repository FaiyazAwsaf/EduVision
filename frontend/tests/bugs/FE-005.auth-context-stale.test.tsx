/**
 * Bug FE-005: AuthProvider restores isAuthenticated=true from cached
 * sessionStorage data immediately, then fires a background token refresh
 * without awaiting it or reacting to failure. If the refresh fails (expired
 * refresh cookie), the UI is left showing an authenticated session forever,
 * even though every subsequent API call will 401.
 *
 * frontend/src/contexts/AuthContext.tsx:44-70 (bootstrap effect)
 */
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

jest.mock("@/api/auth", () => ({
  getAccessToken: jest.fn(() => "cached-access-token"),
  getUserData: jest.fn(() => ({
    id: "u1",
    username: "student1",
    email: "student1@example.com",
    first_name: "Student",
    last_name: "One",
    is_active: true,
    role: "student",
    date_joined: "2026-01-01T00:00:00Z",
  })),
  refreshAccessToken: jest.fn(() => Promise.resolve(null)), // simulates an expired refresh cookie
  login: jest.fn(),
  logout: jest.fn(),
}));

function Probe() {
  const { isReady, isAuthenticated } = useAuth();
  if (!isReady) return <div>loading</div>;
  return <div>{isAuthenticated ? "authenticated" : "logged-out"}</div>;
}

test("auth state clears after a background refresh failure instead of staying authenticated", async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(screen.getByText(/authenticated|logged-out/)).toBeInTheDocument());

  // Give the fire-and-forget refreshAccessToken() promise a chance to resolve.
  await new Promise((resolve) => setTimeout(resolve, 0));

  await waitFor(() => {
    expect(screen.getByText("logged-out")).toBeInTheDocument();
  });
});
