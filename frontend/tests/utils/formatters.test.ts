import {
  formatEnumValue,
  truncateText,
  formatNumber,
  shortId,
  isValidUUID,
  formatFileSize,
  getStatusColor,
} from "@/utils/formatters";

test("formatEnumValue turns SNAKE_CASE into Title Case words", () => {
  expect(formatEnumValue("WORKED_EXAMPLES")).toBe("Worked Examples");
});

test("formatEnumValue handles a single word", () => {
  expect(formatEnumValue("SUMMARY")).toBe("Summary");
});

test("truncateText leaves short text unchanged", () => {
  expect(truncateText("Hello", 10)).toBe("Hello");
});

test("truncateText cuts long text and adds an ellipsis", () => {
  expect(truncateText("Hello World", 5)).toBe("Hello...");
});

test("formatNumber adds thousand separators", () => {
  expect(formatNumber(1234567)).toBe("1,234,567");
});

test("shortId returns the first 8 characters of a UUID", () => {
  expect(shortId("12345678-1234-1234-1234-123456789012")).toBe("12345678");
});

test("isValidUUID accepts a well-formed UUID", () => {
  expect(isValidUUID("12345678-1234-1234-1234-123456789012")).toBe(true);
});

test("isValidUUID rejects a malformed UUID", () => {
  expect(isValidUUID("not-a-uuid")).toBe(false);
});

test("formatFileSize reports 0 Bytes for empty files", () => {
  expect(formatFileSize(0)).toBe("0 Bytes");
});

test("formatFileSize converts bytes into KB", () => {
  expect(formatFileSize(2048)).toBe("2 KB");
});

test("getStatusColor returns blue classes for PROCESSING", () => {
  const colors = getStatusColor("PROCESSING");
  expect(colors.text).toBe("text-blue-800");
});

test("getStatusColor returns gray classes for an unknown status", () => {
  const colors = getStatusColor("SOMETHING_WEIRD");
  expect(colors.text).toBe("text-gray-800");
});
