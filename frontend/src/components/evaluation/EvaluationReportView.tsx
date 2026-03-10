"use client";

import React, { useState } from "react";
import {
  Check,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EvaluationReport, ScriptPage } from "@/api/evaluation";
import { API_BASE_URL } from "@/config/api";

// Derive the backend media origin from the API base URL
const BACKEND_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "http://127.0.0.1:8000";
  }
})();

function resolveImageUrl(page: ScriptPage): string {
  if (page.image_url) return page.image_url;
  const img = page.image;
  if (img.startsWith("http")) return img;
  // Ensure leading slash so it resolves from the backend root
  return `${BACKEND_ORIGIN}${img.startsWith("/") ? img : `/${img}`}`;
}

interface EvaluationReportViewProps {
  report: EvaluationReport;
  pages?: ScriptPage[];
  onBack?: () => void;
}

export default function EvaluationReportView({
  report,
  pages,
  onBack,
}: EvaluationReportViewProps) {
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const markBroken = (url: string) =>
    setBrokenImages((prev) => new Set(prev).add(url));
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-500";
    if (percentage >= 60) return "text-primary";
    if (percentage >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500/10";
    if (percentage >= 60) return "bg-primary/10";
    if (percentage >= 40) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const { evaluation_summary, rubric_set, question_results, overall_feedback } =
    report;

  return (
    <div className="flex h-full">
      {/* ── Left: Report ── */}
      <div className="flex-1 min-w-0 overflow-y-auto py-8 px-8 print:w-full">
        <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-primary hover:text-primary-dark transition-colors print:hidden"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        )}
        <h1 className="text-2xl font-bold text-primary-dark">
          Evaluation Report
        </h1>
        <div />
      </div>

      {/* Summary Card */}
      <div className="bg-secondary/20 rounded-xl border-2 border-secondary p-6 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Rubric Set Info */}
          <div>
            <h2 className="text-lg font-semibold text-primary-dark mb-4">
              {rubric_set.title}
            </h2>
            <div className="space-y-2 text-sm text-primary-dark">
              <p>
                <span className="font-medium">Subject:</span>{" "}
                {rubric_set.subject}
              </p>
              <p>
                <span className="font-medium">Total Marks:</span>{" "}
                {rubric_set.total_marks}
              </p>
              {report.student_name && (
                <p>
                  <span className="font-medium">Student:</span>{" "}
                  {report.student_name}
                </p>
              )}
              {report.student_id && (
                <p>
                  <span className="font-medium">ID:</span> {report.student_id}
                </p>
              )}
              {evaluation_summary.evaluated_at && (
                <p>
                  <span className="font-medium">Evaluated:</span>{" "}
                  {new Date(evaluation_summary.evaluated_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Right: Score */}
          <div className="flex flex-col items-center justify-center">
            <div
              className={`text-5xl font-bold ${getScoreColor(evaluation_summary.percentage)}`}
            >
              {evaluation_summary.percentage.toFixed(2)}%
            </div>
            <div className="mt-2 text-lg text-primary">
              {evaluation_summary.total_score.toFixed(2)} /{", "}
              {evaluation_summary.max_score} marks
            </div>
            <div
              className={`mt-4 px-4 py-1 rounded-full text-sm font-medium ${getScoreBgColor(
                evaluation_summary.percentage,
              )} ${getScoreColor(evaluation_summary.percentage)}`}
            >
              {evaluation_summary.percentage >= 80
                ? "Excellent"
                : evaluation_summary.percentage >= 60
                  ? "Good"
                  : evaluation_summary.percentage >= 40
                    ? "Satisfactory"
                    : "Needs Improvement"}
            </div>
          </div>
        </div>
      </div>

      {/* Question-by-Question Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-primary-dark">
          Question-by-Question Analysis
        </h2>

        {question_results.map((result, index) => (
          <div
            key={index}
            className="bg-secondary/15 rounded-xl border-2 border-secondary overflow-hidden shadow-md"
          >
            {/* Question Header */}
            <div className="bg-primary/20 px-6 py-4 flex justify-between items-center border-b border-secondary">
              <div>
                <span className="text-sm font-medium text-primary">
                  Question {result.question_number}
                </span>
                <h3 className="text-lg font-medium text-primary-dark">
                  {result.question_text}
                </h3>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getScoreColor(
                    (result.marks.total / result.marks.max_total) * 100,
                  )}`}
                >
                  {result.marks.total.toFixed(2)} / {(+result.marks.max_total).toFixed(2)}
                </div>
                <div className="text-xs text-primary font-medium">marks</div>
              </div>
            </div>

            {/* Marks Breakdown */}
            <div className="px-6 py-4 space-y-4 bg-white/50">
              {/* Method */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-secondary/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-primary-dark">
                    Method
                  </span>
                  <div className="text-lg font-semibold text-primary">
                    {(+result.marks.method.awarded).toFixed(2)} / {(+result.marks.method.max).toFixed(2)}
                  </div>
                </div>
                <div className="flex-1 text-sm text-primary-dark">
                  {result.marks.method.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Calculation */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-secondary/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-primary-dark">
                    Calculation
                  </span>
                  <div className="text-lg font-semibold text-primary">
                    {(+result.marks.calculation.awarded).toFixed(2)} / {(+result.marks.calculation.max).toFixed(2)}
                  </div>
                </div>
                <div className="flex-1 text-sm text-primary-dark">
                  {result.marks.calculation.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Answer */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-secondary/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-primary-dark">
                    Answer
                  </span>
                  <div className="text-lg font-semibold text-primary">
                    {(+result.marks.answer.awarded).toFixed(2)} / {(+result.marks.answer.max).toFixed(2)}
                  </div>
                </div>
                <div className="flex-1 text-sm text-primary-dark">
                  {result.marks.answer.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Mistakes */}
              {result.mistakes_identified &&
                result.mistakes_identified.length > 0 && (
                  <div className="border-t border-secondary pt-4">
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <h4 className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Mistakes Identified
                      </h4>
                      <ul className="text-sm text-orange-800 space-y-1">
                        {result.mistakes_identified.map((mistake, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-orange-500">•</span>
                            {mistake}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

              {/* Overall Feedback */}
              {result.overall_feedback && (
                <div className="border-t border-secondary pt-4">
                  <div className="p-3 bg-primary/10 rounded-lg border border-secondary">
                    <h4 className="text-sm font-medium text-primary-dark mb-2">
                      Feedback
                    </h4>
                    <p className="text-sm text-primary-dark">
                      {result.overall_feedback}
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Review Flag */}
              {result.needs_manual_review && (
                <div className="border-t border-secondary pt-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> This question has been flagged for manual review
                      {result.review_reason && `: ${result.review_reason}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Feedback */}
      <div className="bg-secondary/20 rounded-xl border-2 border-secondary p-6 shadow-md">
        <h2 className="text-xl font-semibold text-primary-dark mb-4">
          Overall Feedback
        </h2>

        {overall_feedback.summary && (
          <div className="prose max-w-none mb-6">
            <p className="text-primary-dark">{overall_feedback.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          {overall_feedback.strengths &&
            overall_feedback.strengths.length > 0 && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h3 className="text-sm font-medium text-emerald-700 mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {overall_feedback.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-emerald-800"
                    >
                      <Check className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Areas for Improvement */}
          {overall_feedback.areas_for_improvement &&
            overall_feedback.areas_for_improvement.length > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg border border-secondary">
                <h3 className="text-sm font-medium text-primary-dark mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {overall_feedback.areas_for_improvement.map((area, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-primary-dark"
                    >
                      <ArrowRight className="w-4 h-4 text-primary mt-1 shrink-0" />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      {/* Print/Export Button */}
      <div className="flex justify-center gap-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print Report
        </button>
      </div>
        </div>
      </div>

      {/* ── Right: Script Image Viewer ── */}
      {pages && pages.length > 0 && (
        <div className="w-80 xl:w-96 shrink-0 border-l border-secondary/30 bg-white flex flex-col overflow-hidden print:hidden">
          {/* Panel header */}
          <div className="sticky top-0 z-10 bg-white border-b border-secondary/30 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary-dark">
              Script Pages
            </h3>
            <span className="text-xs text-secondary bg-secondary/20 px-2 py-0.5 rounded-full">
              {activePageIdx + 1} / {pages.length}
            </span>
          </div>

          {/* Main image */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="rounded-lg overflow-hidden border border-secondary/50 shadow-sm bg-gray-50">
              {brokenImages.has(resolveImageUrl(pages[activePageIdx])) ? (
                <div className="w-full h-64 flex flex-col items-center justify-center text-secondary gap-2">
                  <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-center px-4">Image unavailable.<br/>The original file may have been deleted.</p>
                </div>
              ) : (
                <img
                  src={resolveImageUrl(pages[activePageIdx])}
                  alt={`Page ${pages[activePageIdx].page_number}`}
                  className="w-full object-contain"
                  onError={() => markBroken(resolveImageUrl(pages[activePageIdx]))}
                />
              )}
            </div>

            {/* Page navigation */}
            {pages.length > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActivePageIdx((i) => Math.max(0, i - 1))}
                  disabled={activePageIdx === 0}
                  className="p-1.5 rounded-lg border border-secondary text-primary hover:bg-secondary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-secondary">
                  Page {pages[activePageIdx].page_number}
                </span>
                <button
                  onClick={() =>
                    setActivePageIdx((i) => Math.min(pages.length - 1, i + 1))
                  }
                  disabled={activePageIdx === pages.length - 1}
                  className="p-1.5 rounded-lg border border-secondary text-primary hover:bg-secondary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Thumbnails */}
            {pages.length > 1 && (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-secondary/30">
                {pages.map((page, idx) => (
                  <button
                    key={page.id}
                    onClick={() => setActivePageIdx(idx)}
                    className={`rounded-md overflow-hidden border-2 transition-all ${
                      idx === activePageIdx
                        ? "border-primary shadow-md"
                        : "border-secondary/40 hover:border-secondary"
                    }`}
                  >
                    <img
                      src={resolveImageUrl(page)}
                      alt={`Thumb ${page.page_number}`}
                      className="w-full h-20 object-cover"
                      onError={(e) => {
                        markBroken(resolveImageUrl(page));
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="text-center text-[10px] text-secondary py-0.5">
                      {page.page_number}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
