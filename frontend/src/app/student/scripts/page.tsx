"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  getStudentOpenForms,
  getMyScripts,
  getScript,
  submitStudentScript,
  getEvaluationReport,
  type SubmissionForm,
  type AnswerScript,
  type EvaluationReport,
  type ScriptPage,
} from "@/api/evaluation";
import EvaluationReportView from "@/components/evaluation/EvaluationReportView";
import {
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ClipboardList,
  ChevronLeft,
  FileDown,
} from "lucide-react";

export default function StudentScriptsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [openForms, setOpenForms] = useState<SubmissionForm[]>([]);
  const [myScripts, setMyScripts] = useState<AnswerScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission state
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [submitPreviews, setSubmitPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report view state
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(
    null,
  );
  const [selectedScriptPages, setSelectedScriptPages] = useState<ScriptPage[]>([]);

  // Auth guard
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
      const [forms, scripts] = await Promise.all([
        getStudentOpenForms(),
        getMyScripts(),
      ]);
      setOpenForms(forms);
      setMyScripts(scripts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      loadData();
    }
  }, [isReady, isAuthenticated, user, loadData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).slice(0, 10);
    setSubmitFiles(newFiles);

    // Generate previews
    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setSubmitPreviews(previews);
  };

  const removeFile = (index: number) => {
    const newFiles = [...submitFiles];
    newFiles.splice(index, 1);
    setSubmitFiles(newFiles);

    const newPreviews = [...submitPreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setSubmitPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (!selectedFormId || submitFiles.length === 0) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await submitStudentScript(selectedFormId, submitFiles);
      setSubmitSuccess(true);
      setSubmitFiles([]);
      setSubmitPreviews([]);
      setSelectedFormId(null);
      await loadData();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit script",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewReport = async (scriptId: string) => {
    try {
      const [report, script] = await Promise.all([
        getEvaluationReport(scriptId),
        getScript(scriptId),
      ]);
      setSelectedScriptPages(script.pages || []);
      setSelectedReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  };

  const handleViewAsPdf = async (scriptId: string) => {
    try {
      const [report, script] = await Promise.all([
        getEvaluationReport(scriptId),
        getScript(scriptId),
      ]);
      setSelectedScriptPages(script.pages || []);
      setSelectedReport(report);
      setTimeout(() => window.print(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  };

  // Show report view
  if (selectedReport) {
    return (
      <div className="bg-background h-screen overflow-hidden flex">
        <div className="print:hidden">
          <Sidebar role="student" />
        </div>
        <div className="flex-1 ml-60 overflow-hidden print:ml-0">
          <EvaluationReportView
            report={selectedReport}
            pages={selectedScriptPages}
            onBack={() => {
              setSelectedReport(null);
              setSelectedScriptPages([]);
            }}
          />
        </div>
      </div>
    );
  }

  if (!isReady || !isAuthenticated || !user || user.role !== "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  const selectedForm = openForms.find((f) => f.id === selectedFormId);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="student" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="px-8 py-4">
            <h1 className="text-2xl font-bold text-primary-dark">
              My Scripts
            </h1>
            <p className="text-sm text-primary">
              Submit answer scripts and view your evaluation results
            </p>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {/* Error */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Success */}
          {submitSuccess && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 font-medium">
                Script submitted successfully!
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* ─── Submission Form View ──────────────────────────── */}
              {selectedFormId && selectedForm ? (
                <div>
                  <button
                    onClick={() => {
                      setSelectedFormId(null);
                      setSubmitFiles([]);
                      setSubmitPreviews([]);
                    }}
                    className="flex items-center gap-2 text-primary hover:text-primary-dark mb-4 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="bg-white rounded-xl border border-secondary p-6 max-w-2xl">
                    <h2 className="text-xl font-semibold text-primary-dark mb-1">
                      {selectedForm.title}
                    </h2>
                    <p className="text-sm text-primary mb-1">
                      {selectedForm.subject_name} — {selectedForm.teacher_name}
                    </p>
                    <p className="text-sm text-secondary mb-1">
                      Class {selectedForm.class_name} Section{" "}
                      {selectedForm.section_name}
                    </p>
                    {selectedForm.description && (
                      <p className="text-sm text-secondary mb-3">
                        {selectedForm.description}
                      </p>
                    )}
                    {selectedForm.deadline && (
                      <p className="text-xs text-amber-600 mb-4 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Deadline:{" "}
                        {new Date(selectedForm.deadline).toLocaleString()}
                      </p>
                    )}

                    <div className="border-t border-secondary/30 pt-4">
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Upload Script Pages (max 10)
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-secondary rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Upload className="w-8 h-8 mx-auto text-secondary mb-2" />
                        <p className="text-sm text-primary">
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          PNG, JPG, WEBP up to 10MB each
                        </p>
                      </div>

                      {/* Previews */}
                      {submitPreviews.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                          {submitPreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Page ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-secondary"
                              />
                              <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                {index + 1}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end mt-4">
                        <button
                          onClick={handleSubmit}
                          disabled={
                            isSubmitting || submitFiles.length === 0
                          }
                          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              Submit Script
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* ─── Open Forms Section ────────────────────────── */}
                  <section className="mb-10">
                    <h2 className="text-lg font-semibold text-primary-dark mb-4">
                      Open Submission Forms
                    </h2>
                    {openForms.length === 0 ? (
                      <div className="bg-white rounded-xl border border-secondary p-8 text-center">
                        <ClipboardList className="w-10 h-10 mx-auto text-secondary mb-3" />
                        <p className="text-primary text-sm">
                          No open submission forms right now. Check back later.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openForms.map((form) => (
                          <div
                            key={form.id}
                            className="bg-white rounded-xl border-2 border-secondary p-5 shadow-md hover:shadow-lg hover:border-primary transition-all cursor-pointer"
                            onClick={() => setSelectedFormId(form.id)}
                          >
                            <h3 className="text-base font-semibold text-primary-dark mb-1">
                              {form.title}
                            </h3>
                            <p className="text-sm text-primary">
                              {form.subject_name}
                            </p>
                            <p className="text-xs text-secondary mt-1">
                              {form.teacher_name} • Class {form.class_name}{" "}
                              Section {form.section_name}
                            </p>
                            {form.deadline && (
                              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due:{" "}
                                {new Date(
                                  form.deadline,
                                ).toLocaleDateString()}
                              </p>
                            )}
                            <div className="mt-3 pt-3 border-t border-secondary/30">
                              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                Click to Submit
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ─── My Submissions Section ───────────────────── */}
                  <section>
                    <h2 className="text-lg font-semibold text-primary-dark mb-4">
                      My Submissions ({myScripts.length})
                    </h2>
                    {myScripts.length === 0 ? (
                      <div className="bg-white rounded-xl border border-secondary p-8 text-center">
                        <FileText className="w-10 h-10 mx-auto text-secondary mb-3" />
                        <p className="text-primary text-sm">
                          You haven&apos;t submitted any scripts yet.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myScripts.map((script) => (
                          <div
                            key={script.id}
                            className="bg-white rounded-xl border-2 border-secondary p-5 shadow-md"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-base font-semibold text-primary-dark">
                                  {script.submission_form_title ||
                                    script.rubric_set_title ||
                                    "Script"}
                                </h3>
                                <p className="text-xs text-secondary">
                                  {script.page_count || 0} pages •{" "}
                                  {new Date(
                                    script.created_at,
                                  ).toLocaleDateString()}
                                </p>
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

                            {script.status === "evaluated" && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => handleViewReport(script.id)}
                                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                  View Report
                                </button>
                                <button
                                  onClick={() => handleViewAsPdf(script.id)}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                  <FileDown className="w-3 h-3" />
                                  View as PDF
                                </button>
                              </div>
                            )}

                            {script.status === "pending" && (
                              <p className="text-xs text-secondary italic">
                                Waiting for evaluation by teacher...
                              </p>
                            )}

                            {script.status === "processing" && (
                              <p className="text-xs text-blue-600 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Evaluation in progress...
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
