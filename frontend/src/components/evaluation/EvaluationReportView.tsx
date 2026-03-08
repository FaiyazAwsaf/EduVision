"use client";

import React from "react";
import {
  Check,
  X as XIcon,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { EvaluationReport } from "@/api/evaluation";

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
    <div className="max-w-4xl mx-auto space-y-8">
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

              {/* Key Points */}
              {(result.key_points_found?.length ||
                result.key_points_missing?.length) && (
                <div className="border-t border-secondary pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.key_points_found &&
                      result.key_points_found.length > 0 && (
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <h4 className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-1.5">
                            <Check className="w-4 h-4" /> Key Points Covered
                          </h4>
                          <ul className="text-sm text-emerald-800 space-y-1">
                            {result.key_points_found.map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-emerald-500">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {result.key_points_missing &&
                      result.key_points_missing.length > 0 && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
                            <XIcon className="w-4 h-4" /> Key Points Missing
                          </h4>
                          <ul className="text-sm text-red-800 space-y-1">
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
  );
}
