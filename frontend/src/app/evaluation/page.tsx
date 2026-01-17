"use client";

import React, { useState, useEffect, useCallback } from "react";
import evaluationAPI, {
  QuestionPaper,
  AnswerScript,
  EvaluationReport,
} from "@/lib/api/evaluation";
import ScriptUploadForm from "@/components/evaluation/ScriptUploadForm";
import EvaluationReportView from "@/components/evaluation/EvaluationReportView";
import QuestionPaperForm from "@/components/evaluation/QuestionPaperForm";
import PDFUploadForm from "@/components/evaluation/PDFUploadForm";
import ScriptListItem from "@/components/evaluation/ScriptListItem";

type Tab = "upload" | "scripts" | "papers" | "new-paper";
type PaperCreationMode = "manual" | "pdf";

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [paperCreationMode, setPaperCreationMode] = useState<PaperCreationMode>("pdf");
  const [questionPapers, setQuestionPapers] = useState<QuestionPaper[]>([]);
  const [scripts, setScripts] = useState<AnswerScript[]>([]);
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [papersData, scriptsData] = await Promise.all([
        evaluationAPI.getQuestionPapers(),
        evaluationAPI.getScripts(),
      ]);
      setQuestionPapers(papersData);
      setScripts(scriptsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScriptUpload = async (scriptId: string) => {
    await loadData();
    setActiveTab("scripts");
  };

  const handleEvaluate = async (scriptId: string) => {
    await loadData();
  };

  const handleViewReport = async (scriptId: string) => {
    try {
      const report = await evaluationAPI.getEvaluationReport(scriptId);
      setSelectedReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (confirm("Are you sure you want to delete this script?")) {
      try {
        await evaluationAPI.deleteScript(scriptId);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete script");
      }
    }
  };

  const handleQuestionPaperCreated = async (paper: QuestionPaper) => {
    await loadData();
    setActiveTab("papers");
  };

  if (selectedReport) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <EvaluationReportView
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Script Evaluation
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Evaluate handwritten answer scripts using AI-powered grading
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: "upload" as Tab, label: "Upload Script", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
              { id: "scripts" as Tab, label: "All Scripts", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { id: "papers" as Tab, label: "Question Papers", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              { id: "new-paper" as Tab, label: "New Paper", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-800 dark:text-red-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading...
            </div>
          </div>
        ) : (
          <>
            {/* Upload Tab */}
            {activeTab === "upload" && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                    Upload Answer Script
                  </h2>
                  {questionPapers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        No question papers available. Create one first.
                      </p>
                      <button
                        onClick={() => setActiveTab("new-paper")}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Create Question Paper
                      </button>
                    </div>
                  ) : (
                    <ScriptUploadForm
                      questionPapers={questionPapers}
                      onUploadComplete={handleScriptUpload}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Scripts Tab */}
            {activeTab === "scripts" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Answer Scripts ({scripts.length})
                  </h2>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Upload New
                  </button>
                </div>

                {scripts.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No scripts uploaded yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Upload your first answer script to start evaluating
                    </p>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

            {/* Question Papers Tab */}
            {activeTab === "papers" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Question Papers ({questionPapers.length})
                  </h2>
                  <button
                    onClick={() => setActiveTab("new-paper")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New
                  </button>
                </div>

                {questionPapers.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No question papers yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Create your first question paper to start evaluating scripts
                    </p>
                    <button
                      onClick={() => setActiveTab("new-paper")}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create Question Paper
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questionPapers.map((paper) => (
                      <div
                        key={paper.id}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {paper.title}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <p>Subject: {paper.subject}</p>
                          <p>Class: {paper.class_level}</p>
                          <p>Questions: {paper.question_count || paper.questions?.length || 0}</p>
                          <p>Total Marks: {paper.total_marks}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Created: {new Date(paper.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* New Paper Tab */}
            {activeTab === "new-paper" && (
              <div className="max-w-4xl mx-auto">
                {/* Mode Selector */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    How would you like to create the question paper?
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaperCreationMode("pdf")}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        paperCreationMode === "pdf"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-lg ${
                          paperCreationMode === "pdf"
                            ? "bg-blue-100 dark:bg-blue-800"
                            : "bg-gray-100 dark:bg-gray-700"
                        }`}>
                          <svg
                            className={`w-6 h-6 ${
                              paperCreationMode === "pdf"
                                ? "text-blue-600 dark:text-blue-300"
                                : "text-gray-500"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        </div>
                        <h3 className={`font-semibold ${
                          paperCreationMode === "pdf"
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-900 dark:text-white"
                        }`}>
                          Upload PDF
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Upload a PDF file containing questions and marking scheme. AI will automatically extract the questions, marks, and rubrics.
                      </p>
                      <div className="mt-3 flex items-center text-xs text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Recommended - Fastest method
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperCreationMode("manual")}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        paperCreationMode === "manual"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-lg ${
                          paperCreationMode === "manual"
                            ? "bg-blue-100 dark:bg-blue-800"
                            : "bg-gray-100 dark:bg-gray-700"
                        }`}>
                          <svg
                            className={`w-6 h-6 ${
                              paperCreationMode === "manual"
                                ? "text-blue-600 dark:text-blue-300"
                                : "text-gray-500"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </div>
                        <h3 className={`font-semibold ${
                          paperCreationMode === "manual"
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-900 dark:text-white"
                        }`}>
                          Manual Entry
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manually enter each question, marks, model answers, and detailed rubrics one by one.
                      </p>
                      <div className="mt-3 flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        More control, takes longer
                      </div>
                    </button>
                  </div>
                </div>

                {/* Form based on mode */}
                {paperCreationMode === "pdf" ? (
                  <PDFUploadForm
                    onSuccess={handleQuestionPaperCreated}
                    onCancel={() => setActiveTab("papers")}
                  />
                ) : (
                  <QuestionPaperForm
                    onSuccess={handleQuestionPaperCreated}
                    onCancel={() => setActiveTab("papers")}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
