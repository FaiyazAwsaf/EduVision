/**
 * API Configuration
 *
 * Centralized configuration for backend API endpoints.
 * Update BASE_URL based on environment.
 */

// Backend API base URL
// In production, use NEXT_PUBLIC_API_URL.
// In local dev, default to the same hostname as the frontend to keep cookie site consistent.
const DEFAULT_API_ORIGIN =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN;
const NORMALIZED_API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");

export const API_BASE_URL = NORMALIZED_API_BASE_URL.endsWith("/api")
  ? NORMALIZED_API_BASE_URL
  : `${NORMALIZED_API_BASE_URL}/api`;

// API endpoints
export const API_ENDPOINTS = {
  CONTENT_REQUESTS: `${API_BASE_URL}/content-requests/`,
  CONTENT_REQUEST_DETAIL: (id: string) =>
    `${API_BASE_URL}/content-requests/${id}/`,
  GENERATED_CONTENT: (id: string) =>
    `${API_BASE_URL}/content-requests/${id}/content/`,
  REGENERATE_CONTENT: (id: string) =>
    `${API_BASE_URL}/content-requests/${id}/regenerate/`,
  // Phase 5: Study Plan endpoints
  STUDY_PLANS: `${API_BASE_URL}/study-plans/`,
  STUDY_PLAN_ITEMS: `${API_BASE_URL}/study-plan-items/`,

  // Curriculum
  CURRICULUM_OUTLINES: `${API_BASE_URL}/curriculum/outlines/`,
  CURRICULUM_OUTLINES_LIST: `${API_BASE_URL}/curriculum/outlines/list/`,
  CURRICULUM_OUTLINE_DETAIL: (id: string) =>
    `${API_BASE_URL}/curriculum/outlines/${id}/`,
  CURRICULUM_OUTLINE_REPARSE: (id: string) =>
    `${API_BASE_URL}/curriculum/outlines/${id}/reparse/`,
  CURRICULUM_DIFFICULTY_REPORT: (id: string) =>
    `${API_BASE_URL}/curriculum/outlines/${id}/difficulty-report/`,
  CURRICULUM_TOPIC_MATERIALS_UPLOAD: (topicId: string) =>
    `${API_BASE_URL}/curriculum/topics/${topicId}/materials/`,
  CURRICULUM_MATERIAL_DELETE: (materialId: string) =>
    `${API_BASE_URL}/curriculum/materials/${materialId}/`,
  CURRICULUM_NOTIFICATIONS: `${API_BASE_URL}/curriculum/notifications/`,
  CURRICULUM_NOTIFICATIONS_MARK_READ: `${API_BASE_URL}/curriculum/notifications/mark-read/`,
  CURRICULUM_MY_COURSES: `${API_BASE_URL}/curriculum/my-courses/`,
  CURRICULUM_COURSE_TOPICS: (outlineId: string) =>
    `${API_BASE_URL}/curriculum/my-courses/${outlineId}/topics/`,
  CURRICULUM_COURSE_SUMMARY: (outlineId: string) =>
    `${API_BASE_URL}/curriculum/my-courses/${outlineId}/summary/`,
  CURRICULUM_TOPIC_PROGRESS: (topicId: string) =>
    `${API_BASE_URL}/curriculum/topics/${topicId}/progress/`,
  CURRICULUM_TOPIC_FLAG: (topicId: string) =>
    `${API_BASE_URL}/curriculum/topics/${topicId}/flag-difficulty/`,
  CURRICULUM_TOPIC_MATERIALS_LIST: (topicId: string) =>
    `${API_BASE_URL}/curriculum/topics/${topicId}/materials/list/`,
  CURRICULUM_TOPIC_SEARCH: `${API_BASE_URL}/curriculum/topics/search/`,
} as const;

// Polling configuration
export const POLLING_CONFIG = {
  INTERVAL_MS: 3000, // Poll every 3 seconds
  MAX_ATTEMPTS: 100, // Stop after 100 attempts (5 minutes)
} as const;
