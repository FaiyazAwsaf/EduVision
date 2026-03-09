"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  getLatestInsight,
  computeInsight,
  getActiveRecommendations,
  performRecommendationAction,
  type LearnerInsight,
  type Recommendation,
} from "@/api/intelligence";
import {
  Brain,
  TrendingUp,
  Activity,
  Zap,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Star,
  BookOpen,
  Target,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paceLabel(pace: LearnerInsight["learning_pace"]): string {
  const map: Record<string, string> = {
    very_slow: "Very Slow",
    slow: "Slow",
    moderate: "Moderate",
    fast: "Fast",
    very_fast: "Very Fast",
  };
  return map[pace] ?? pace;
}

function paceColor(pace: LearnerInsight["learning_pace"]): string {
  const map: Record<string, string> = {
    very_slow: "text-red-600",
    slow: "text-orange-500",
    moderate: "text-yellow-500",
    fast: "text-emerald-500",
    very_fast: "text-green-600",
  };
  return map[pace] ?? "text-gray-600";
}

function scoreBar(value: number, colorClass = "bg-primary") {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function RecommendationCard({
  rec,
  onAction,
}: {
  rec: Recommendation;
  onAction: (id: string, action: "view" | "accept" | "dismiss") => void;
}) {
  const priorityColors = [
    "border-red-300 bg-red-50",
    "border-orange-300 bg-orange-50",
    "border-yellow-300 bg-yellow-50",
    "border-blue-300 bg-blue-50",
    "border-gray-200 bg-gray-50",
  ];
  const borderClass = priorityColors[rec.priority - 1] ?? priorityColors[4];

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {rec.recommendation_type.replace(/_/g, " ")}
          </p>
          {rec.target_entity_name && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {rec.target_entity_name}
            </p>
          )}
          <p className="text-sm text-gray-600 mt-1 leading-snug">
            {rec.justification}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <div className="text-xs text-gray-400">
              Confidence: {Math.round(rec.confidence_score * 100)}%
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {rec.status === "active" && (
            <>
              <button
                onClick={() => onAction(rec.id, "accept")}
                className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onAction(rec.id, "dismiss")}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Dismiss
              </button>
            </>
          )}
          {rec.status === "accepted" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Accepted
            </span>
          )}
          {rec.status === "dismissed" && (
            <span className="text-xs text-gray-400">Dismissed</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StudentInsightsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [insight, setInsight] = useState<LearnerInsight | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;
      setError(null);
      try {
        let latestInsight = await getLatestInsight(user.id);
        if (!latestInsight || forceRefresh) {
          latestInsight = await computeInsight(user.id, 30);
        }
        const recs = await getActiveRecommendations(user.id, 20);
        setInsight(latestInsight);
        setRecommendations(recs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load insights",
        );
      }
    },
    [user],
  );

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      setIsLoading(true);
      loadData().finally(() => setIsLoading(false));
    }
  }, [isReady, isAuthenticated, user, loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  };

  const handleRecommendationAction = async (
    id: string,
    action: "view" | "accept" | "dismiss",
  ) => {
    try {
      const updated = await performRecommendationAction(id, action);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
    } catch {
      // silent
    }
  };

  if (!isReady || !isAuthenticated || !user || user.role !== "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="student" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                My Learning Insights
              </h1>
              <p className="text-sm text-primary">
                AI-powered analysis of your learning patterns
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-6 space-y-8">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* No data */}
          {!isLoading && !error && !insight && (
            <div className="text-center py-20 text-gray-400">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No insights yet</p>
              <p className="text-sm mt-1">
                Complete some activities to generate your learning insights.
              </p>
            </div>
          )}

          {/* Insight data */}
          {!isLoading && insight && (
            <>
              {/* ── KPI Cards ── */}
              <section>
                <h2 className="text-lg font-semibold text-primary-dark mb-4">
                  Learning Overview
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Learning Pace */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Learning Pace
                      </span>
                    </div>
                    <p
                      className={`text-2xl font-bold ${paceColor(insight.learning_pace)}`}
                    >
                      {paceLabel(insight.learning_pace)}
                    </p>
                    <div className="mt-2">
                      {scoreBar(insight.pace_score, "bg-blue-500")}
                    </div>
                  </div>

                  {/* Consistency */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Consistency
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary-dark">
                      {Math.round(insight.consistency_score * 100)}%
                    </p>
                    <div className="mt-2">
                      {scoreBar(insight.consistency_score, "bg-emerald-500")}
                    </div>
                  </div>

                  {/* Retry Frequency */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <RefreshCw className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Retry Rate
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary-dark">
                      {Math.round(insight.retry_frequency * 100)}%
                    </p>
                    <div className="mt-2">
                      {scoreBar(insight.retry_frequency, "bg-amber-500")}
                    </div>
                  </div>

                  {/* Overall Health */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Health Score
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary-dark">
                      {Math.round(insight.overall_health_score * 100)}%
                    </p>
                    <div className="mt-2">
                      {scoreBar(insight.overall_health_score, "bg-primary")}
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Topic Breakdown ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weak Topics */}
                {insight.weak_topics.length > 0 && (
                  <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4" />
                      Topics Needing Attention
                    </h3>
                    <ul className="space-y-2">
                      {insight.weak_topics.map((topic) => (
                        <li
                          key={topic}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <ChevronRight className="w-3 h-3 text-red-400 shrink-0" />
                          <span className="truncate">{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strong Topics */}
                {insight.strong_topics.length > 0 && (
                  <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4" />
                      Strong Topics
                    </h3>
                    <ul className="space-y-2">
                      {insight.strong_topics.map((topic) => (
                        <li
                          key={topic}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Topic Metrics Table ── */}
              {Object.keys(insight.topic_metrics).length > 0 && (
                <section className="bg-white rounded-xl border border-secondary/30 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-secondary/20">
                    <h3 className="text-sm font-semibold text-primary-dark flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Per-Topic Metrics
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-5 py-3">Topic</th>
                          <th className="text-left px-4 py-3">Mastery</th>
                          <th className="text-left px-4 py-3">Difficulty</th>
                          <th className="text-left px-4 py-3">Retries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(insight.topic_metrics).map(
                          ([topic, metrics]) => (
                            <tr
                              key={topic}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-5 py-3 font-medium text-gray-700 max-w-xs truncate">
                                {topic}
                              </td>
                              <td className="px-4 py-3 w-32">
                                {scoreBar(metrics.mastery, "bg-emerald-500")}
                              </td>
                              <td className="px-4 py-3 w-32">
                                {scoreBar(metrics.difficulty, "bg-amber-500")}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {metrics.retry_count}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── Recommendations ── */}
              {recommendations.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-primary-dark mb-4">
                    Recommendations
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {recommendations.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        rec={rec}
                        onAction={handleRecommendationAction}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Footer meta */}
              <p className="text-xs text-gray-400 text-right">
                Insight computed from {insight.events_analyzed_count} events ·
                Last updated{" "}
                {insight.computed_at
                  ? new Date(insight.computed_at).toLocaleDateString()
                  : "—"}
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
