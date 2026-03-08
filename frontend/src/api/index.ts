/**
 * API Layer Barrel Export
 *
 * Re-exports all API modules for convenient imports.
 * Rubric helpers (getRubricSets, getRubricSet) are re-exported via
 * the evaluation module. For full rubric CRUD, import from `@/api/rubrics`.
 */

export { apiFetch, parseApiError, API_BASE_URL } from "./client";
export * from "./auth";
export * from "./evaluation";
export * from "./contentRequests";
export * from "./tutoring";
export * from "./geminiService";
