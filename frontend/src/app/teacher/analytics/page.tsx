"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import StatCard from "@/components/insights/StatCard";
import ClassDistributionChart from "@/components/analytics/ClassDistributionChart";
import QuestionDifficultyChart from "@/components/analytics/QuestionDifficultyChart";
import MisconceptionList from "@/components/analytics/MisconceptionList";
import {
  getSubmissionForms,
  type SubmissionForm,
} from "@/api/evaluation";
import {
  getClassDistribution,
  getClassQuestionPerformance,
  getMisconceptions,
  recomputeMisconceptions,
  rebuildSnapshots,
  type ClassDistribution,
  type QuestionPerformanceEntry,
  type Misconception,
} from "@/api/analytics";
import { listRubricSets } from "@/api/rubrics";
import type { RubricSetListItem } from "@/types/rubrics";

import {
  Users,
  BarChart3,
  Brain,
  FileCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Database,
} from "lucide-react";

export default function TeacherAnalyticsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  // Form selection
  const [forms, setForms] = useState<SubmissionForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");

  // Analytics data
  const [distribution, setDistribution] = useState<ClassDistribution | null>(null);
  const [questionPerf, setQuestionPerf] = useState<QuestionPerformanceEntry[]>([]);

  // Misconception selection
  const [rubricSets, setRubricSets] = useState<RubricSetListItem[]>([]);
  const [selectedRubricSetId, setSelectedRubricSetId] = useState<string>("");
  const [questions, setQuestions] = useState<{ id: string; number: number; text: string }[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);

  // UI state
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isLoadingMisconceptions, setIsLoadingMisconceptions] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Load forms + rubric sets on mount
  useEffect(() => {
    if (!isReady || !isAuthenticated || user?.role !== "teacher") return;

    const load = async () => {
      setIsLoadingForms(true);
      try {
        const [formsData, setsData] = await Promise.all([
          getSubmissionForms(),
          listRubricSets({ state: "published" }),
        ]);
        const evaluatedForms = formsData.filter((f) => f.evaluated_count > 0);
        setForms(evaluatedForms);
        if (evaluatedForms.length > 0) setSelectedFormId(evaluatedForms[0].id);

        setRubricSets(setsData);
        if (setsData.length > 0) setSelectedRubricSetId(setsData[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load forms");
      } finally {
        setIsLoadingForms(false);
      }
    };
    load();
  }, [isReady, isAuthenticated, user]);

  // Load analytics when form changes
  const loadAnalytics = useCallback(async () => {
    if (!selectedFormId) return;
    setIsLoadingAnalytics(true);
    setError(null);
    try {
      const [dist, qperf] = await Promise.all([
        getClassDistribution(selectedFormId),
        getClassQuestionPerformance(selectedFormId),
      ]);
      setDistribution(dist);
      setQuestionPerf(qperf);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [selectedFormId]);

  useEffect(() => {
    if (selectedFormId) loadAnalytics();
  }, [selectedFormId, loadAnalytics]);

  // Update question list when rubric set changes
  useEffect(() => {
    if (!selectedRubricSetId) {
      setQuestions([]);
      setSelectedQuestionId("");
      return;
    }
    // Fetch questions from rubric set detail
    import("@/api/rubrics").then(({ getRubricSet }) => {
      getRubricSet(selectedRubricSetId).then((rs) => {
        const qs = (rs.questions ?? []).map((q) => ({
          id: q.id,
          number: q.question_number,
          text: q.question_text,
        }));
        setQuestions(qs);
        if (qs.length > 0) setSelectedQuestionId(qs[0].id);
      });
    });
  }, [selectedRubricSetId]);

  // Load misconceptions when question changes
  const loadMisconceptions = useCallback(async () => {
    if (!selectedQuestionId) return;
    setIsLoadingMisconceptions(true);
    try {
      const data = await getMisconceptions(selectedQuestionId);
      setMisconceptions(data);
    } catch {
      setMisconceptions([]);
    } finally {
      setIsLoadingMisconceptions(false);
    }
  }, [selectedQuestionId]);

  useEffect(() => {
    if (selectedQuestionId) loadMisconceptions();
  }, [selectedQuestionId, loadMisconceptions]);

  const handleRecompute = async () => {
    if (!selectedQuestionId) return;
    setIsLoadingMisconceptions(true);
    try {
      const data = await recomputeMisconceptions(selectedQuestionId);
      setMisconceptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recompute failed");
    } finally {
      setIsLoadingMisconceptions(false);
    }
  };

  const handleRebuildSnapshots = async () => {
    setIsRebuilding(true);
    setRebuildMsg(null);
    try {
      const result = await rebuildSnapshots();
      setRebuildMsg(`Rebuilt ${result.rebuilt} performance snapshot(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setIsRebuilding(false);
    }
  };

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
                Smart Analytics
              </h1>
              <p className="text-sm text-primary">
                Class performance, question difficulty, and misconception intelligence
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRebuildSnapshots}
                disabled={isRebuilding}
                title="Rebuild performance snapshots for all evaluated scripts"
                className="px-3 py-2 text-xs text-secondary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Database className={`w-3.5 h-3.5 ${isRebuilding ? "animate-spin" : ""}`} />
                Rebuild Snapshots
              </button>
              <button
                onClick={loadAnalytics}
                disabled={isLoadingAnalytics || !selectedFormId}
                className="px-4 py-2 text-sm text-primary border border-secondary/50 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {rebuildMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-700">
              {rebuildMsg}
            </div>
          )}

          {/* ── Form Selector ── */}
          <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-primary-dark mb-3">
              Select Assessment
            </h3>
            {isLoadingForms ? (
              <div className="flex items-center gap-2 text-secondary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading assessments…
              </div>
            ) : forms.length === 0 ? (
              <p className="text-sm text-secondary">
                No evaluated assessments found. Evaluate some scripts first.
              </p>
            ) : (
              <div className="relative max-w-md">
                <select
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="w-full appearance-none bg-background border border-secondary/40 rounded-lg px-4 py-2.5 text-sm text-primary-dark pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} — {f.subject_name} · {f.section_name} ({f.evaluated_count} evaluated)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary pointer-events-none" />
              </div>
            )}
          </section>

          {/* ── KPI Cards ── */}
          {distribution && (
            <section>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Students Evaluated"
                  value={distribution.total_students}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  label="Class Average"
                  value={`${distribution.avg_percentage}%`}
                  icon={BarChart3}
                  color="primary"
                />
                <StatCard
                  label="Questions Analysed"
                  value={questionPerf.length}
                  icon={FileCheck}
                  color="emerald"
                />
                <StatCard
                  label="Misconception Types"
                  value={misconceptions.length}
                  icon={Brain}
                  color="purple"
                />
              </div>
            </section>
          )}

          {/* ── Score Distribution + Question Difficulty ── */}
          {isLoadingAnalytics ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Computing class analytics…</span>
              </div>
            </div>
          ) : (
            distribution && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-1">
                    Score Distribution
                  </h3>
                  <p className="text-xs text-secondary mb-4">
                    Histogram of student percentages across 10% bands
                  </p>
                  <ClassDistributionChart data={distribution} />
                </div>

                <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-primary-dark mb-1">
                    Question Difficulty
                  </h3>
                  <p className="text-xs text-secondary mb-4">
                    Average class score per question — lower bars indicate harder questions
                  </p>
                  <QuestionDifficultyChart data={questionPerf} />
                </div>
              </section>
            )
          )}

          {/* ── Question Performance Table ── */}
          {questionPerf.length > 0 && (
            <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-primary-dark mb-4">
                Per-Question Analysis
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary/20">
                      <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                        Question
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide">
                        Text
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                        Avg Marks
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                        Max Marks
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                        Avg %
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold text-secondary uppercase tracking-wide">
                        Responses
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold text-secondary uppercase tracking-wide pl-4">
                        Difficulty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary/10">
                    {questionPerf.map((q) => {
                      const difficulty =
                        q.avg_percentage < 40
                          ? { label: "Hard", color: "text-red-600 bg-red-50" }
                          : q.avg_percentage < 65
                            ? { label: "Medium", color: "text-amber-600 bg-amber-50" }
                            : { label: "Easy", color: "text-emerald-600 bg-emerald-50" };
                      return (
                        <tr key={q.question_number} className="hover:bg-gray-50">
                          <td className="py-3 font-medium text-primary-dark">
                            Q{q.question_number}
                          </td>
                          <td className="py-3 text-secondary max-w-[220px] truncate">
                            {q.question_text || "—"}
                          </td>
                          <td className="py-3 text-right text-primary-dark font-semibold">
                            {q.avg_marks}
                          </td>
                          <td className="py-3 text-right text-secondary">{q.max_marks}</td>
                          <td className="py-3 text-right font-semibold">{q.avg_percentage}%</td>
                          <td className="py-3 text-right text-secondary">{q.response_count}</td>
                          <td className="py-3 pl-4">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficulty.color}`}
                            >
                              {difficulty.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Misconception Intelligence ── */}
          <section className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-primary-dark">
                  Misconception Intelligence
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Common mistake patterns detected from evaluation data
                </p>
              </div>
              <button
                onClick={handleRecompute}
                disabled={isLoadingMisconceptions || !selectedQuestionId}
                className="px-3 py-1.5 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMisconceptions ? "animate-spin" : ""}`} />
                Re-analyse
              </button>
            </div>

            {/* Rubric Set + Question selectors */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative min-w-[220px]">
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Rubric Set
                </label>
                <select
                  value={selectedRubricSetId}
                  onChange={(e) => setSelectedRubricSetId(e.target.value)}
                  className="w-full appearance-none bg-background border border-secondary/40 rounded-lg px-3 py-2 text-sm text-primary-dark pr-8 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {rubricSets.length === 0 && (
                    <option value="">No published rubric sets</option>
                  )}
                  {rubricSets.map((rs) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.title} — {rs.subject}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-secondary pointer-events-none" />
              </div>

              <div className="relative min-w-[200px]">
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Question
                </label>
                <select
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                  disabled={!questions.length}
                  className="w-full appearance-none bg-background border border-secondary/40 rounded-lg px-3 py-2 text-sm text-primary-dark pr-8 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  {questions.length === 0 && (
                    <option value="">Select a rubric set first</option>
                  )}
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      Q{q.number}: {q.text.length > 50 ? q.text.slice(0, 50) + "…" : q.text}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-secondary pointer-events-none" />
              </div>
            </div>

            {isLoadingMisconceptions ? (
              <div className="flex items-center gap-2 text-secondary text-sm py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysing misconceptions…
              </div>
            ) : (
              <MisconceptionList
                misconceptions={misconceptions}
                totalStudents={distribution?.total_students}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
