"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import StatCard from "@/components/insights/StatCard";
import StudentProgressChart from "@/components/analytics/StudentProgressChart";
import SubjectPerformanceChart from "@/components/analytics/SubjectPerformanceChart";
import TopicRadarChart from "@/components/analytics/TopicRadarChart";
import { getMyAnalytics, type MyAnalytics } from "@/api/analytics";
import {
  BarChart3,
  TrendingUp,
  Star,
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function StudentAnalyticsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [analytics, setAnalytics] = useState<MyAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      loadData();
    }
  }, [isReady, isAuthenticated, user, loadData]);

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
              <h1 className="text-2xl font-bold text-primary-dark">My Analytics</h1>
              <p className="text-sm text-primary">
                Your performance across all assessments
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading your analytics…</span>
              </div>
            </div>
          ) : analytics ? (
            <div className="space-y-8">
              {/* ── Overview KPIs ── */}
              <section>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Assessments Taken"
                    value={analytics.overview.total_assessments}
                    icon={BarChart3}
                    color="blue"
                  />
                  <StatCard
                    label="Average Score"
                    value={`${analytics.overview.avg_percentage}%`}
                    icon={TrendingUp}
                    color="primary"
                  />
                  <StatCard
                    label="Best Score"
                    value={`${analytics.overview.best_percentage}%`}
                    icon={Star}
                    color="amber"
                  />
                  <StatCard
                    label="Subjects"
                    value={analytics.overview.subjects_count}
                    icon={BookOpen}
                    color="emerald"
                  />
                </div>
              </section>

              {/* ── Score Progression ── */}
              <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-primary-dark mb-1">
                  Score Progression
                </h3>
                <p className="text-xs text-secondary mb-4">
                  Your performance over time across all assessments
                </p>
                <StudentProgressChart data={analytics.progress} />
              </section>

              {/* ── Subject + Topic Row ── */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-1">
                    Subject Performance
                  </h3>
                  <p className="text-xs text-secondary mb-4">
                    Average score across each subject
                  </p>
                  <SubjectPerformanceChart data={analytics.subjects} />
                </div>

                <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-1">
                    Topic Mastery
                  </h3>
                  <p className="text-xs text-secondary mb-4">
                    Strengths and weaknesses per question type
                  </p>
                  <TopicRadarChart data={analytics.topics} />
                </div>
              </section>

              {/* ── Question Breakdown Table ── */}
              {analytics.topics.length > 0 && (
                <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-4">
                    Question-Level Breakdown
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-secondary/20">
                          <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                            Question
                          </th>
                          <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                            Topic
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                            Avg Score
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                            Attempts
                          </th>
                          <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide pl-4">
                            Performance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary/10">
                        {analytics.topics.map((t) => (
                          <tr key={t.topic} className="hover:bg-gray-50">
                            <td className="py-3 font-medium text-primary-dark">
                              {t.topic}
                            </td>
                            <td className="py-3 text-secondary max-w-[200px] truncate">
                              {t.question_text || "—"}
                            </td>
                            <td className="py-3 text-right font-semibold text-primary-dark">
                              {t.avg_percentage}%
                            </td>
                            <td className="py-3 text-right text-secondary">
                              {t.attempts}
                            </td>
                            <td className="py-3 pl-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                                  <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                      width: `${t.avg_percentage}%`,
                                      backgroundColor:
                                        t.avg_percentage >= 75
                                          ? "#22c55e"
                                          : t.avg_percentage >= 50
                                            ? "#eab308"
                                            : "#ef4444",
                                    }}
                                  />
                                </div>
                                <span
                                  className="text-xs font-medium"
                                  style={{
                                    color:
                                      t.avg_percentage >= 75
                                        ? "#16a34a"
                                        : t.avg_percentage >= 50
                                          ? "#ca8a04"
                                          : "#dc2626",
                                  }}
                                >
                                  {t.avg_percentage >= 75
                                    ? "Strong"
                                    : t.avg_percentage >= 50
                                      ? "Fair"
                                      : "Needs Work"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── Recent Assessments ── */}
              {analytics.progress.length > 0 && (
                <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-4">
                    Recent Assessments
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-secondary/20">
                          <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                            Assessment
                          </th>
                          <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                            Subject
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                            Score
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                            Percentage
                          </th>
                          <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary/10">
                        {[...analytics.progress].reverse().slice(0, 10).map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="py-3 font-medium text-primary-dark max-w-[200px] truncate">
                              {p.assessment}
                            </td>
                            <td className="py-3 text-secondary">{p.subject}</td>
                            <td className="py-3 text-right text-secondary">
                              {p.score}/{p.max_score}
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={`font-semibold ${
                                  p.percentage >= 75
                                    ? "text-emerald-600"
                                    : p.percentage >= 50
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }`}
                              >
                                {p.percentage}%
                              </span>
                            </td>
                            <td className="py-3 text-right text-secondary text-xs">
                              {p.date ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-secondary gap-3">
              <BarChart3 className="w-12 h-12 text-secondary/40" />
              <p className="text-base">No analytics data yet</p>
              <p className="text-sm text-secondary/70">
                Complete your first assessment to see your performance analytics.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
