"use client";

import React, { useState } from "react";
import { Loader2, FileText, Trash2 } from "lucide-react";
import { evaluateScript, type AnswerScript } from "@/api/evaluation";

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

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-blue-700",
    evaluated: "bg-emerald-50 text-emerald-700",
    error: "bg-red-50 text-red-700",
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await evaluateScript(script.id);
      onEvaluate(script.id);
    } catch (error) {
      console.error("Evaluation failed:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="bg-white border border-secondary/30 rounded-xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-primary-dark truncate">
            {script.student_name || script.student_id || "Anonymous Student"}
          </h3>
          <p className="text-xs text-secondary mt-0.5">
            {typeof script.rubric_set === "object"
              ? script.rubric_set.title
              : script.rubric_set_title || "Rubric Set"}
          </p>
        </div>
        <span
          className={`shrink-0 ml-3 px-2 py-0.5 rounded text-xs font-medium ${
            statusStyles[script.status] || statusStyles.pending
          }`}
        >
          {script.status.charAt(0).toUpperCase() + script.status.slice(1)}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-secondary mb-3">
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          {script.page_count || script.pages?.length || 0} pages
        </span>
        <span>{new Date(script.created_at).toLocaleDateString()}</span>
      </div>

      {script.status === "evaluated" && script.total_score != null && (
        <div className="flex items-baseline justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 mb-3">
          <span className="text-secondary">Score</span>
          <span className="font-semibold text-primary-dark">
            {typeof script.total_score === "number"
              ? script.total_score.toFixed(1)
              : script.total_score}
            {script.percentage != null && (
              <span className="text-secondary font-normal ml-1">
                (
                {typeof script.percentage === "number"
                  ? script.percentage.toFixed(0)
                  : script.percentage}
                %)
              </span>
            )}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-secondary/20">
        {script.status === "pending" && (
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Evaluating
              </>
            ) : (
              "Evaluate"
            )}
          </button>
        )}

        {script.status === "processing" && (
          <span className="px-3 py-1.5 text-xs text-blue-600 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        )}

        {script.status === "evaluated" && (
          <button
            onClick={() => onViewReport(script.id)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            View Report
          </button>
        )}

        <button
          onClick={() => onDelete(script.id)}
          className="ml-auto p-1.5 text-secondary hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
