"use client";

import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Misconception } from "@/api/analytics";

interface Props {
  misconceptions: Misconception[];
  totalStudents?: number;
}

const typeColors: Record<string, string> = {
  sign_error: "bg-red-100 text-red-700 border-red-200",
  formula_misuse: "bg-orange-100 text-orange-700 border-orange-200",
  missing_keyword: "bg-yellow-100 text-yellow-700 border-yellow-200",
  calculation_error: "bg-purple-100 text-purple-700 border-purple-200",
  conceptual_error: "bg-blue-100 text-blue-700 border-blue-200",
  incorrect_steps: "bg-indigo-100 text-indigo-700 border-indigo-200",
  unit_error: "bg-pink-100 text-pink-700 border-pink-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

function MisconceptionItem({ m }: { m: Misconception }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = typeColors[m.misconception_type] ?? typeColors.other;

  return (
    <div className="border border-secondary/20 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${colorClass} whitespace-nowrap`}>
          {m.misconception_type_display}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-dark truncate">
            {m.description.length > 80 ? m.description.slice(0, 80) + "…" : m.description}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-primary-dark">{m.frequency}</p>
            <p className="text-xs text-secondary">{m.percentage_affected}% of class</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-secondary" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-secondary/10 bg-gray-50">
          <p className="text-sm text-primary-dark mt-3 mb-2">{m.description}</p>
          {m.example_answers.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
                Example Student Responses
              </p>
              {m.example_answers.map((ex, i) => (
                <div
                  key={i}
                  className="text-xs text-gray-600 bg-white border border-secondary/20 rounded p-2 italic"
                >
                  &ldquo;{ex.length > 150 ? ex.slice(0, 150) + "…" : ex}&rdquo;
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MisconceptionList({ misconceptions, totalStudents }: Props) {
  if (!misconceptions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-secondary text-sm gap-2">
        <AlertTriangle className="w-8 h-8 text-secondary/40" />
        <p>No misconceptions detected yet.</p>
        <p className="text-xs">Misconceptions appear after scripts are evaluated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {totalStudents !== undefined && (
        <p className="text-xs text-secondary mb-3">
          Detected from {totalStudents} evaluated response{totalStudents !== 1 ? "s" : ""}
        </p>
      )}
      {misconceptions.map((m) => (
        <MisconceptionItem key={m.id} m={m} />
      ))}
    </div>
  );
}
