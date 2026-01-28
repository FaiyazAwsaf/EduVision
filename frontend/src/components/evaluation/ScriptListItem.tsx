"use client";

import React, { useState } from "react";
import evaluationAPI, { AnswerScript } from "@/lib/api/evaluation";

interface ScriptListItemProps {
  script: AnswerScript;
  onEvaluate: (scriptId: string) => void;
  onViewReport: (scriptId: string) => void;
  onDelete: (scriptId: string) => void;
}

export default function ScriptListItem({
  script,
  onEvaluate,
  onViewReport,
  onDelete,
}: ScriptListItemProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700",
      processing: "bg-blue-100 text-blue-700",
      evaluated: "bg-emerald-100 text-emerald-700",
      error: "bg-red-100 text-red-700",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await evaluationAPI.evaluateScript(script.id);
      onEvaluate(script.id);
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-[#9ACBD0] p-6 shadow-md hover:shadow-lg hover:border-[#48A6A7] transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-[#006A71]">
              {script.student_name || script.student_id || "Anonymous Student"}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                script.status,
              )}`}
            >
              {script.status.charAt(0).toUpperCase() + script.status.slice(1)}
            </span>
          </div>

          <p className="text-sm text-[#48A6A7] mb-2">
            {typeof script.rubric_set === "object"
              ? script.rubric_set.title
              : "Rubric Set"}
          </p>

          <div className="flex items-center gap-4 text-sm text-[#9ACBD0]">
            <span className="flex items-center gap-1">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {script.page_count || script.pages?.length || 0} pages
            </span>
            <span className="flex items-center gap-1">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {new Date(script.created_at).toLocaleDateString()}
            </span>
          </div>

          {script.status === "evaluated" && script.total_score != null && (
            <div className="mt-3 p-3 bg-[#F2EFE7] rounded-lg border border-[#9ACBD0]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#006A71]">Score</span>
                <span className="text-lg font-bold text-emerald-600">
                  {typeof script.total_score === "number"
                    ? script.total_score.toFixed(1)
                    : script.total_score}{" "}
                  (
                  {typeof script.percentage === "number"
                    ? script.percentage.toFixed(1)
                    : script.percentage}
                  %)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[#9ACBD0]">
        {script.status === "pending" && (
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="px-4 py-2 bg-[#48A6A7] text-white text-sm rounded-lg hover:bg-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isEvaluating ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                Evaluating...
              </>
            ) : (
              <>
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Evaluate
              </>
            )}
          </button>
        )}

        {script.status === "processing" && (
          <span className="px-4 py-2 text-sm text-[#48A6A7] flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            Processing...
          </span>
        )}

        {script.status === "evaluated" && (
          <button
            onClick={() => onViewReport(script.id)}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
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
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            View Report
          </button>
        )}

        <button
          onClick={() => onDelete(script.id)}
          className="px-4 py-2 text-red-400 text-sm rounded-lg hover:bg-red-500/10 transition-colors"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
