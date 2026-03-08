"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload,
  FileText,
  AlertCircle,
  X,
  FileUp,
  Library,
  Edit3,
  Loader2,
  Plus,
  ClipboardList,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  Zap,
  ChevronLeft,
  Users,
} from "lucide-react";
import Sidebar from "@/components/shared/Sidebar";
import {
  getRubricSets,
  getScripts,
  getScript,
  getEvaluationReport,
  deleteScript,
  getSubmissionForms,
  createSubmissionForm,
  closeSubmissionForm,
  reopenSubmissionForm,
  getFormSubmissions,
  evaluateAllScripts,
  type RubricSetListItem,
  type AnswerScript,
  type EvaluationReport,
  type SubmissionForm,
  type SubmissionFormCreate,
} from "@/api/evaluation";
import { getMyTeachingAssignments, type TeachingAssignment } from "@/api/school";
import ScriptUploadForm from "@/components/evaluation/ScriptUploadForm";
import EvaluationReportView from "@/components/evaluation/EvaluationReportView";
import ScriptListItem from "@/components/evaluation/ScriptListItem";
import RubricsLibrary from "@/components/evaluation/RubricsLibrary";

type Tab = "forms" | "upload" | "scripts" | "rubrics";

export default function EvaluationPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("forms");
  const [rubricSets, setRubricSets] = useState<RubricSetListItem[]>([]);
  const [scripts, setScripts] = useState<AnswerScript[]>([]);
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission forms state
  const [submissionForms, setSubmissionForms] = useState<SubmissionForm[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formScripts, setFormScripts] = useState<AnswerScript[]>([]);
  const [loadingFormScripts, setLoadingFormScripts] = useState(false);

  // Create form state
  const [newFormAssignment, setNewFormAssignment] = useState("");
  const [newFormTitle, setNewFormTitle] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");
  const [newFormDeadline, setNewFormDeadline] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Batch evaluate state
  const [showBatchEvaluate, setShowBatchEvaluate] = useState(false);
  const [batchRubricSetId, setBatchRubricSetId] = useState("");
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

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
      const [rubricSetsData, scriptsData, formsData, assignmentsData] =
        await Promise.all([
          getRubricSets({ state: "published" }),
          getScripts(),
          getSubmissionForms(),
          getMyTeachingAssignments(),
        ]);
      setRubricSets(rubricSetsData);
      setScripts(scriptsData);
      setSubmissionForms(formsData);
      setAssignments(assignmentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "teacher") {
      loadData();
    }
  }, [isReady, isAuthenticated, user, loadData]);

  const handleScriptUpload = async () => {
    await loadData();
    setActiveTab("scripts");
  };

  const handleEvaluate = async () => {
    await loadData();
  };

  const handleViewReport = async (scriptId: string) => {
    try {
      const report = await getEvaluationReport(scriptId);
      setSelectedReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (confirm("Are you sure you want to delete this script?")) {
      try {
        await deleteScript(scriptId);
        await loadData();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to delete script",
        );
      }
    }
  };

  // ── Submission Form Handlers ────────────────────────────────────────────

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormAssignment || !newFormTitle) return;

    setIsCreating(true);
    try {
      const payload: SubmissionFormCreate = {
        assignment: newFormAssignment,
        title: newFormTitle,
        description: newFormDescription,
        deadline: newFormDeadline || undefined,
      };
      await createSubmissionForm(payload);
      setShowCreateForm(false);
      setNewFormAssignment("");
      setNewFormTitle("");
      setNewFormDescription("");
      setNewFormDeadline("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleFormStatus = async (form: SubmissionForm) => {
    try {
      if (form.status === "open") {
        await closeSubmissionForm(form.id);
      } else {
        await reopenSubmissionForm(form.id);
      }
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update form status",
      );
    }
  };

  const handleViewFormScripts = async (formId: string) => {
    setSelectedFormId(formId);
    setLoadingFormScripts(true);
    setBatchResult(null);
    try {
      const scripts = await getFormSubmissions(formId);
      setFormScripts(scripts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load submissions",
      );
    } finally {
      setLoadingFormScripts(false);
    }
  };

  const handleBatchEvaluate = async () => {
    if (!selectedFormId || !batchRubricSetId) return;

    setIsBatchEvaluating(true);
    setBatchResult(null);
    try {
      const result = await evaluateAllScripts(selectedFormId, batchRubricSetId);
      setBatchResult(result);
      // Reload form scripts
      const scripts = await getFormSubmissions(selectedFormId);
      setFormScripts(scripts);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Batch evaluation failed",
      );
    } finally {
      setIsBatchEvaluating(false);
      setShowBatchEvaluate(false);
    }
  };

  const selectedForm = submissionForms.find((f) => f.id === selectedFormId);

  const tabs = [
    { id: "forms" as Tab, label: "Submission Forms", icon: ClipboardList },
    { id: "upload" as Tab, label: "Upload Script", icon: Upload },
    { id: "scripts" as Tab, label: "All Scripts", icon: FileText },
    { id: "rubrics" as Tab, label: "Rubrics Library", icon: Library },
  ];

  if (selectedReport) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar role="teacher" />
        <div className="ml-60 py-8 px-8">
          <EvaluationReportView
            report={selectedReport}
            onBack={() => setSelectedReport(null)}
          />
        </div>
      </div>
    );
  }

  if (!isReady || !isAuthenticated || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="teacher" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                Script Evaluation
              </h1>
              <p className="text-sm text-secondary">
                Manage submission forms and evaluate answer scripts
              </p>
            </div>
            <Link
              href="/rubrics"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Rubrics
            </Link>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-secondary/30">
          <div className="px-8">
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedFormId(null);
                    }}
                    className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-primary text-primary-dark"
                        : "border-transparent text-secondary hover:text-primary-dark"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 px-8 py-6">
          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="flex-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Batch result banner */}
          {batchResult && (
            <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="flex-1 text-sm text-emerald-700">
                {batchResult.success}/{batchResult.total} scripts evaluated
                {batchResult.failed > 0 &&
                  ` (${batchResult.failed} failed)`}
              </p>
              <button
                onClick={() => setBatchResult(null)}
                className="text-emerald-400 hover:text-emerald-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* ─── Submission Forms (list) ──────────────────────── */}
              {activeTab === "forms" && !selectedFormId && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-primary-dark">
                      Submission Forms
                      <span className="ml-2 text-sm font-normal text-secondary">
                        {submissionForms.length}
                      </span>
                    </h2>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New Form
                    </button>
                  </div>

                  {/* Create form modal */}
                  {showCreateForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 mx-4">
                        <h3 className="text-base font-semibold text-primary-dark mb-4">
                          New Submission Form
                        </h3>
                        <form onSubmit={handleCreateForm} className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              Teaching Assignment *
                            </label>
                            <select
                              value={newFormAssignment}
                              onChange={(e) =>
                                setNewFormAssignment(e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                              required
                            >
                              <option value="">
                                Select subject + section...
                              </option>
                              {assignments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.subject_name} — Class {a.class_name}
                                  {a.stream ? ` (${a.stream})` : ""} Section{" "}
                                  {a.section_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              Title *
                            </label>
                            <input
                              type="text"
                              value={newFormTitle}
                              onChange={(e) => setNewFormTitle(e.target.value)}
                              placeholder="e.g. Mid-term ICT Exam"
                              className="w-full px-3 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              Description
                            </label>
                            <textarea
                              value={newFormDescription}
                              onChange={(e) =>
                                setNewFormDescription(e.target.value)
                              }
                              rows={2}
                              placeholder="Optional..."
                              className="w-full px-3 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-secondary mb-1">
                              Deadline
                            </label>
                            <input
                              type="datetime-local"
                              value={newFormDeadline}
                              onChange={(e) =>
                                setNewFormDeadline(e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-secondary/40 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                            />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowCreateForm(false)}
                              className="px-4 py-2 text-sm text-secondary hover:text-primary-dark transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isCreating}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                            >
                              {isCreating && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              Create
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {submissionForms.length === 0 ? (
                    <div className="bg-white border border-secondary/30 rounded-xl py-16 text-center">
                      <ClipboardList className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
                      <p className="text-sm text-secondary mb-4">
                        {assignments.length === 0
                          ? "No teaching assignments found. Contact an administrator."
                          : "Create a form to let students submit scripts."}
                      </p>
                      {assignments.length > 0 && (
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Create Form
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submissionForms.map((form) => (
                        <div
                          key={form.id}
                          className="bg-white border border-secondary/30 rounded-xl p-5 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-primary-dark">
                                  {form.title}
                                </h3>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    form.status === "open"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {form.status === "open" ? "Open" : "Closed"}
                                </span>
                              </div>
                              <p className="text-xs text-secondary mt-0.5">
                                {form.subject_name} &middot; Class{" "}
                                {form.class_name} Section {form.section_name}
                              </p>
                            </div>
                          </div>

                          {form.description && (
                            <p className="text-xs text-secondary mb-3">
                              {form.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs text-secondary mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {form.submission_count} submitted
                            </span>
                            <span>
                              {form.pending_count} pending
                            </span>
                            <span>
                              {form.evaluated_count} evaluated
                            </span>
                            {form.deadline && (
                              <span className="text-amber-600">
                                Due{" "}
                                {new Date(form.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-3 border-t border-secondary/20">
                            <button
                              onClick={() => handleViewFormScripts(form.id)}
                              className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                            >
                              View Scripts
                            </button>
                            <span className="text-secondary/30">|</span>
                            <button
                              onClick={() => handleToggleFormStatus(form)}
                              className={`text-xs font-medium flex items-center gap-1 transition-colors ${
                                form.status === "open"
                                  ? "text-amber-600 hover:text-amber-700"
                                  : "text-emerald-600 hover:text-emerald-700"
                              }`}
                            >
                              {form.status === "open" ? (
                                <>
                                  <Lock className="w-3 h-3" /> Close
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" /> Reopen
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Form Scripts Detail ─────────────────────────── */}
              {activeTab === "forms" && selectedFormId && selectedForm && (
                <div>
                  <button
                    onClick={() => {
                      setSelectedFormId(null);
                      setFormScripts([]);
                    }}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark mb-4"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-semibold text-primary-dark">
                        {selectedForm.title}
                      </h2>
                      <p className="text-xs text-secondary mt-0.5">
                        {selectedForm.subject_name} &middot; Class{" "}
                        {selectedForm.class_name} Section{" "}
                        {selectedForm.section_name} &middot;{" "}
                        {selectedForm.submission_count} scripts
                      </p>
                    </div>
                    {formScripts.some((s) => s.status === "pending") && (
                      <button
                        onClick={() => setShowBatchEvaluate(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Evaluate All
                      </button>
                    )}
                  </div>

                  {/* Batch evaluate modal */}
                  {showBatchEvaluate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 mx-4">
                        <h3 className="text-base font-semibold text-primary-dark mb-3">
                          Batch Evaluate
                        </h3>
                        <p className="text-sm text-secondary mb-4">
                          Select a rubric set for{" "}
                          {
                            formScripts.filter((s) => s.status === "pending")
                              .length
                          }{" "}
                          pending scripts.
                        </p>
                        <select
                          value={batchRubricSetId}
                          onChange={(e) => setBatchRubricSetId(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-secondary/40 rounded-lg mb-4 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        >
                          <option value="">Select rubric set...</option>
                          {rubricSets.map((rs) => (
                            <option key={rs.id} value={rs.id}>
                              {rs.title} — {rs.subject} ({rs.total_marks} marks)
                            </option>
                          ))}
                        </select>
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setShowBatchEvaluate(false)}
                            className="px-4 py-2 text-sm text-secondary hover:text-primary-dark transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleBatchEvaluate}
                            disabled={!batchRubricSetId || isBatchEvaluating}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {isBatchEvaluating && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            Evaluate All
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loadingFormScripts ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : formScripts.length === 0 ? (
                    <div className="bg-white border border-secondary/30 rounded-xl py-16 text-center">
                      <FileText className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
                      <p className="text-sm text-secondary">
                        No scripts submitted yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formScripts.map((script) => {
                        const statusStyle: Record<string, string> = {
                          pending: "bg-amber-50 text-amber-700",
                          processing: "bg-blue-50 text-blue-700",
                          evaluated: "bg-emerald-50 text-emerald-700",
                          error: "bg-red-50 text-red-700",
                        };

                        return (
                          <div
                            key={script.id}
                            className="bg-white border border-secondary/30 rounded-xl p-5 hover:border-primary/40 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-primary-dark truncate">
                                  {script.student_full_name ||
                                    script.student_name ||
                                    "Unknown Student"}
                                </h3>
                                {script.student_roll_number && (
                                  <p className="text-xs text-secondary mt-0.5">
                                    Roll: {script.student_roll_number}
                                    {script.student_class &&
                                      ` · Class ${script.student_class}`}
                                    {script.student_section &&
                                      ` Section ${script.student_section}`}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`shrink-0 ml-3 px-2 py-0.5 rounded text-xs font-medium ${
                                  statusStyle[script.status] ||
                                  statusStyle.pending
                                }`}
                              >
                                {script.status.charAt(0).toUpperCase() +
                                  script.status.slice(1)}
                              </span>
                            </div>

                            <p className="text-xs text-secondary mb-3">
                              {script.page_count || 0} pages &middot;{" "}
                              {new Date(
                                script.created_at
                              ).toLocaleDateString()}
                            </p>

                            {script.status === "evaluated" &&
                              script.total_score != null && (
                                <div className="flex items-baseline justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 mb-3">
                                  <span className="text-secondary">Score</span>
                                  <span className="font-semibold text-primary-dark">
                                    {typeof script.total_score === "number"
                                      ? script.total_score.toFixed(1)
                                      : script.total_score}{" "}
                                    <span className="text-secondary font-normal">
                                      (
                                      {typeof script.percentage === "number"
                                        ? script.percentage.toFixed(0)
                                        : script.percentage}
                                      %)
                                    </span>
                                  </span>
                                </div>
                              )}

                            <div className="flex items-center gap-2 pt-3 border-t border-secondary/20">
                              {script.status === "evaluated" && (
                                <button
                                  onClick={() => handleViewReport(script.id)}
                                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                                >
                                  View Report
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteScript(script.id)}
                                className="ml-auto text-xs text-secondary hover:text-red-500 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Upload Tab ───────────────────────────────────── */}
              {activeTab === "upload" && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white border border-secondary/30 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-primary-dark mb-5">
                      Upload Answer Script
                    </h2>
                    {rubricSets.length === 0 ? (
                      <div className="text-center py-12">
                        <FileUp className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
                        <p className="text-sm text-secondary mb-4">
                          No published rubric sets available.
                        </p>
                        <Link
                          href="/rubrics"
                          className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors inline-block"
                        >
                          Create Rubric Set
                        </Link>
                      </div>
                    ) : (
                      <ScriptUploadForm
                        rubricSets={rubricSets}
                        onUploadComplete={handleScriptUpload}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ─── Scripts Tab ──────────────────────────────────── */}
              {activeTab === "scripts" && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-primary-dark">
                      All Scripts
                      <span className="ml-2 text-sm font-normal text-secondary">
                        {scripts.length}
                      </span>
                    </h2>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Upload
                    </button>
                  </div>

                  {scripts.length === 0 ? (
                    <div className="bg-white border border-secondary/30 rounded-xl py-16 text-center">
                      <FileText className="w-10 h-10 mx-auto text-secondary/50 mb-3" />
                      <p className="text-sm text-secondary mb-4">
                        No scripts uploaded yet.
                      </p>
                      <button
                        onClick={() => setActiveTab("upload")}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        Upload Script
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {scripts.map((script) => (
                        <ScriptListItem
                          key={script.id}
                          script={script}
                          onEvaluate={handleEvaluate}
                          onViewReport={handleViewReport}
                          onDelete={handleDeleteScript}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Rubrics Tab ──────────────────────────────────── */}
              {activeTab === "rubrics" && (
                <div>
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold text-primary-dark">
                      Rubrics Library
                    </h2>
                    <p className="text-xs text-secondary mt-0.5">
                      View published rubric sets.{" "}
                      <Link
                        href="/rubrics"
                        className="text-primary hover:text-primary-dark"
                      >
                        Manage rubrics &rarr;
                      </Link>
                    </p>
                  </div>
                  <RubricsLibrary />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
