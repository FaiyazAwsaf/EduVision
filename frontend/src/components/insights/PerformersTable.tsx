"use client";

import type { PerformerEntry } from "@/api/evaluation";

interface PerformersTableProps {
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
}

export default function PerformersTable({
  topPerformers,
  bottomPerformers,
}: PerformersTableProps) {
  if (topPerformers.length === 0 && bottomPerformers.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No student performance data available yet.
      </div>
    );
  }

  const renderTable = (
    title: string,
    performers: PerformerEntry[],
    highlight: "emerald" | "amber",
  ) => {
    if (performers.length === 0) return null;

    const colors =
      highlight === "emerald"
        ? { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" }
        : { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };

    return (
      <div>
        <h4 className="text-sm font-semibold text-primary-dark mb-3">
          {title}
        </h4>
        <div className="space-y-2">
          {performers.map((p, i) => (
            <div
              key={p.user_id}
              className="flex items-center gap-3 p-2 rounded-lg bg-background"
            >
              <span className="text-xs font-bold text-secondary w-5 text-right">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-dark truncate">
                  {p.name}
                </p>
                <p className="text-xs text-secondary">
                  {p.roll_number} - Class {p.class_name} Section {p.section}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}
              >
                {p.avg_percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderTable("Top Performers", topPerformers, "emerald")}
      {renderTable("Needs Attention", bottomPerformers, "amber")}
    </div>
  );
}
