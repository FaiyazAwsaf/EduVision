/**
 * Intelligence API Client
 *
 * Connects to the backend /api/intelligence/ module (Phase 6/7).
 * Provides learner insights and adaptive recommendations.
 * All requests are JWT-authenticated via authenticatedFetch.
 */

import { API_BASE_URL, parseApiError } from "@/api/client";
import { authenticatedFetch } from "@/api/auth";

const INTELLIGENCE_URL = `${API_BASE_URL}/intelligence`;

/** Thrown when the server returns 404. Callers can `instanceof`-check this. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

async function intelligenceFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${INTELLIGENCE_URL}${endpoint}`;
  const response = await authenticatedFetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!response.ok) {
    const message = await parseApiError(
      response,
      `Intelligence API Error: ${response.status}`,
    );
    if (response.status === 404) throw new NotFoundError(message);
    throw new Error(message);
  }

  const bodyText = await response.text();
  if (!bodyText.trim()) return undefined as T;
  return JSON.parse(bodyText) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearnerInsight {
  id: string;
  user_id: string;
  computed_at: string;
  learning_pace: "very_slow" | "slow" | "moderate" | "fast" | "very_fast";
  pace_score: number;
  consistency_score: number;
  retry_frequency: number;
  average_difficulty: number;
  average_mastery: number;
  overall_health_score: number;
  weak_topics: string[];
  strong_topics: string[];
  topic_metrics: Record<
    string,
    {
      difficulty: number;
      mastery: number;
      retry_count: number;
      time_spent: number;
    }
  >;
  events_analyzed_count: number;
}

/** Normalise a raw API response into a fully-typed LearnerInsight. */
function normaliseInsight(raw: Record<string, unknown>): LearnerInsight {
  return {
    ...(raw as unknown as LearnerInsight),
    weak_topics: Array.isArray(raw.weak_topics) ? (raw.weak_topics as string[]) : [],
    strong_topics: Array.isArray(raw.strong_topics) ? (raw.strong_topics as string[]) : [],
    topic_metrics:
      raw.topic_metrics && typeof raw.topic_metrics === "object"
        ? (raw.topic_metrics as LearnerInsight["topic_metrics"])
        : {},
    pace_score: Number(raw.pace_score ?? 0.5),
    consistency_score: Number(raw.consistency_score ?? 0.5),
    retry_frequency: Number(raw.retry_frequency ?? 0),
    average_difficulty: Number(raw.average_difficulty ?? 0.5),
    average_mastery: Number(raw.average_mastery ?? 0),
    overall_health_score: Number(raw.overall_health_score ?? 0.5),
    events_analyzed_count: Number(raw.events_analyzed_count ?? 0),
    learning_pace:
      (raw.learning_pace as LearnerInsight["learning_pace"]) ?? "moderate",
  };
}

export interface Recommendation {
  id: string;
  user_id: string;
  recommendation_type: string;
  target_entity_type: string | null;
  target_entity_name: string | null;
  justification: string;
  confidence_score: number;
  priority: number;
  status: "active" | "viewed" | "accepted" | "dismissed" | "expired";
  created_at: string;
  expires_at: string | null;
}

export interface RecommendationStats {
  total: number;
  active: number;
  viewed: number;
  accepted: number;
  dismissed: number;
  by_type: Record<string, number>;
}

// ─── Insight Endpoints ────────────────────────────────────────────────────────

/**
 * Fetch the latest learner insight for the authenticated user.
 * Calls GET /api/intelligence/insights/latest/?user_id=<id>
 */
export async function getLatestInsight(
  userId: string,
): Promise<LearnerInsight | null> {
  const raw = await intelligenceFetch<Record<string, unknown> | undefined>(
    `/insights/latest/?user_id=${userId}`,
  );
  if (!raw) return null;
  return normaliseInsight(raw);
}

/**
 * Compute (or refresh) a new insight for a user.
 * Calls POST /api/intelligence/insights/compute/
 */
export async function computeInsight(
  userId: string,
  timeWindowDays = 30,
): Promise<LearnerInsight> {
  const raw = await intelligenceFetch<Record<string, unknown>>("/insights/compute/", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      time_window_days: timeWindowDays,
    }),
  });
  return normaliseInsight(raw);
}

/**
 * Fetch insight history for a user.
 * Calls GET /api/intelligence/insights/history/?user_id=<id>&limit=<n>
 */
export async function getInsightHistory(
  userId: string,
  limit = 10,
): Promise<LearnerInsight[]> {
  return intelligenceFetch<LearnerInsight[]>(
    `/insights/history/?user_id=${userId}&limit=${limit}`,
  );
}

// ─── Recommendation Endpoints ─────────────────────────────────────────────────

/**
 * Fetch active recommendations for a user.
 * Calls GET /api/intelligence/recommendations/active/?user_id=<id>
 */
export async function getActiveRecommendations(
  userId: string,
  limit = 20,
): Promise<Recommendation[]> {
  return intelligenceFetch<Recommendation[]>(
    `/recommendations/active/?user_id=${userId}&limit=${limit}`,
  );
}

/**
 * Generate new recommendations for a user.
 * Calls POST /api/intelligence/recommendations/generate/
 */
export async function generateRecommendations(
  userId: string,
  maxRecommendations = 10,
): Promise<{ count: number; recommendations: Recommendation[] }> {
  return intelligenceFetch<{
    count: number;
    recommendations: Recommendation[];
  }>("/recommendations/generate/", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      max_recommendations: maxRecommendations,
    }),
  });
}

/**
 * Get recommendation statistics for a user.
 * Calls GET /api/intelligence/recommendations/stats/?user_id=<id>
 */
export async function getRecommendationStats(
  userId: string,
): Promise<RecommendationStats> {
  return intelligenceFetch<RecommendationStats>(
    `/recommendations/stats/?user_id=${userId}`,
  );
}

/**
 * Perform an action on a recommendation (view / accept / dismiss).
 * Calls POST /api/intelligence/recommendations/<id>/perform_action/
 */
export async function performRecommendationAction(
  recommendationId: string,
  action: "view" | "accept" | "dismiss",
): Promise<Recommendation> {
  return intelligenceFetch<Recommendation>(
    `/recommendations/${recommendationId}/perform_action/`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
  );
}

// ─── All Insights (teacher view) ─────────────────────────────────────────────

/**
 * List all insights (teacher use – filtered by query params).
 * Calls GET /api/intelligence/insights/?user_id=<id>
 */
export async function listInsights(
  userId?: string,
): Promise<LearnerInsight[]> {
  const qs = userId ? `?user_id=${userId}` : "";
  const data = await intelligenceFetch<
    LearnerInsight[] | { results: LearnerInsight[] }
  >(`/insights/${qs}`);
  // Handle both paginated ({ results: [...] }) and plain array responses
  return Array.isArray(data) ? data : (data.results ?? []);
}
