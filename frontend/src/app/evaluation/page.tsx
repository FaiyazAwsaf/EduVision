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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
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
              <p className="text-sm text-primary">
                Manage submission forms and evaluate handwritten answer scripts
              </p>
            </div>
            <Link
              href="/rubrics"
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" /> Rubrics
            </Link>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-secondary/30">
          <div className="px-8">
            <nav className="flex space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSelectedFormId(null);
                    }}
                    className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? "border-primary text-primary-dark"
                        : "border-transparent text-secondary hover:text-primary hover:border-secondary"
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

        {/* Main Content */}
        <main className="flex-1 px-8 py-8">
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Batch evaluation result */}
          {batchResult && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-emerald-700 font-medium">
                  Batch evaluation complete
                </p>
                <p className="text-sm text-emerald-600">
                  {batchResult.success} of {batchResult.total} scripts evaluated
                  successfully
                  {batchResult.failed > 0 &&
                    ` (${batchResult.failed} failed)`}
                </p>
              </div>
              <button
                onClick={() => setBatchResult(null)}
                className="text-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          ) : (
            <>
              {/* ─── Submission Forms Tab ─────────────────────────────── */}
              {activeTab === "forms" && !selectedFormId && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-primary-dark">
                      Submission Forms ({submissionForms.length})
                    </h2>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Form
                    </button>
                  </div>

                  {/* Create form modal */}
                  {showCreateForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 mx-4">
                        <h3 className="text-lg font-semibold text-primary-dark mb-4">
                          Create Submission Form
                        </h3>
                        <form onSubmit={handleCreateForm} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Teaching Assignment *
                            </label>
                            <select
                              value={newFormAssignment}
                              onChange={(e) =>
                                setNewFormAssignment(e.target.value)
                              }
                              className="w-full px-3 py-2 border border-secondary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Title *
                            </label>
                            <input
                              type="text"
                              value={newFormTitle}
                              onChange={(e) => setNewFormTitle(e.target.value)}
                              placeholder="e.g. Mid-term ICT Exam"
                              className="w-full px-3 py-2 border border-secondary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Description
                            </label>
                            <textarea
                              value={newFormDescription}
                              onChange={(e) =>
                                setNewFormDescription(e.target.value)
                              }
                              rows={2}
                              placeholder="Optional description..."
                              className="w-full px-3 py-2 border border-secondary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-secondary mb-1">
                              Deadline
                            </label>
                            <input
                              type="datetime-local"
                              value={newFormDeadline}
                              onChange={(e) =>
                                setNewFormDeadline(e.target.value)
                              }
                              className="w-full px-3 py-2 border border-secondary/50 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                          </div>

                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowCreateForm(false)}
                              className="px-4 py-2 border border-secondary/50 rounded-lg text-secondary hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isCreating}
                              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              {isCreating && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              )}
                              Create
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {submissionForms.length === 0 ? (
                    <div className="bg-white rounded-xl border border-secondary p-12 text-center">
                      <ClipboardList className="w-12 h-12 mx-auto text-secondary mb-4" />
                      <h3 className="text-lg font-medium text-primary-dark mb-2">
                        No submission forms yet
                      </h3>
                      <p className="text-primary text-sm mb-4">
                        {assignments.length === 0
                          ? "You have no teaching assignments. Contact an administrator to get assigned."
                          : "Create a submission form to let students submit their scripts."}
                      </p>
                      {assignments.length > 0 && (
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                          Create Form
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {submissionForms.map((form) => (
                        <div
                          key={form.id}
                          className="bg-white rounded-xl border-2 border-secondary p-5 shadow-md hover:shadow-lg hover:border-primary transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-primary-dark">
                                {form.title}
                              </h3>
                              <p className="text-sm text-primary mt-1">
                                {form.subject_name} — Class {form.class_name}{" "}
                                Section {form.section_name}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                form.status === "open"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {form.status === "open" ? "Open" : "Closed"}
                            </span>
                          </div>

                          {form.description && (
                            <p className="text-sm text-secondary mb-3">
                              {form.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-3 text-sm text-secondary mb-4">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {form.submission_count} submissions
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {form.pending_count} pending
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {form.evaluated_count} evaluated
                            </span>
                            {form.deadline && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Clock className="w-3.5 h-3.5" />
                                Due:{" "}
                                {new Date(form.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-3 border-t border-secondary/30">
                            <button
                              onClick={() => handleViewFormScripts(form.id)}
                              className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              View Scripts
                            </button>
                            <button
                              onClick={() => handleToggleFormStatus(form)}
                              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors ${
                                form.status === "open"
                                  ? "text-amber-600 hover:bg-amber-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              }`}
                            >
                              {form.status === "open" ? (
                                <>
                                  <Lock className="w-3.5 h-3.5" /> Close
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3.5 h-3.5" /> Reopen
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

              {/* ─── Form Scripts Detail View ────────────────────────── */}
              {activeTab === "forms" && selectedFormId && selectedForm && (
                <div>
                  <button
                    onClick={() => {
                      setSelectedFormId(null);
                      setFormScripts([]);
                    }}
                    className="flex items-center gap-2 text-primary hover:text-primary-dark mb-4 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Forms
                  </button>

                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-primary-dark">
                        {selectedForm.title}
                      </h2>
                      <p className="text-sm text-primary">
                        {selectedForm.subject_name} — Class{" "}
                        {selectedForm.class_name} Section{" "}
                        {selectedForm.section_name} •{" "}
                        {selectedForm.submission_count} scripts
                      </p>
                    </div>
                    {formScripts.some((s) => s.status === "pending") && (
                      <button
                        onClick={() => setShowBatchEvaluate(true)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Evaluate All
                      </button>
                    )}
                  </div>

                  {/* Batch evaluate modal */}
                  {showBatchEvaluate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
                        <h3 className="text-lg font-semibold text-primary-dark mb-4">
                          Batch Evaluate Scripts
                        </h3>
                        <p className="text-sm text-primary mb-4">
                          Select a rubric set to evaluate all{" "}
                          {formScripts.filter((s) => s.status === "pending").length}{" "}
                          pending scripts.
                        </p>
                        <select
                          value={batchRubricSetId}
                          onChange={(e) => setBatchRubricSetId(e.target.value)}
                          className="w-full px-3 py-2 border border-secondary/50 rounded-lg mb-4 focus:ring-2 focus:ring-primary focus:border-transparent"
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
                            className="px-4 py-2 border border-secondary/50 rounded-lg text-secondary hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleBatchEvaluate}
                            disabled={!batchRubricSetId || isBatchEvaluating}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                          >
                            {isBatchEvaluating && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            Evaluate All
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loadingFormScripts ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : formScripts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-secondary p-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-secondary mb-4" />
                      <h3 className="text-lg font-medium text-primary-dark mb-2">
                        No scripts submitted yet
                      </h3>
                      <p className="text-primary text-sm">
                        Students can submit scripts while the form is open.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {formScripts.map((script) => (
                        <div
                          key={script.id}
                          className="bg-white rounded-xl border-2 border-secondary p-5 shadow-md hover:shadow-lg transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-base font-semibold text-primary-dark">
                                {script.student_full_name ||
                                  script.student_name ||
                                  "Unknown Student"}
                              </h3>
                              {script.student_roll_number && (
                                <p className="text-xs text-secondary">
                                  Roll: {script.student_roll_number}
                                  {script.student_class &&
                                    ` • Class ${script.student_class}`}
                                  {script.student_section &&
                                    ` Section ${script.student_section}`}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                script.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : script.status === "evaluated"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : script.status === "processing"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-red-100 text-red-700"
                              }`}
                            >
                              {script.status.charAt(0).toUpperCase() +
                                script.status.slice(1)}
                            </span>
                          </div>

                          <div className="text-xs text-secondary mb-2">
                            {script.page_count || 0} pages •{" "}
                            {new Date(script.created_at).toLocaleDateString()}
                          </div>

                          {script.status === "evaluated" &&
                            script.total_score != null && (
                              <div className="mb-3 p-2 bg-background rounded-lg border border-secondary/50">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-primary-dark font-medium">
                                    Score
                                  </span>
                                  <span className="font-bold text-emerald-600">
                                    {typeof script.total_score === "number"
                                      ? script.total_score.toFixed(2)
                                      : script.total_score}{" "}
                                    (
                                    {typeof script.percentage === "number"
                                      ? script.percentage.toFixed(2)
                                      : script.percentage}
                                    %)
                                  </span>
                                </div>
                              </div>
                            )}

                          <div className="flex items-center gap-2 pt-2 border-t border-secondary/30">
                            {script.status === "evaluated" && (
                              <button
                                onClick={() => handleViewReport(script.id)}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                              >
                                View Report
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteScript(script.id)}
                              className="px-3 py-1.5 text-red-400 text-xs rounded-lg hover:bg-red-50 transition-colors ml-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Upload Tab ────────────────────────────────────── */}
              {activeTab === "upload" && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white rounded-xl border border-secondary p-6">
                    <h2 className="text-xl font-semibold text-primary-dark mb-6">
                      Upload Answer Script
                    </h2>
                    {rubricSets.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-secondary rounded-xl">
                        <FileUp className="w-12 h-12 mx-auto text-secondary mb-4" />
                        <p className="text-primary mb-4">
                          No published rubric sets available. Create one first.
                        </p>
                        <Link
                          href="/rubrics"
                          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block"
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

              {/* ─── Scripts Tab ───────────────────────────────────── */}
              {activeTab === "scripts" && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-primary-dark">
                      Answer Scripts ({scripts.length})
                    </h2>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Upload New
                    </button>
                  </div>

                  {scripts.length === 0 ? (
                    <div className="bg-white rounded-xl border border-secondary p-12 text-center">
                      <FileText className="w-12 h-12 mx-auto text-secondary mb-4" />
                      <h3 className="text-lg font-medium text-primary-dark mb-2">
                        No scripts uploaded yet
                      </h3>
                      <p className="text-primary text-sm mb-4">
                        Upload your first answer script to start evaluating
                      </p>
                      <button
                        onClick={() => setActiveTab("upload")}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        Upload Script
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* ─── Rubrics Tab ───────────────────────────────────── */}
              {activeTab === "rubrics" && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-primary-dark mb-2">
                      Rubrics Library
                    </h2>
                    <p className="text-sm text-primary">
                      View published rubric sets. Create new rubrics in the{" "}
                      <Link
                        href="/rubrics"
                        className="text-primary-dark hover:underline font-medium"
                      >
                        Rubrics page
                      </Link>
                      .
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
