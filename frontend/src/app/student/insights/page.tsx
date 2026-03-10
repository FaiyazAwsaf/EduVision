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
  TrendingUp,
  Activity,
  Zap,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
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
    very_slow: "text-red-500",
    slow: "text-orange-500",
    moderate: "text-yellow-500",
    fast: "text-emerald-500",
    very_fast: "text-green-600",
  };
  return map[pace] ?? "text-gray-600";
}

function safePct(value: number | null | undefined): number {
  const n = Math.round((value ?? 0) * 100);
  return isNaN(n) ? 0 : n;
}

function MiniBar({
  value,
  colorClass = "bg-primary",
}: {
  value: number | null | undefined;
  colorClass?: string;
}) {
  const pct = safePct(value);
  return (
    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
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
  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {rec.recommendation_type.replace(/_/g, " ")}
          </p>
          {rec.target_entity_name && (
            <p className="text-xs text-gray-500 mt-0.5">{rec.target_entity_name}</p>
          )}
          <p className="text-sm text-gray-600 mt-1 leading-snug">
            {rec.justification}
          </p>
        </div>
        <div className="shrink-0">
          {rec.status === "active" && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onAction(rec.id, "accept")}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onAction(rec.id, "dismiss")}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
          {rec.status === "accepted" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Done
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
            <h1 className="text-xl font-bold text-primary-dark">
              Learning Insights
            </h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="px-3 py-1.5 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-6 space-y-6">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && !insight && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-base font-medium">No insights yet</p>
              <p className="text-sm mt-1">Complete some activities to generate your learning insights.</p>
            </div>
          )}

          {/* Data */}
          {!isLoading && insight && (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide">Pace</span>
                  </div>
                  <p className={`text-xl font-bold ${paceColor(insight.learning_pace)}`}>
                    {paceLabel(insight.learning_pace)}
                  </p>
                  <MiniBar value={insight.pace_score} colorClass="bg-blue-400" />
                </div>

                <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide">Consistency</span>
                  </div>
                  <p className="text-xl font-bold text-primary-dark">
                    {safePct(insight.consistency_score)}%
                  </p>
                  <MiniBar value={insight.consistency_score} colorClass="bg-emerald-400" />
                </div>

                <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide">Retry Rate</span>
                  </div>
                  <p className="text-xl font-bold text-primary-dark">
                    {safePct(insight.retry_frequency)}%
                  </p>
                  <MiniBar value={insight.retry_frequency} colorClass="bg-amber-400" />
                </div>

                <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide">Health</span>
                  </div>
                  <p className="text-xl font-bold text-primary-dark">
                    {safePct(insight.overall_health_score)}%
                  </p>
                  <MiniBar value={insight.overall_health_score} colorClass="bg-primary" />
                </div>
              </div>

              {/* ── Topic Metrics ── */}
              {Object.keys(insight.topic_metrics).length > 0 && (
                <section className="bg-white rounded-xl border border-secondary/30 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-secondary/20 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-primary-dark">Topics</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-5 py-3">Topic</th>
                          <th className="text-left px-4 py-3 w-36">Mastery</th>
                          <th className="text-left px-4 py-3 w-36">Difficulty</th>
                          <th className="text-left px-4 py-3">Retries</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(insight.topic_metrics).map(([topic, metrics]) => (
                          <tr key={topic} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-700">{topic}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-400"
                                    style={{ width: `${safePct(metrics.mastery)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-7 text-right">
                                  {safePct(metrics.mastery)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-amber-400"
                                    style={{ width: `${safePct(metrics.difficulty)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 w-7 text-right">
                                  {safePct(metrics.difficulty)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{metrics.retry_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── Recommendations ── */}
              {recommendations.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-primary-dark mb-3">Recommendations</h2>
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

              <p className="text-xs text-gray-400 text-right pb-2">
                {insight.events_analyzed_count} events ·{" "}
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
