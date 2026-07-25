/**
 * Bug FE-002: whiteboardService.ts uses the plain global fetch() with a cached
 * access token instead of the authenticatedFetch() wrapper that auto-refreshes
 * on 401. After the 15-minute access token expires, every whiteboard REST call
 * should still succeed by refreshing the token once and retrying — but today it
 * just returns/throws on the first 401 it sees.
 *
 * frontend/src/api/whiteboardService.ts (saveState, getSession, etc. all use fetch())
 * frontend/src/api/auth.ts:203-235 (authenticatedFetch - the wrapper that IS NOT used)
 */
import { getSession } from "@/api/whiteboardService";

jest.mock("@/api/auth", () => ({
  getAccessToken: jest.fn(() => "stale-access-token"),
}));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("getSession retries with a fresh token after a 401 instead of failing immediately", async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  await expect(getSession("session-1")).rejects.toThrow();

  // Expected (post-fix) behavior: it should have attempted at least a second
  // request (a retry after refreshing the token) instead of only calling fetch once.
  expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
});
