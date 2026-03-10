"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  listInsights,
  getRecommendationStats,
  computeAllInsights,
  type LearnerInsight,
  type RecommendationStats,
} from "@/api/intelligence";
import {
  Brain,
  Users,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Star,
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
    very_slow: "bg-red-100 text-red-700",
    slow: "bg-orange-100 text-orange-700",
    moderate: "bg-yellow-100 text-yellow-700",
    fast: "bg-emerald-100 text-emerald-700",
    very_fast: "bg-green-100 text-green-700",
  };
  return map[pace] ?? "bg-gray-100 text-gray-700";
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
      <span className="text-xs font-medium text-gray-500 w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

// Aggregate weak/strong topics across all insights
function aggregateTopics(insights: LearnerInsight[]) {
  const weakCounts: Record<string, number> = {};
  const strongCounts: Record<string, number> = {};
  for (const ins of insights) {
    for (const t of ins.weak_topics) {
      weakCounts[t] = (weakCounts[t] ?? 0) + 1;
    }
    for (const t of ins.strong_topics) {
      strongCounts[t] = (strongCounts[t] ?? 0) + 1;
    }
  }
  const sortedWeak = Object.entries(weakCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const sortedStrong = Object.entries(strongCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return { sortedWeak, sortedStrong };
}

// Distribution of learning pace across students
function paceDistribution(insights: LearnerInsight[]) {
  const counts: Record<string, number> = {
    very_slow: 0,
    slow: 0,
    moderate: 0,
    fast: 0,
    very_fast: 0,
  };
  for (const ins of insights) {
    counts[ins.learning_pace] = (counts[ins.learning_pace] ?? 0) + 1;
  }
  return counts;
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-primary-dark">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TeacherIntelligencePage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [insights, setInsights] = useState<LearnerInsight[]>([]);
  const [recStats, setRecStats] = useState<RecommendationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [computeMsg, setComputeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setError(null);
    const [insightList, stats] = await Promise.allSettled([
      listInsights(),
      getRecommendationStats(user.id),
    ]);

    if (insightList.status === "fulfilled") {
      setInsights(insightList.value);
    } else {
      setError(
        insightList.reason instanceof Error
          ? insightList.reason.message
          : "Failed to load student insights",
      );
    }
    if (stats.status === "fulfilled") {
      setRecStats(stats.value);
    }
  }, [user]);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "teacher") {
      setIsLoading(true);
      loadData().finally(() => setIsLoading(false));
    }
  }, [isReady, isAuthenticated, user, loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleComputeAll = async () => {
    setIsComputing(true);
    setComputeMsg(null);
    try {
      const result = await computeAllInsights();
      setComputeMsg(
        result.computed > 0
          ? `Computed insights for ${result.computed} student${result.computed !== 1 ? "s" : ""}.${
              result.failed > 0 ? ` ${result.failed} failed.` : ""
            }`
          : "No learning events found to compute insights from.",
      );
      await loadData();
    } catch (err) {
      setComputeMsg(
        err instanceof Error ? err.message : "Failed to compute insights",
      );
    } finally {
      setIsComputing(false);
    }
  };

  if (!isReady || !isAuthenticated || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
      </div>
    );
  }

  const { sortedWeak, sortedStrong } = aggregateTopics(insights);
  const paceDist = paceDistribution(insights);
  const avgHealth =
    insights.length > 0
      ? insights.reduce((s, i) => s + i.overall_health_score, 0) /
        insights.length
      : 0;
  const avgConsistency =
    insights.length > 0
      ? insights.reduce((s, i) => s + i.consistency_score, 0) / insights.length
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="teacher" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                Class Intelligence
              </h1>
              <p className="text-sm text-primary">
                Aggregated learner insights across all students
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleComputeAll}
                disabled={isComputing || isLoading}
                className="px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Brain
                  className={`w-4 h-4 ${isComputing ? "animate-pulse" : ""}`}
                />
                {isComputing ? "Computing…" : "Compute All Insights"}
              </button>
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
          </div>
        </header>

        <main className="flex-1 px-8 py-6 space-y-8">
          {/* Compute feedback banner */}
          {computeMsg && (
            <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700">
              <p className="text-sm">{computeMsg}</p>
              <button
                onClick={() => setComputeMsg(null)}
                className="text-xs text-blue-500 hover:text-blue-700 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

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

          {/* Empty state */}
          {!isLoading && !error && insights.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No student insights yet</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                Insights are computed from student learning activity. Once
                students have completed sessions or content, use the Refresh
                button above to load their latest insights.
              </p>
            </div>
          )}

          {!isLoading && insights.length > 0 && (
            <>
              {/* ── Overview KPIs ── */}
              <section>
                <h2 className="text-lg font-semibold text-primary-dark mb-4">
                  Class Overview
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={Users}
                    label="Students Tracked"
                    value={insights.length}
                    sub="with learning events"
                    color="text-blue-600"
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Avg Health Score"
                    value={`${Math.round(avgHealth * 100)}%`}
                    sub="overall learning health"
                    color="text-emerald-600"
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Avg Consistency"
                    value={`${Math.round(avgConsistency * 100)}%`}
                    sub="across all students"
                    color="text-primary"
                  />
                  <StatCard
                    icon={Brain}
                    label="Active Recs"
                    value={recStats?.active ?? "—"}
                    sub="pending recommendations"
                    color="text-amber-600"
                  />
                </div>
              </section>

              {/* ── Learning Pace Distribution ── */}
              <section className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-primary-dark mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Learning Pace Distribution
                </h3>
                <div className="space-y-3">
                  {(
                    [
                      "very_fast",
                      "fast",
                      "moderate",
                      "slow",
                      "very_slow",
                    ] as LearnerInsight["learning_pace"][]
                  ).map((pace) => {
                    const count = paceDist[pace] ?? 0;
                    const pct =
                      insights.length > 0
                        ? Math.round((count / insights.length) * 100)
                        : 0;
                    return (
                      <div key={pace} className="flex items-center gap-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full w-24 text-center ${paceColor(pace)}`}
                        >
                          {paceLabel(pace)}
                        </span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {count} student{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Weak / Strong Topics ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weakest topics class-wide */}
                {sortedWeak.length > 0 && (
                  <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4" />
                      Weakest Topics Across Class
                    </h3>
                    <div className="space-y-2">
                      {sortedWeak.map(([topic, count]) => (
                        <div
                          key={topic}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700 truncate max-w-[200px]">
                            {topic}
                          </span>
                          <span className="text-xs text-red-500 font-medium shrink-0">
                            {count} student{count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strongest topics */}
                {sortedStrong.length > 0 && (
                  <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2 mb-4">
                      <Star className="w-4 h-4" />
                      Strongest Topics Across Class
                    </h3>
                    <div className="space-y-2">
                      {sortedStrong.map(([topic, count]) => (
                        <div
                          key={topic}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-700 truncate max-w-[200px]">
                            {topic}
                          </span>
                          <span className="text-xs text-emerald-600 font-medium shrink-0">
                            {count} student{count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Recommendation Stats ── */}
              {recStats && (
                <section className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-primary-dark flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4" />
                    Recommendation Activity
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Total", value: recStats.total, color: "text-gray-700" },
                      { label: "Active", value: recStats.active, color: "text-blue-600" },
                      { label: "Accepted", value: recStats.accepted, color: "text-emerald-600" },
                      { label: "Dismissed", value: recStats.dismissed, color: "text-gray-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Per-Student Table ── */}
              <section className="bg-white rounded-xl border border-secondary/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-secondary/20 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-primary-dark">
                    Individual Student Insights
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3">Student</th>
                        <th className="text-left px-4 py-3">Pace</th>
                        <th className="text-left px-4 py-3">Health</th>
                        <th className="text-left px-4 py-3">Consistency</th>
                        <th className="text-left px-4 py-3">Weak Topics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {insights.map((ins) => (
                        <tr
                          key={ins.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-5 py-3 text-sm font-medium text-gray-700 truncate max-w-[180px]">
                            {ins.user_display_name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${paceColor(ins.learning_pace)}`}
                            >
                              {paceLabel(ins.learning_pace)}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-32">
                            {scoreBar(
                              ins.overall_health_score,
                              "bg-emerald-500",
                            )}
                          </td>
                          <td className="px-4 py-3 w-32">
                            {scoreBar(ins.consistency_score, "bg-blue-500")}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                            {ins.weak_topics.slice(0, 3).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
