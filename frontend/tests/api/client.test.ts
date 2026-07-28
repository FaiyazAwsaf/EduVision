import { parseApiError } from "@/api/client";

function makeResponse(body: unknown, status = 400): Response {
  return {
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// Checks that parseApiError prefers the "error" field from the response body when present.
test("parseApiError reads the error field first", async () => {
  const message = await parseApiError(makeResponse({ error: "Bad request" }));
  expect(message).toBe("Bad request");
});

// Checks that parseApiError falls back to the "detail" field when there's no "error" field.
test("parseApiError falls back to the detail field", async () => {
  const message = await parseApiError(makeResponse({ detail: "Not found" }));
  expect(message).toBe("Not found");
});

// Checks that parseApiError falls back to the first entry in "non_field_errors" when no "error" or "detail" field exists.
test("parseApiError falls back to the first non_field_errors entry", async () => {
  const message = await parseApiError(
    makeResponse({ non_field_errors: ["Invalid credentials"] }),
  );
  expect(message).toBe("Invalid credentials");
});

// Checks that parseApiError uses the caller-supplied fallback message when the response body has none of the known error fields.
test("parseApiError uses the fallback message when the body has no known fields", async () => {
  const message = await parseApiError(makeResponse({}), "Something broke");
  expect(message).toBe("Something broke");
});

// Checks that parseApiError doesn't crash on a non-JSON response body, and instead reports the fallback message with the status code.
test("parseApiError uses the fallback message when the body is not valid JSON", async () => {
  const response = {
    status: 500,
    json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
  } as unknown as Response;

  const message = await parseApiError(response, "Server error");
  expect(message).toBe("Server error (Status: 500)");
});
