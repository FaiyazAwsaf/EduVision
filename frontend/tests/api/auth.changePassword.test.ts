/**
 * Bug AUTH-001: the frontend always posts to /api/auth/change-password/, but
 * the backend does not expose that route (see backend/apps/authentication/urls.py
 * and backend/apps/authentication/views.py — ChangePasswordSerializer exists but
 * is never wired to a view). So this call always fails today.
 *
 * frontend/src/api/auth.ts:147-166 (changePassword)
 */
import { changePassword } from "@/api/auth";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

// Checks that changePassword resolves with the success message when the backend accepts the request.
test("changePassword resolves successfully when the backend accepts the request", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ message: "Password updated" }),
  }) as unknown as typeof fetch;

  const result = await changePassword({
    current_password: "OldPass123",
    new_password: "NewPass123",
    new_password_confirm: "NewPass123",
  });

  expect(result.message).toBe("Password updated");
});

// Checks that changePassword throws a usable error (rather than silently succeeding) when the endpoint returns 404.
test("changePassword surfaces a clear error instead of a raw 404 when the route is missing", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ detail: "Not found." }),
  }) as unknown as typeof fetch;

  await expect(
    changePassword({
      current_password: "OldPass123",
      new_password: "NewPass123",
      new_password_confirm: "NewPass123",
    }),
  ).rejects.toThrow();
});
