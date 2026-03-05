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
  LESSON_PLAN = "LESSON_PLAN",
  QUIZ_GENERATOR = "QUIZ_GENERATOR",
  WORKSHEET_BUILDER = "WORKSHEET_BUILDER",
  TOPIC_EXPLANATION = "TOPIC_EXPLANATION",
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
  subject?: string;
  target_class_id?: string;
  target_section_id?: string;
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
  role?: string;
  subject?: string;
  created_by_id?: string;
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

// ============================================================================
// Phase 4: Learning Context Types
// ============================================================================

export enum TargetGoal {
  REVISION = "REVISION",
  CONCEPT_CLARITY = "CONCEPT_CLARITY",
  EXAM_PREP = "EXAM_PREP",
  PRACTICE = "PRACTICE",
}

export enum PreferredDepth {
  SHALLOW = "SHALLOW",
  NORMAL = "NORMAL",
  DEEP = "DEEP",
}

export enum TimeConstraint {
  QUICK = "QUICK",
  NORMAL = "NORMAL",
  EXTENSIVE = "EXTENSIVE",
}

export interface LearningContextPayload {
  target_goal?: TargetGoal;
  self_reported_weaknesses?: string[];
  preferred_depth?: PreferredDepth;
  time_constraint?: TimeConstraint;
  notes?: string;
}

export interface LearningContext {
  id: string;
  content_request: string; // request_id
  target_goal?: TargetGoal;
  self_reported_weaknesses?: string[];
  preferred_depth?: PreferredDepth;
  time_constraint?: TimeConstraint;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Phase 5: Study Plan Types (Manual Mode Only)
// ============================================================================
// These types support manual study plan creation with hooks for future
// Module 3 (Smart Analytics Dashboard) integration.
//
// IMPORTANT: Phase 5 is MANUAL MODE ONLY
// - No analytics logic
// - Fields marked with [MODULE 3 HOOK] are placeholders for future integration

export enum StudyPlanMode {
  MANUAL = "manual", // User creates and manages all topics manually (Phase 5)
  AI = "ai", // [MODULE 3 HOOK] Module 3 automatically detects weaknesses (Future)
}

export enum StudyPlanItemSource {
  MANUAL = "manual", // User manually added this topic
  ANALYTICS = "analytics", // [MODULE 3 HOOK] Auto-detected by Module 3 (Future)
  MIXED = "mixed", // [MODULE 3 HOOK] Module 3 suggested, user modified (Future)
}

export enum StudyPlanItemStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

/**
 * Study Plan - Container for multiple study topics
 *
 * Phase 5: Manual mode only
 * Future: Module 3 will enable AI mode with automatic topic detection
 */
export interface StudyPlan {
  id: string;
  user_id?: string; // nullable until auth integration
  name: string;
  mode: StudyPlanMode;
  auto_detect_weakness: boolean; // [MODULE 3 HOOK] default false in Phase 5
  analytics_snapshot_id?: string; // [MODULE 3 HOOK] for future analytics linking
  items: StudyPlanItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Study Plan Item - Individual topic within a study plan
 *
 * Phase 5: All items have source='manual' (user-created)
 * Future: Module 3 will add items with source='analytics'
 */
export interface StudyPlanItem {
  id: string;
  topic: string;
  priority: number; // 1 (highest) to 5 (lowest)
  scheduled_date?: string; // ISO date string
  status: StudyPlanItemStatus;
  linked_request_id?: string; // optional link to content request
  source: StudyPlanItemSource;
  confidence_score?: number; // [MODULE 3 HOOK] 0.0-1.0, set by analytics (future)
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new study plan
 * Phase 5: mode and auto_detect_weakness are set automatically to manual/false
 */
export interface CreateStudyPlanPayload {
  name: string;
  user_id?: string; // nullable until auth integration
}

/**
 * Payload for adding an item to a study plan
 * Phase 5: source is automatically set to 'manual'
 */
export interface CreateStudyPlanItemPayload {
  topic: string;
  priority?: number; // default: 3
  scheduled_date?: string; // ISO date string
  status?: StudyPlanItemStatus; // default: pending
  linked_request_id?: string; // optional link to content request
}

/**
 * Payload for updating a study plan item
 */
export interface UpdateStudyPlanItemPayload {
  topic?: string;
  priority?: number;
  scheduled_date?: string;
  status?: StudyPlanItemStatus;
  linked_request_id?: string;
}
