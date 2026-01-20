"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Home,
  Upload,
  FileText,
  ClipboardList,
  Plus,
  Loader2,
  AlertCircle,
  X,
  FileUp,
  Edit3,
  Clock,
  CheckCircle,
  Library,
} from "lucide-react";
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
import RubricsLibrary from "@/components/evaluation/RubricsLibrary";

type Tab = "upload" | "scripts" | "papers" | "rubrics" | "new-paper";
type PaperCreationMode = "manual" | "pdf";

export default function EvaluationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [paperCreationMode, setPaperCreationMode] =
    useState<PaperCreationMode>("pdf");
  const [questionPapers, setQuestionPapers] = useState<QuestionPaper[]>([]);
  const [scripts, setScripts] = useState<AnswerScript[]>([]);
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(
    null,
  );
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
        setError(
          err instanceof Error ? err.message : "Failed to delete script",
        );
      }
    }
  };

  const handleQuestionPaperCreated = async (paper: QuestionPaper) => {
    await loadData();
    setActiveTab("papers");
  };

  if (selectedReport) {
    return (
      <div className="min-h-screen bg-[#F2EFE7] py-8 px-4">
        <EvaluationReportView
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
        />
      </div>
    );
  }

  const tabs = [
    { id: "upload" as Tab, label: "Upload Script", icon: Upload },
    { id: "scripts" as Tab, label: "All Scripts", icon: FileText },
    { id: "papers" as Tab, label: "Question Papers", icon: ClipboardList },
    { id: "rubrics" as Tab, label: "Rubrics", icon: Library },
    { id: "new-paper" as Tab, label: "New Paper", icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-[#F2EFE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[#006A71]">
                Script Evaluation
              </h1>
              <p className="mt-1 text-sm text-[#48A6A7]">
                Evaluate handwritten answer scripts using AI-powered grading
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-[#48A6A7] hover:text-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </Link>
              <Link
                href="/rubrics"
                className="bg-[#48A6A7] text-white px-4 py-2 rounded-lg hover:bg-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" /> Rubrics
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-[#48A6A7] text-[#006A71]"
                      : "border-transparent text-[#9ACBD0] hover:text-[#48A6A7] hover:border-[#9ACBD0]"
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
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-8 sm:px-6 lg:px-8">
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

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-[#48A6A7]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Upload Tab */}
            {activeTab === "upload" && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
                  <h2 className="text-xl font-semibold text-[#006A71] mb-6">
                    Upload Answer Script
                  </h2>
                  {questionPapers.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-[#9ACBD0] rounded-xl">
                      <FileUp className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
                      <p className="text-[#48A6A7] mb-4">
                        No question papers available. Create one first.
                      </p>
                      <button
                        onClick={() => setActiveTab("new-paper")}
                        className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
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
                  <h2 className="text-xl font-semibold text-[#006A71]">
                    Answer Scripts ({scripts.length})
                  </h2>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Upload New
                  </button>
                </div>

                {scripts.length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#9ACBD0] p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
                    <h3 className="text-lg font-medium text-[#006A71] mb-2">
                      No scripts uploaded yet
                    </h3>
                    <p className="text-[#48A6A7] text-sm mb-4">
                      Upload your first answer script to start evaluating
                    </p>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
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
                  <h2 className="text-xl font-semibold text-[#006A71]">
                    Question Papers ({questionPapers.length})
                  </h2>
                  <button
                    onClick={() => setActiveTab("new-paper")}
                    className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create New
                  </button>
                </div>

                {questionPapers.length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#9ACBD0] p-12 text-center">
                    <ClipboardList className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
                    <h3 className="text-lg font-medium text-[#006A71] mb-2">
                      No question papers yet
                    </h3>
                    <p className="text-[#48A6A7] text-sm mb-4">
                      Create your first question paper to start evaluating
                      scripts
                    </p>
                    <button
                      onClick={() => setActiveTab("new-paper")}
                      className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
                    >
                      Create Question Paper
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questionPapers.map((paper) => (
                      <div
                        key={paper.id}
                        className="bg-white rounded-xl border border-[#9ACBD0] p-6 hover:border-[#48A6A7] transition-colors"
                      >
                        <h3 className="text-lg font-semibold text-[#006A71] mb-2">
                          {paper.title}
                        </h3>
                        <div className="space-y-1 text-sm text-[#48A6A7]">
                          <p>Subject: {paper.subject}</p>
                          <p>Class: {paper.class_level}</p>
                          <p>
                            Questions:{" "}
                            {paper.question_count ||
                              paper.questions?.length ||
                              0}
                          </p>
                          <p>Total Marks: {paper.total_marks}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-[#9ACBD0]">
                          <p className="text-xs text-[#9ACBD0] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created:{" "}
                            {new Date(paper.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rubrics Tab */}
            {activeTab === "rubrics" && (
              <div>
                <RubricsLibrary />
              </div>
            )}

            {/* New Paper Tab */}
            {activeTab === "new-paper" && (
              <div className="max-w-4xl mx-auto">
                {/* Mode Selector */}
                <div className="bg-white rounded-xl border border-[#9ACBD0] p-6 mb-6">
                  <h2 className="text-lg font-semibold text-[#006A71] mb-4">
                    How would you like to create the question paper?
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaperCreationMode("pdf")}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        paperCreationMode === "pdf"
                          ? "border-[#48A6A7] bg-[#48A6A7]/5"
                          : "border-[#9ACBD0] hover:border-[#48A6A7]"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`p-3 rounded-lg ${
                            paperCreationMode === "pdf"
                              ? "bg-[#48A6A7]/20"
                              : "bg-[#F2EFE7]"
                          }`}
                        >
                          <Upload
                            className={`w-6 h-6 ${
                              paperCreationMode === "pdf"
                                ? "text-[#006A71]"
                                : "text-[#9ACBD0]"
                            }`}
                          />
                        </div>
                        <h3
                          className={`font-semibold ${
                            paperCreationMode === "pdf"
                              ? "text-[#006A71]"
                              : "text-[#48A6A7]"
                          }`}
                        >
                          Upload PDF
                        </h3>
                      </div>
                      <p className="text-sm text-[#48A6A7]">
                        Upload a PDF file containing questions and marking
                        scheme. AI will automatically extract the questions,
                        marks, and rubrics.
                      </p>
                      <div className="mt-3 flex items-center text-xs text-[#006A71]">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Recommended - Fastest method
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaperCreationMode("manual")}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        paperCreationMode === "manual"
                          ? "border-[#48A6A7] bg-[#48A6A7]/5"
                          : "border-[#9ACBD0] hover:border-[#48A6A7]"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`p-3 rounded-lg ${
                            paperCreationMode === "manual"
                              ? "bg-[#48A6A7]/20"
                              : "bg-[#F2EFE7]"
                          }`}
                        >
                          <Edit3
                            className={`w-6 h-6 ${
                              paperCreationMode === "manual"
                                ? "text-[#006A71]"
                                : "text-[#9ACBD0]"
                            }`}
                          />
                        </div>
                        <h3
                          className={`font-semibold ${
                            paperCreationMode === "manual"
                              ? "text-[#006A71]"
                              : "text-[#48A6A7]"
                          }`}
                        >
                          Manual Entry
                        </h3>
                      </div>
                      <p className="text-sm text-[#48A6A7]">
                        Manually enter each question, marks, model answers, and
                        detailed rubrics one by one.
                      </p>
                      <div className="mt-3 flex items-center text-xs text-[#9ACBD0]">
                        <Clock className="w-4 h-4 mr-1" />
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

      {/* Footer */}
      <footer className="border-t border-[#9ACBD0] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#48A6A7]">
            EduVision AI Platform - Script Evaluation
          </p>
        </div>
      </footer>
    </div>
  );
}
