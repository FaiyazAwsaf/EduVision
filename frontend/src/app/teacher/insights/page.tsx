"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  getEvaluationInsights,
  type EvaluationInsights,
} from "@/api/evaluation";
import {
  getMyTeachingAssignments,
  getClasses,
  type TeachingAssignment,
} from "@/api/school";

import StatCard from "@/components/insights/StatCard";
import PerformersTable from "@/components/insights/PerformersTable";
import SectionPerformanceChart from "@/components/insights/SectionPerformanceChart";

import {
  Users,
  BarChart3,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

export default function TeacherInsightsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  // Class selection
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [classes, setClasses] = useState<{ id: number; label: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const [evalInsights, setEvalInsights] = useState<EvaluationInsights | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Load teaching assignments + classes on mount to build class dropdown
  useEffect(() => {
    if (!isReady || !isAuthenticated || user?.role !== "teacher") return;

    const load = async () => {
      setIsLoading(true);
      try {
        const [assignData, classData] = await Promise.all([
          getMyTeachingAssignments(),
          getClasses(),
        ]);
        setAssignments(assignData);

        // Collect section IDs this teacher is assigned to
        const teacherSectionIds = new Set(
          assignData.map((a) => a.section),
        );

        // Only include classes that contain at least one of the teacher's sections
        const classList: { id: number; label: string }[] = [];
        for (const c of classData) {
          const hasAssignedSection = c.sections.some((s) =>
            teacherSectionIds.has(s.id),
          );
          if (hasAssignedSection) {
            const label = c.stream
              ? `Class ${c.name} — ${c.stream}`
              : `Class ${c.name}`;
            classList.push({ id: c.id, label });
          }
        }
        setClasses(classList);
        if (classList.length > 0) {
          setSelectedClassId(classList[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load classes",
        );
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isReady, isAuthenticated, user]);

  // Load insights when class changes
  const loadInsights = useCallback(async () => {
    if (selectedClassId == null) return;
    setIsLoadingInsights(true);
    setError(null);
    try {
      const data = await getEvaluationInsights(selectedClassId);
      setEvalInsights(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load insights",
      );
    } finally {
      setIsLoadingInsights(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedClassId != null) loadInsights();
  }, [selectedClassId, loadInsights]);

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
                Performance overview for your class
              </p>
            </div>
            <button
              onClick={loadInsights}
              disabled={isLoadingInsights || selectedClassId == null}
              className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingInsights ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 space-y-8">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {/* Section Selector */}
          <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-primary-dark mb-3">
              Select Class
            </h3>
            {isLoading ? (
              <div className="flex items-center gap-2 text-secondary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading classes…
              </div>
            ) : classes.length === 0 ? (
              <p className="text-sm text-secondary">
                No teaching assignments found. You need at least one assigned
                class.
              </p>
            ) : (
              <div className="relative max-w-md">
                <select
                  value={selectedClassId ?? ""}
                  onChange={(e) =>
                    setSelectedClassId(Number(e.target.value))
                  }
                  className="w-full appearance-none bg-background border border-secondary/40 rounded-lg px-4 py-2.5 text-sm text-primary-dark pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
              </div>
            )}
          </section>

          {/* Loading state */}
          {isLoadingInsights && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading insights…</span>
              </div>
            </div>
          )}

          {/* Content */}
          {!isLoadingInsights && evalInsights && (
            <>
              {/* KPI Cards */}
              <section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    label="Students"
                    value={evalInsights.overview.student_count}
                    icon={Users}
                    color="blue"
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
                </div>
              </section>

              {/* Section Performance Chart */}
              <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-primary-dark mb-1">
                  Section Performance
                </h3>
                <p className="text-xs text-secondary mb-4">
                  Average scores per section in the selected class
                </p>
                <SectionPerformanceChart
                  data={evalInsights.section_performance}
                />
              </section>

              {/* Top / Bottom Performers */}
              <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-primary-dark mb-4">
                  Student Performance Table
                </h3>
                <PerformersTable
                  topPerformers={evalInsights.top_performers}
                  bottomPerformers={evalInsights.bottom_performers}
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
