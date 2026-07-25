import { parseApiError } from "@/api/client";

function makeResponse(body: unknown, status = 400): Response {
  return {
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

test("parseApiError reads the error field first", async () => {
  const message = await parseApiError(makeResponse({ error: "Bad request" }));
  expect(message).toBe("Bad request");
});

test("parseApiError falls back to the detail field", async () => {
  const message = await parseApiError(makeResponse({ detail: "Not found" }));
  expect(message).toBe("Not found");
});

test("parseApiError falls back to the first non_field_errors entry", async () => {
  const message = await parseApiError(
    makeResponse({ non_field_errors: ["Invalid credentials"] }),
  );
  expect(message).toBe("Invalid credentials");
});

test("parseApiError uses the fallback message when the body has no known fields", async () => {
  const message = await parseApiError(makeResponse({}), "Something broke");
  expect(message).toBe("Something broke");
});

test("parseApiError uses the fallback message when the body is not valid JSON", async () => {
  const response = {
    status: 500,
    json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
  } as unknown as Response;

  const message = await parseApiError(response, "Server error");
  expect(message).toBe("Server error (Status: 500)");
});
