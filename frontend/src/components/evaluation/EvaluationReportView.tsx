"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronDown, Printer } from "lucide-react";
import { EvaluationReport } from "@/api/evaluation";

interface EvaluationReportViewProps {
  report: EvaluationReport;
  onBack?: () => void;
}

export default function EvaluationReportView({
  report,
  onBack,
}: EvaluationReportViewProps) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  const { evaluation_summary, rubric_set, question_results, overall_feedback } =
    report;

  const pct = evaluation_summary.percentage;

  const gradeLabel =
    pct >= 80
      ? "Excellent"
      : pct >= 60
        ? "Good"
        : pct >= 40
          ? "Satisfactory"
          : "Needs Improvement";

  const gradeColor =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 60
        ? "text-primary-dark"
        : pct >= 40
          ? "text-amber-600"
          : "text-red-600";

  const ringColor =
    pct >= 80
      ? "stroke-emerald-500"
      : pct >= 60
        ? "stroke-primary"
        : pct >= 40
          ? "stroke-amber-500"
          : "stroke-red-500";

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Back + Title */}
      <div className="mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <h1 className="text-xl font-semibold text-primary-dark">
          Evaluation Report
        </h1>
        <p className="text-sm text-secondary mt-1">
          {rubric_set.title} &middot; {rubric_set.subject}
        </p>
      </div>

      {/* ── Summary row ────────────────────────────────────────────── */}
      <div className="bg-white border border-secondary/30 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-8">
          {/* Score ring */}
          <div className="shrink-0 relative w-24 h-24">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className="stroke-secondary/25"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className={ringColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct * 0.974} 100`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-bold ${gradeColor}`}>
                {pct.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 mb-1">
              <span className={`text-sm font-medium ${gradeColor}`}>
                {gradeLabel}
              </span>
              <span className="text-sm text-secondary">
                {evaluation_summary.total_score.toFixed(1)} /{" "}
                {evaluation_summary.max_score} marks
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
              {report.student_name && (
                <div>
                  <span className="text-secondary">Student</span>
                  <p className="text-primary-dark font-medium truncate">
                    {report.student_name}
                  </p>
                </div>
              )}
              {report.student_id && (
                <div>
                  <span className="text-secondary">ID</span>
                  <p className="text-primary-dark font-medium">
                    {report.student_id}
                  </p>
                </div>
              )}
              {evaluation_summary.evaluated_at && (
                <div>
                  <span className="text-secondary">Evaluated</span>
                  <p className="text-primary-dark font-medium">
                    {new Date(
                      evaluation_summary.evaluated_at
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              <div>
                <span className="text-secondary">Total marks</span>
                <p className="text-primary-dark font-medium">
                  {rubric_set.total_marks}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Questions ──────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-primary-dark uppercase tracking-wide mb-3">
        Question Breakdown
      </h2>

      <div className="space-y-2 mb-8">
        {question_results.map((result, idx) => {
          const qPct =
            result.marks.max_total > 0
              ? (result.marks.total / result.marks.max_total) * 100
              : 0;
          const isOpen = expandedQ === idx;

          return (
            <div
              key={idx}
              className="bg-white border border-secondary/30 rounded-xl overflow-hidden"
            >
              {/* Row header */}
              <button
                onClick={() => setExpandedQ(isOpen ? null : idx)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
              >
                <span className="shrink-0 w-7 h-7 rounded-lg bg-secondary/15 flex items-center justify-center text-xs font-semibold text-primary-dark">
                  {result.question_number}
                </span>

                <span className="flex-1 text-sm text-primary-dark truncate">
                  {result.question_text}
                </span>

                {/* Mini bar */}
                <div className="shrink-0 w-24 h-1.5 rounded-full bg-secondary/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      qPct >= 70
                        ? "bg-emerald-500"
                        : qPct >= 40
                          ? "bg-amber-500"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${qPct}%` }}
                  />
                </div>

                <span className="shrink-0 text-sm font-medium text-primary-dark w-20 text-right">
                  {result.marks.total.toFixed(1)} / {result.marks.max_total}
                </span>

                <ChevronDown
                  className={`w-4 h-4 text-secondary transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-secondary/20 px-5 py-5 space-y-4">
                  {/* Marks table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-secondary text-xs uppercase tracking-wide">
                        <th className="text-left pb-2 font-medium">
                          Component
                        </th>
                        <th className="text-right pb-2 font-medium w-24">
                          Marks
                        </th>
                        <th className="text-left pb-2 font-medium pl-6">
                          Feedback
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary/15">
                      {[
                        {
                          label: "Method",
                          awarded: result.marks.method.awarded,
                          max: result.marks.method.max,
                          feedback: result.marks.method.feedback,
                        },
                        {
                          label: "Calculation",
                          awarded: result.marks.calculation.awarded,
                          max: result.marks.calculation.max,
                          feedback: result.marks.calculation.feedback,
                        },
                        {
                          label: "Answer",
                          awarded: result.marks.answer.awarded,
                          max: result.marks.answer.max,
                          feedback: result.marks.answer.feedback,
                        },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="py-2 text-primary-dark font-medium">
                            {row.label}
                          </td>
                          <td className="py-2 text-right text-primary-dark">
                            {row.awarded} / {row.max}
                          </td>
                          <td className="py-2 pl-6 text-secondary">
                            {row.feedback || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Key points */}
                  {(result.key_points_found?.length ||
                    result.key_points_missing?.length) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {result.key_points_found &&
                        result.key_points_found.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                              Covered
                            </h4>
                            <ul className="space-y-1 text-sm text-primary-dark">
                              {result.key_points_found.map((pt, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-emerald-500 mt-1">
                                    +
                                  </span>
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {result.key_points_missing &&
                        result.key_points_missing.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                              Missing
                            </h4>
                            <ul className="space-y-1 text-sm text-primary-dark">
                              {result.key_points_missing.map((pt, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-red-400 mt-1">
                                    &minus;
                                  </span>
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Mistakes */}
                  {result.mistakes_identified &&
                    result.mistakes_identified.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                          Mistakes
                        </h4>
                        <ul className="space-y-1 text-sm text-primary-dark">
                          {result.mistakes_identified.map((m, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-amber-500 mt-1">!</span>
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Feedback */}
                  {result.overall_feedback && (
                    <p className="text-sm text-secondary border-t border-secondary/15 pt-3">
                      {result.overall_feedback}
                    </p>
                  )}

                  {/* Manual review flag */}
                  {result.needs_manual_review && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Flagged for manual review
                      {result.review_reason
                        ? ` — ${result.review_reason}`
                        : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Overall Feedback ───────────────────────────────────────── */}
      {(overall_feedback.summary ||
        overall_feedback.strengths?.length ||
        overall_feedback.areas_for_improvement?.length) && (
        <div className="bg-white border border-secondary/30 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-primary-dark uppercase tracking-wide mb-4">
            Overall Feedback
          </h2>

          {overall_feedback.summary && (
            <p className="text-sm text-primary-dark leading-relaxed mb-5">
              {overall_feedback.summary}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {overall_feedback.strengths &&
              overall_feedback.strengths.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                    Strengths
                  </h3>
                  <ul className="space-y-1.5 text-sm text-primary-dark">
                    {overall_feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {overall_feedback.areas_for_improvement &&
              overall_feedback.areas_for_improvement.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                    Areas for Improvement
                  </h3>
                  <ul className="space-y-1.5 text-sm text-primary-dark">
                    {overall_feedback.areas_for_improvement.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">&rarr;</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Print */}
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary-dark transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>
    </div>
  );
}
