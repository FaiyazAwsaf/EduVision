/**
 * Bug FE-007: adminFetch always calls response.json(), but DELETE endpoints for
 * classes/sections/subjects/assignments return "204 No Content" with an empty body.
 * Calling response.json() on an empty body throws "Unexpected end of JSON input",
 * so the UI reports an error even though the delete actually succeeded.
 *
 * frontend/src/api/admin.ts:81-103 (adminFetch)
 * backend/apps/students/views.py:45 (generic RetrieveUpdateDestroyAPIView -> 204)
 */
import { deleteClass, deleteSection, deleteSubject } from "@/api/admin";

jest.mock("@/api/auth", () => ({
  authenticatedFetch: jest.fn(),
}));

import { authenticatedFetch } from "@/api/auth";

function mockNoContentResponse() {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
  } as unknown as Response;
}

beforeEach(() => {
  (authenticatedFetch as jest.Mock).mockReset();
});

test("deleteClass does not throw when the backend returns 204 No Content", async () => {
  (authenticatedFetch as jest.Mock).mockResolvedValue(mockNoContentResponse());

  await expect(deleteClass(1)).resolves.not.toThrow();
});

test("deleteSection does not throw when the backend returns 204 No Content", async () => {
  (authenticatedFetch as jest.Mock).mockResolvedValue(mockNoContentResponse());

  await expect(deleteSection(1)).resolves.not.toThrow();
});

test("deleteSubject does not throw when the backend returns 204 No Content", async () => {
  (authenticatedFetch as jest.Mock).mockResolvedValue(mockNoContentResponse());

  await expect(deleteSubject("subject-1")).resolves.not.toThrow();
});
