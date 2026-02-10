/**
 * API Layer Barrel Export
 *
 * Re-exports all API modules for convenient imports.
 * For rubric-related functions, import directly from
 * `@/api/rubrics` or `@/api/evaluation` to avoid ambiguity.
 */

export { apiFetch, parseApiError, API_BASE_URL } from "./client";
export * from "./auth";
export * from "./evaluation";
export * from "./contentRequests";
export * from "./tutoring";
export * from "./geminiService";

// Rubrics module has overlapping exports with evaluation.
// Import rubric-specific functions directly from `@/api/rubrics`.
