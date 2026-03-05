/**
 * Rubric Types
 *
 * Shared type definitions for the rubric system.
 * Used by both the rubrics API and evaluation API modules.
 */

// ─── Core Rubric Types ──────────────────────────────────────────────────────

export interface QuestionRubric {
  id?: string;
  question_number: number | string;
  question_text: string;
  reference_answer?: string;
  max_marks: number;
  evaluation_rules: EvaluationRule[];
  created_at?: string;
  updated_at?: string;
}

export interface RubricSet {
  id: string;
  version: number;
  state: "draft" | "published" | "archived";
  title: string;
  subject: string;
  total_marks: number;
  metadata?: Record<string, unknown>;
  questions: QuestionRubric[];
  created_by?: string;
  created_at: string;
  updated_at: string;
  versions?: RubricVersion[];
}

export interface RubricSetListItem {
  id: string;
  title: string;
  subject: string;
  state: string;
  version: number;
  total_marks: number;
  question_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Evaluation Rules ────────────────────────────────────────────────────────

export interface EvaluationRule {
  id: string;
  type: RuleType;
  marks: number;
  config: KeywordConfig | NumericConfig | StepwiseConfig;
  feedback: RuleFeedback;
}

export type RuleType = "keyword" | "numeric" | "stepwise";

export interface KeywordConfig {
  required_keywords: string[];
  scoring_mode: "proportional" | "all_or_nothing";
}

export interface NumericConfig {
  expected_value: number;
  tolerance: number;
}

export interface StepwiseConfig {
  step_description: string;
  expected_patterns: string[];
  allow_partial_credit: boolean;
}

export interface RuleFeedback {
  on_success: string;
  on_partial?: string;
  on_failure: string;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface CreateRubricSetPayload {
  title: string;
  subject: string;
  total_marks: number;
  metadata?: Record<string, unknown>;
  questions: Omit<QuestionRubric, "id" | "created_at" | "updated_at">[];
}

// ─── Test Results ────────────────────────────────────────────────────────────

export interface QuestionResult {
  question_number: number;
  question_text: string;
  score: number;
  max_marks: number;
  percentage: number;
  rule_results: RuleResult[];
  feedback: string;
}

export interface RuleResult {
  rule_id: string;
  rule_type: string;
  score_awarded: number;
  max_marks: number;
  matched: boolean;
  feedback_message: string;
}

export interface TestRubricSetResult {
  total_score: number;
  max_score: number;
  percentage: number;
  question_results: QuestionResult[];
  feedback: string;
}

export interface TestRubricResult {
  total_score: number;
  max_score: number;
  rule_results: RuleResult[];
  feedback: string;
}

// ─── Legacy Types ────────────────────────────────────────────────────────────
// For backward compatibility with single-question rubric components

export interface Rubric {
  id: string;
  version: number;
  state: "draft" | "published" | "archived";
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: EvaluationRule[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RubricListItem {
  id: string;
  title: string;
  subject: string;
  state: string;
  version: number;
  total_marks: number;
  created_at: string;
  updated_at: string;
}

// ─── Versioning ──────────────────────────────────────────────────────────────

export interface RubricVersion {
  id: string;
  version: number;
  state: string;
  created_at: string;
}
