import {
  getAccessToken,
  getUserData,
  setTokens,
  clearTokens,
  authHeaders,
  type User,
} from "@/api/auth";

const sampleUser: User = {
  id: "u1",
  username: "student1",
  email: "student1@example.com",
  first_name: "Student",
  last_name: "One",
  is_active: true,
  role: "student",
  date_joined: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  sessionStorage.clear();
});

// Checks that getAccessToken returns null when no token has been stored yet.
test("getAccessToken returns null when nothing is stored", () => {
  expect(getAccessToken()).toBeNull();
});

// Checks that setTokens saves both the access token and the user data so they can be read back.
test("setTokens stores the access token and user data", () => {
  setTokens("token-abc", sampleUser);

  expect(getAccessToken()).toBe("token-abc");
  expect(getUserData()).toEqual(sampleUser);
});

// Checks that clearTokens wipes out both the stored access token and user data.
test("clearTokens removes the stored access token and user data", () => {
  setTokens("token-abc", sampleUser);

  clearTokens();

  expect(getAccessToken()).toBeNull();
  expect(getUserData()).toBeNull();
});

// Checks that getUserData returns null (instead of throwing) when the stored value is broken/corrupted JSON.
test("getUserData returns null when the stored value is corrupted JSON", () => {
  sessionStorage.setItem("eduvision_user", "{not-valid-json");

  expect(getUserData()).toBeNull();
});

// Checks that authHeaders builds an Authorization header with the stored token when one exists.
test("authHeaders includes a Bearer token when one is stored", () => {
  setTokens("token-abc", sampleUser);

  expect(authHeaders()).toEqual({ Authorization: "Bearer token-abc" });
});

// Checks that authHeaders returns no Authorization header when there's no stored token.
test("authHeaders returns an empty object when no token is stored", () => {
  expect(authHeaders()).toEqual({});
});
