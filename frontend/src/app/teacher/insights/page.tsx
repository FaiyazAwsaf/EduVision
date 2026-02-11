"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  getEvaluationInsights,
  type EvaluationInsights,
} from "@/api/evaluation";
import { getSchoolInsights, type SchoolInsights } from "@/api/school";

import StatCard from "@/components/insights/StatCard";
import SectionPerformanceChart from "@/components/insights/SectionPerformanceChart";
import ScoreDistributionChart from "@/components/insights/ScoreDistributionChart";
import QuestionAnalysisChart from "@/components/insights/QuestionAnalysisChart";
import SubmissionTimelineChart from "@/components/insights/SubmissionTimelineChart";
import PerformersTable from "@/components/insights/PerformersTable";
import ContentSummaryChart from "@/components/insights/ContentSummaryChart";
import TutoringActivityChart from "@/components/insights/TutoringActivityChart";

import {
  Users,
  FileCheck,
  BarChart3,
  Clock,
  Video,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function TeacherInsightsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [evalInsights, setEvalInsights] = useState<EvaluationInsights | null>(
    null,
  );
  const [schoolInsights, setSchoolInsights] = useState<SchoolInsights | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [evalData, schoolData] = await Promise.all([
        getEvaluationInsights(),
        getSchoolInsights(),
      ]);
      setEvalInsights(evalData);
      setSchoolInsights(schoolData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "teacher") {
      loadData();
    }
  }, [isReady, isAuthenticated, user, loadData]);

  if (!isReady || !isAuthenticated || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="teacher" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                Insights
              </h1>
              <p className="text-sm text-primary">
                Analytics and performance overview across your sections
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {/* Error */}
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
                <span>Loading insights...</span>
              </div>
            </div>
          ) : (
            evalInsights &&
            schoolInsights && (
              <div className="space-y-8">
                {/* ─── 1. Overview Stats ───────────────────────────── */}
                <section>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard
                      label="Total Students"
                      value={schoolInsights.total_students}
                      icon={Users}
                      color="blue"
                    />
                    <StatCard
                      label="Scripts Evaluated"
                      value={evalInsights.overview.evaluated_count}
                      icon={FileCheck}
                      color="emerald"
                    />
                    <StatCard
                      label="Avg Score"
                      value={`${evalInsights.overview.avg_percentage}%`}
                      icon={BarChart3}
                      color="primary"
                    />
                    <StatCard
                      label="Pending Reviews"
                      value={evalInsights.overview.pending_count}
                      icon={Clock}
                      color="amber"
                    />
                    <StatCard
                      label="Tutoring Sessions"
                      value={schoolInsights.tutoring_summary.total_sessions}
                      icon={Video}
                      color="purple"
                    />
                    <StatCard
                      label="Content Generated"
                      value={schoolInsights.content_summary.completed}
                      icon={FileText}
                      color="blue"
                    />
                  </div>
                </section>

                {/* ─── 2 & 3. Charts row ──────────────────────────── */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-4">
                      Section Performance
                    </h3>
                    <SectionPerformanceChart
                      data={evalInsights.section_performance}
                    />
                  </div>
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-4">
                      Score Distribution
                    </h3>
                    <ScoreDistributionChart
                      data={evalInsights.score_distribution}
                    />
                  </div>
                </section>

                {/* ─── 4 & 5. Question analysis + Timeline ────────── */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-1">
                      Question Difficulty Analysis
                    </h3>
                    <p className="text-xs text-secondary mb-4">
                      Based on the most recent submission form
                    </p>
                    <QuestionAnalysisChart
                      data={evalInsights.question_analysis}
                    />
                  </div>
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-1">
                      Submission Timeline
                    </h3>
                    <p className="text-xs text-secondary mb-4">
                      Scripts submitted vs evaluated (last 30 days)
                    </p>
                    <SubmissionTimelineChart
                      data={evalInsights.submission_timeline}
                    />
                  </div>
                </section>

                {/* ─── 6. Top/Bottom Performers ───────────────────── */}
                <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-4">
                    Student Performance
                  </h3>
                  <PerformersTable
                    topPerformers={evalInsights.top_performers}
                    bottomPerformers={evalInsights.bottom_performers}
                  />
                </section>

                {/* ─── 7 & 8. Content + Tutoring ──────────────────── */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-4">
                      Content Generation
                    </h3>
                    <ContentSummaryChart
                      data={schoolInsights.content_summary}
                    />
                  </div>
                  <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-primary-dark mb-4">
                      Tutoring Activity
                    </h3>
                    <TutoringActivityChart
                      data={schoolInsights.tutoring_summary}
                    />
                  </div>
                </section>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
}
