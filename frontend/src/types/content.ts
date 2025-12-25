/**
 * TypeScript types for Content Request System
 *
 * These types match the backend API contract exactly.
 * Keep in sync with backend enums and response structures.
 */

// Backend enum values
export enum ContentType {
  SUMMARY = "SUMMARY",
  WORKED_EXAMPLES = "WORKED_EXAMPLES",
  FORMULA_SHEET = "FORMULA_SHEET",
}

export enum Style {
  BRIEF = "BRIEF",
  DETAILED = "DETAILED",
  STEP_BY_STEP = "STEP_BY_STEP",
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export enum OutputFormat {
  TEXT = "TEXT",
  PDF = "PDF",
  WORKSHEET = "WORKSHEET",
}

export enum RequestStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// Request creation payload
export interface CreateContentRequestPayload {
  topic: string;
  content_type: ContentType;
  style: Style;
  output_format: OutputFormat;
  difficulty?: Difficulty;
  notes?: string;
}

// Content request response from API
export interface ContentRequest {
  id: string;
  topic: string;
  content_type: ContentType;
  style: Style;
  output_format: OutputFormat;
  difficulty?: Difficulty;
  notes?: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

// Generated content metadata
export interface GeneratedContentMetadata {
  provider: string;
  model: string;
  temperature: number;
  content_type: string;
  style: string;
  difficulty?: string;
  prompt_length: number;
  response_length: number;
  topic: string;
}

// Generated content response
export interface GeneratedContent {
  id: string;
  request_id: string;
  topic: string;
  content_type: ContentType;
  style: Style;
  content_text: string;
  output_format: OutputFormat;
  metadata: GeneratedContentMetadata;
  created_at: string;
  updated_at: string;
}

// API error response
export interface ApiError {
  error?: string;
  detail?: string;
  status?: RequestStatus;
}

// Client-side lifecycle state
export type RequestLifecycleState =
  | "idle"
  | "submitting"
  | "polling"
  | "completed"
  | "failed";

// ============================================================================
// Phase 3: Feedback Types
// ============================================================================

export enum DifficultyRating {
  TOO_EASY = "TOO_EASY",
  APPROPRIATE = "APPROPRIATE",
  TOO_HARD = "TOO_HARD",
}

export interface FeedbackPayload {
  usefulness_rating: number; // 1-5
  difficulty_rating: DifficultyRating;
  correctness_flag: boolean;
  missing_topics?: string;
  freeform_comment?: string;
}

export interface Feedback {
  id: string;
  generated_content_id: string;
  usefulness_rating: number;
  difficulty_rating: DifficultyRating;
  correctness_flag: boolean;
  missing_topics?: string;
  freeform_comment?: string;
  submitted_at: string;
}
