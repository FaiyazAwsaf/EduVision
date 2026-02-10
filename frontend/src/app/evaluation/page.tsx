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
} from "lucide-react";
import Sidebar from "@/components/shared/Sidebar";
import {
  getRubricSets,
  getScripts,
  getScript,
  getEvaluationReport,
  deleteScript,
  type RubricSetListItem,
  type AnswerScript,
  type EvaluationReport,
} from "@/api/evaluation";
import ScriptUploadForm from "@/components/evaluation/ScriptUploadForm";
import EvaluationReportView from "@/components/evaluation/EvaluationReportView";
import ScriptListItem from "@/components/evaluation/ScriptListItem";
import RubricsLibrary from "@/components/evaluation/RubricsLibrary";

type Tab = "upload" | "scripts" | "rubrics";

export default function EvaluationPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [rubricSets, setRubricSets] = useState<RubricSetListItem[]>([]);
  const [scripts, setScripts] = useState<AnswerScript[]>([]);
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard: only logged-in teachers can access
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
      const [rubricSetsData, scriptsData] = await Promise.all([
        getRubricSets({ state: "published" }), // Only published rubric sets
        getScripts(),
      ]);
      setRubricSets(rubricSetsData);
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

  const tabs = [
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

  // Show loading while auth is being checked
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
                Evaluate handwritten answer scripts using AI-powered grading
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
                    onClick={() => setActiveTab(tab.id)}
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
              {/* Upload Tab */}
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

              {/* Scripts Tab */}
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

              {/* Rubrics Tab */}
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
