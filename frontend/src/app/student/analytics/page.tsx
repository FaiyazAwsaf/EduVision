"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import StatCard from "@/components/insights/StatCard";
import StudentProgressChart from "@/components/analytics/StudentProgressChart";
import SubjectPerformanceChart from "@/components/analytics/SubjectPerformanceChart";
import ScoreDistributionChart from "@/components/analytics/ScoreDistributionChart";
import ConsistencyChart from "@/components/analytics/ConsistencyChart";
import { getMyAnalytics, type MyAnalytics } from "@/api/analytics";
import {
  BarChart3,
  TrendingUp,
  Star,
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function StudentAnalyticsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [analytics, setAnalytics] = useState<MyAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");

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

  const filteredProgress = analytics
    ? selectedSubject
      ? analytics.progress.filter((p) => p.subject === selectedSubject)
      : analytics.progress
    : [];

  const strengths = analytics?.subjects.filter((s) => s.avg_percentage >= 75) ?? [];
  const needsWork = analytics?.subjects.filter((s) => s.avg_percentage < 75) ?? [];

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
            <div className="flex items-center gap-3">
              {analytics && analytics.subjects.length > 0 && (
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="text-sm text-primary border border-secondary/50 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All Subjects</option>
                  {analytics.subjects.map((s) => (
                    <option key={s.subject} value={s.subject}>
                      {s.subject}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
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

              {/* ── Strengths & Needs Attention ── */}
              {analytics.subjects.length > 0 && (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-base font-semibold text-primary-dark">Your Strengths</h3>
                    </div>
                    {strengths.length === 0 ? (
                      <p className="text-sm text-secondary">
                        Keep working — strengths will appear here once you hit 75% in a subject.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {strengths.map((s) => (
                          <div key={s.subject} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-primary-dark">{s.subject}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${s.avg_percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-emerald-600 w-10 text-right">
                                {s.avg_percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Needs Attention */}
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-semibold text-primary-dark">Needs Attention</h3>
                    </div>
                    {needsWork.length === 0 ? (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <p className="text-sm font-medium">You're on track in all subjects!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {needsWork.map((s) => (
                          <div key={s.subject} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-primary-dark">{s.subject}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${s.avg_percentage}%`,
                                    backgroundColor: s.avg_percentage >= 50 ? "#eab308" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span
                                className="text-xs font-semibold w-10 text-right"
                                style={{ color: s.avg_percentage >= 50 ? "#ca8a04" : "#dc2626" }}
                              >
                                {s.avg_percentage}%
                              </span>
                              <button
                                onClick={() => router.push("/student/tutoring")}
                                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                              >
                                Study <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Score Progression ── */}
              <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-base font-semibold text-primary-dark">Score Progression</h3>
                  {selectedSubject && (
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedSubject}
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary mb-4">
                  {selectedSubject
                    ? `Performance over time in ${selectedSubject}`
                    : "Your performance over time across all assessments"}
                </p>
                <StudentProgressChart data={filteredProgress} />
              </section>

              {/* ── Subject Performance ── */}
              <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-primary-dark mb-1">
                  Subject Performance
                </h3>
                <p className="text-xs text-secondary mb-4">
                  Average score across each subject — click a bar to start tutoring
                </p>
                <SubjectPerformanceChart
                  data={analytics.subjects}
                  onBarClick={() => router.push("/student/tutoring")}
                />
              </section>

              {/* ── Score Distribution & Consistency ── */}
              {analytics.progress.length > 0 && (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-1">
                      Score Distribution
                    </h3>
                    <p className="text-xs text-secondary mb-4">
                      How your scores spread across performance bands
                    </p>
                    <ScoreDistributionChart data={filteredProgress} />
                  </div>

                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-1">
                      Consistency by Subject
                    </h3>
                    <p className="text-xs text-secondary mb-4">
                      Score range per subject — narrow band means reliable performance
                    </p>
                    <ConsistencyChart
                      progress={analytics.progress}
                      subjects={analytics.subjects}
                    />
                  </div>
                </section>
              )}

              {/* ── Recent Assessments ── */}
              {filteredProgress.length > 0 && (
                <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-base font-semibold text-primary-dark">Recent Assessments</h3>
                    {selectedSubject && (
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {selectedSubject}
                      </span>
                    )}
                  </div>
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
                        {[...filteredProgress].reverse().slice(0, 10).map((p, i) => (
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
