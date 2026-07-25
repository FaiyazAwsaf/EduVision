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

test("getAccessToken returns null when nothing is stored", () => {
  expect(getAccessToken()).toBeNull();
});

test("setTokens stores the access token and user data", () => {
  setTokens("token-abc", sampleUser);

  expect(getAccessToken()).toBe("token-abc");
  expect(getUserData()).toEqual(sampleUser);
});

test("clearTokens removes the stored access token and user data", () => {
  setTokens("token-abc", sampleUser);

  clearTokens();

  expect(getAccessToken()).toBeNull();
  expect(getUserData()).toBeNull();
});

test("getUserData returns null when the stored value is corrupted JSON", () => {
  sessionStorage.setItem("eduvision_user", "{not-valid-json");

  expect(getUserData()).toBeNull();
});

test("authHeaders includes a Bearer token when one is stored", () => {
  setTokens("token-abc", sampleUser);

  expect(authHeaders()).toEqual({ Authorization: "Bearer token-abc" });
});

test("authHeaders returns an empty object when no token is stored", () => {
  expect(authHeaders()).toEqual({});
});
