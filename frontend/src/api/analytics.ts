/**
 * Analytics API Client
 *
 * Connects to the backend /api/analytics/ module.
 * All requests are JWT-authenticated via authenticatedFetch.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import { authenticatedFetch } from "@/api/auth";

const ANALYTICS_URL = `${API_BASE_URL}/analytics`;

async function analyticsFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${ANALYTICS_URL}${endpoint}`;
  const response = await authenticatedFetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const message = await parseApiError(response, `Analytics API Error: ${response.status}`);
    throw new Error(message);
  }

  const bodyText = await response.text();
  if (!bodyText.trim()) return undefined as T;
  return JSON.parse(bodyText) as T;
}

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface StudentOverview {
  total_assessments: number;
  avg_percentage: number;
  best_percentage: number;
  subjects_count: number;
}

export interface ProgressDataPoint {
  assessment: string;
  subject: string;
  score: number;
  max_score: number;
  percentage: number;
  date: string | null;
}

export interface SubjectPerformance {
  subject: string;
  avg_percentage: number;
  exam_count: number;
}

export interface TopicPerformance {
  topic: string;
  question_text: string;
  avg_percentage: number;
  attempts: number;
}

export interface MyAnalytics {
  overview: StudentOverview;
  progress: ProgressDataPoint[];
  subjects: SubjectPerformance[];
  topics: TopicPerformance[];
  subject_weak_topics: Record<string, string[]>;
}

export interface ClassDistribution {
  distribution: { bucket: string; count: number }[];
  total_students: number;
  avg_percentage: number;
}

export interface QuestionPerformanceEntry {
  question_number: number;
  question_text: string;
  avg_marks: number;
  max_marks: number;
  avg_percentage: number;
  response_count: number;
}

export interface Misconception {
  id: string;
  misconception_type: string;
  misconception_type_display: string;
  description: string;
  frequency: number;
  percentage_affected: number;
  example_answers: string[];
}

// ─── Student Endpoints ────────────────────────────────────────────────────────

/** Full analytics bundle for the logged-in student. */
export async function getMyAnalytics(): Promise<MyAnalytics> {
  return analyticsFetch<MyAnalytics>("/me/");
}

/** Time-series progress for any student (self or teacher's student). */
export async function getStudentProgress(studentId: string): Promise<ProgressDataPoint[]> {
  const data = await analyticsFetch<{ progress: ProgressDataPoint[] }>(
    `/student/${studentId}/progress/`
  );
  return data.progress;
}

/** Per-subject averages for a student. */
export async function getStudentSubjects(studentId: string): Promise<SubjectPerformance[]> {
  const data = await analyticsFetch<{ subjects: SubjectPerformance[] }>(
    `/student/${studentId}/subjects/`
  );
  return data.subjects;
}

/** Per-topic (question-level) performance for a student. */
export async function getStudentTopics(studentId: string): Promise<TopicPerformance[]> {
  const data = await analyticsFetch<{ topics: TopicPerformance[] }>(
    `/student/${studentId}/topics/`
  );
  return data.topics;
}

/** Overview KPIs for a student. */
export async function getStudentOverview(studentId: string): Promise<StudentOverview> {
  return analyticsFetch<StudentOverview>(`/student/${studentId}/overview/`);
}

// ─── Class / Teacher Endpoints ────────────────────────────────────────────────

/** Score distribution histogram for a submission form. */
export async function getClassDistribution(assessmentId: string): Promise<ClassDistribution> {
  return analyticsFetch<ClassDistribution>(`/class/${assessmentId}/distribution/`);
}

/** Per-question average performance for a submission form. */
export async function getClassQuestionPerformance(
  assessmentId: string
): Promise<QuestionPerformanceEntry[]> {
  const data = await analyticsFetch<{ question_performance: QuestionPerformanceEntry[] }>(
    `/class/${assessmentId}/question-performance/`
  );
  return data.question_performance;
}

// ─── Misconception Detection ──────────────────────────────────────────────────

/** Get cached misconceptions for a question rubric. */
export async function getMisconceptions(questionRubricId: string): Promise<Misconception[]> {
  const data = await analyticsFetch<{ misconceptions: Misconception[] }>(
    `/misconceptions/${questionRubricId}/`
  );
  return data.misconceptions;
}

/** Recompute misconceptions for a question rubric (slower, triggers re-analysis). */
export async function recomputeMisconceptions(questionRubricId: string): Promise<Misconception[]> {
  const data = await analyticsFetch<{ misconceptions: Misconception[] }>(
    `/misconceptions/${questionRubricId}/recompute/`,
    { method: "POST" }
  );
  return data.misconceptions;
}

/** Rebuild performance snapshots for all evaluated scripts (teacher utility). */
export async function rebuildSnapshots(): Promise<{ rebuilt: number }> {
  return analyticsFetch<{ rebuilt: number }>("/rebuild-snapshots/", { method: "POST" });
}
