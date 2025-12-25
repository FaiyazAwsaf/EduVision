/**
 * API Configuration
 *
 * Centralized configuration for backend API endpoints.
 * Update BASE_URL based on environment.
 */

// Backend API base URL
// In production, use environment variable
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// API endpoints
export const API_ENDPOINTS = {
  CONTENT_REQUESTS: `${API_BASE_URL}/api/content-requests/`,
  CONTENT_REQUEST_DETAIL: (id: string) =>
    `${API_BASE_URL}/api/content-requests/${id}/`,
  GENERATED_CONTENT: (id: string) =>
    `${API_BASE_URL}/api/content-requests/${id}/content/`,
} as const;

// Polling configuration
export const POLLING_CONFIG = {
  INTERVAL_MS: 3000, // Poll every 3 seconds
  MAX_ATTEMPTS: 100, // Stop after 100 attempts (5 minutes)
} as const;
