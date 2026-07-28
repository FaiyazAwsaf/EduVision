import {
  formatEnumValue,
  truncateText,
  formatNumber,
  shortId,
  isValidUUID,
  formatFileSize,
  getStatusColor,
} from "@/utils/formatters";

// Checks that formatEnumValue turns a SNAKE_CASE enum value into readable Title Case words.
test("formatEnumValue turns SNAKE_CASE into Title Case words", () => {
  expect(formatEnumValue("WORKED_EXAMPLES")).toBe("Worked Examples");
});

// Checks that formatEnumValue works correctly for a single-word enum value.
test("formatEnumValue handles a single word", () => {
  expect(formatEnumValue("SUMMARY")).toBe("Summary");
});

// Checks that truncateText leaves text unchanged when it's already shorter than the limit.
test("truncateText leaves short text unchanged", () => {
  expect(truncateText("Hello", 10)).toBe("Hello");
});

// Checks that truncateText cuts text longer than the limit and appends "...".
test("truncateText cuts long text and adds an ellipsis", () => {
  expect(truncateText("Hello World", 5)).toBe("Hello...");
});

// Checks that formatNumber inserts comma thousand-separators into a large number.
test("formatNumber adds thousand separators", () => {
  expect(formatNumber(1234567)).toBe("1,234,567");
});

// Checks that shortId shortens a full UUID down to its first 8 characters.
test("shortId returns the first 8 characters of a UUID", () => {
  expect(shortId("12345678-1234-1234-1234-123456789012")).toBe("12345678");
});

// Checks that isValidUUID accepts a correctly formatted UUID string.
test("isValidUUID accepts a well-formed UUID", () => {
  expect(isValidUUID("12345678-1234-1234-1234-123456789012")).toBe(true);
});

// Checks that isValidUUID rejects a string that isn't a valid UUID.
test("isValidUUID rejects a malformed UUID", () => {
  expect(isValidUUID("not-a-uuid")).toBe(false);
});

// Checks that formatFileSize displays "0 Bytes" for a zero-byte file.
test("formatFileSize reports 0 Bytes for empty files", () => {
  expect(formatFileSize(0)).toBe("0 Bytes");
});

// Checks that formatFileSize converts a byte count into a human-readable KB value.
test("formatFileSize converts bytes into KB", () => {
  expect(formatFileSize(2048)).toBe("2 KB");
});

// Checks that getStatusColor returns the blue color classes for a "PROCESSING" status.
test("getStatusColor returns blue classes for PROCESSING", () => {
  const colors = getStatusColor("PROCESSING");
  expect(colors.text).toBe("text-blue-800");
});

// Checks that getStatusColor falls back to gray classes for a status it doesn't recognize.
test("getStatusColor returns gray classes for an unknown status", () => {
  const colors = getStatusColor("SOMETHING_WEIRD");
  expect(colors.text).toBe("text-gray-800");
});
