"use client";

import React from "react";
import { EvaluationReport } from "@/lib/api/evaluation";

interface EvaluationReportViewProps {
  report: EvaluationReport;
  onBack?: () => void;
}

export default function EvaluationReportView({
  report,
  onBack,
}: EvaluationReportViewProps) {
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-500";
    if (percentage >= 60) return "text-[#48A6A7]";
    if (percentage >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500/10";
    if (percentage >= 60) return "bg-[#48A6A7]/10";
    if (percentage >= 40) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const {
    evaluation_summary,
    question_paper,
    question_results,
    overall_feedback,
  } = report;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#48A6A7] hover:text-[#006A71] transition-colors"
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
        <h1 className="text-2xl font-bold text-[#006A71]">Evaluation Report</h1>
        <div />
      </div>

      {/* Summary Card */}
      <div className="bg-[#9ACBD0]/20 rounded-xl border-2 border-[#9ACBD0] p-6 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Rubric Set Info */}
          <div>
            <h2 className="text-lg font-semibold text-[#006A71] mb-4">
              {rubric_set.title}
            </h2>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <span className="font-medium">Subject:</span>{" "}
                {question_paper.subject}
              </p>
              <p>
                <span className="font-medium">Class:</span>{" "}
                {question_paper.class_level}
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
              {evaluation_summary.percentage.toFixed(1)}%
            </div>
            <div className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              {evaluation_summary.total_score.toFixed(1)} /{" "}
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
        <h2 className="text-xl font-semibold text-[#006A71]">
          Question-by-Question Analysis
        </h2>

        {question_results.map((result, index) => (
          <div
            key={index}
            className="bg-[#9ACBD0]/15 rounded-xl border-2 border-[#9ACBD0] overflow-hidden shadow-md"
          >
            {/* Question Header */}
            <div className="bg-[#48A6A7]/20 px-6 py-4 flex justify-between items-center border-b border-[#9ACBD0]">
              <div>
                <span className="text-sm font-medium text-[#48A6A7]">
                  Question {result.question_number}
                </span>
                <h3 className="text-lg font-medium text-[#006A71]">
                  {result.question_text}
                </h3>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getScoreColor(
                    (result.marks.total / result.marks.max_total) * 100,
                  )}`}
                >
                  {result.marks.total.toFixed(1)} / {result.marks.max_total}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  marks
                </div>
              </div>
            </div>

            {/* Marks Breakdown */}
            <div className="px-6 py-4 space-y-4 bg-white/50">
              {/* Method */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-[#9ACBD0]/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-[#006A71]">
                    Method
                  </span>
                  <div className="text-lg font-semibold text-[#48A6A7]">
                    {result.marks.method.awarded} / {result.marks.method.max}
                  </div>
                </div>
                <div className="flex-1 text-sm text-[#006A71]">
                  {result.marks.method.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Calculation */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-[#9ACBD0]/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-[#006A71]">
                    Calculation
                  </span>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {result.marks.calculation.awarded} /{" "}
                    {result.marks.calculation.max}
                  </div>
                </div>
                <div className="flex-1 text-sm text-[#006A71]">
                  {result.marks.calculation.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Answer */}
              <div className="flex items-start gap-4 p-3 bg-white rounded-lg border border-[#9ACBD0]/50">
                <div className="shrink-0 w-28">
                  <span className="text-sm font-medium text-[#006A71]">
                    Answer
                  </span>
                  <div className="text-lg font-semibold text-[#48A6A7]">
                    {result.marks.answer.awarded} / {result.marks.answer.max}
                  </div>
                </div>
                <div className="flex-1 text-sm text-[#006A71]">
                  {result.marks.answer.feedback || "No specific feedback"}
                </div>
              </div>

              {/* Key Points */}
              {(result.key_points_found?.length ||
                result.key_points_missing?.length) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.key_points_found &&
                      result.key_points_found.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                            ✓ Key Points Covered
                          </h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {result.key_points_found.map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-green-500">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {result.key_points_missing &&
                      result.key_points_missing.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                            ✗ Key Points Missing
                          </h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {result.key_points_missing.map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-red-500">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Mistakes */}
              {result.mistakes_identified &&
                result.mistakes_identified.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
                      ⚠ Mistakes Identified
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {result.mistakes_identified.map((mistake, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-orange-500">•</span>
                          {mistake}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Overall Feedback */}
              {result.overall_feedback && (
                <div className="border-t border-[#9ACBD0] pt-4">
                  <div className="p-3 bg-[#48A6A7]/10 rounded-lg border border-[#9ACBD0]">
                    <h4 className="text-sm font-medium text-[#006A71] mb-2">
                      Feedback
                    </h4>
                    <p className="text-sm text-[#006A71]">
                      {result.overall_feedback}
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Review Flag */}
              {result.needs_manual_review && (
                <div className="border-t border-[#9ACBD0] pt-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      ⚠ This question has been flagged for manual review
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
      <div className="bg-[#9ACBD0]/20 rounded-xl border-2 border-[#9ACBD0] p-6 shadow-md">
        <h2 className="text-xl font-semibold text-[#006A71] mb-4">
          Overall Feedback
        </h2>

        {overall_feedback.summary && (
          <div className="prose dark:prose-invert max-w-none mb-6">
            <p className="text-gray-600 dark:text-gray-400">
              {overall_feedback.summary}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          {overall_feedback.strengths &&
            overall_feedback.strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
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
                      className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <span className="text-green-500 mt-1">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Areas for Improvement */}
          {overall_feedback.areas_for_improvement &&
            overall_feedback.areas_for_improvement.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
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
                      className="flex items-start gap-2 text-sm text-[#006A71]"
                    >
                      <span className="text-[#48A6A7] mt-1">→</span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      {/* Print/Export Button */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors flex items-center gap-2"
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
  );
}
