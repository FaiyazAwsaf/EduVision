"use client";

import type { ProgressDataPoint, SubjectPerformance } from "@/api/analytics";

interface Props {
  progress: ProgressDataPoint[];
  subjects: SubjectPerformance[];
}

export default function ConsistencyChart({ progress, subjects }: Props) {
  if (!progress.length || !subjects.length) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No subject data yet
      </div>
    );
  }

  const rows = subjects.map((s) => {
    const entries = progress
      .filter((p) => p.subject === s.subject)
      .map((p) => p.percentage);
    const min = entries.length ? Math.min(...entries) : s.avg_percentage;
    const max = entries.length ? Math.max(...entries) : s.avg_percentage;
    const avg = s.avg_percentage;
    const spread = max - min;
    return { subject: s.subject, min, max, avg, spread, count: entries.length };
  });

  const label = (spread: number) => {
    if (spread <= 10) return { text: "Consistent", color: "#16a34a", bg: "bg-emerald-50 text-emerald-700" };
    if (spread <= 25) return { text: "Variable", color: "#ca8a04", bg: "bg-amber-50 text-amber-700" };
    return { text: "Inconsistent", color: "#dc2626", bg: "bg-red-50 text-red-700" };
  };

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const lbl = label(row.spread);
        // Position the avg dot as % of the 0–100 range bar
        const avgLeft = `${row.avg}%`;
        const rangeLeft = `${row.min}%`;
        const rangeWidth = `${row.max - row.min}%`;

        return (
          <div key={row.subject}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-primary-dark">{row.subject}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">
                  {row.min === row.max ? `${row.min}%` : `${row.min}%–${row.max}%`}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lbl.bg}`}>
                  {lbl.text}
                </span>
              </div>
            </div>
            {/* Range track */}
            <div className="relative h-3 bg-gray-100 rounded-full">
              {/* Colored range band */}
              <div
                className="absolute h-3 rounded-full opacity-40"
                style={{
                  left: rangeLeft,
                  width: rangeWidth,
                  backgroundColor: lbl.color,
                  minWidth: row.spread === 0 ? "3px" : undefined,
                }}
              />
              {/* Avg dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                style={{ left: `calc(${avgLeft} - 6px)`, backgroundColor: lbl.color }}
                title={`Avg: ${row.avg}%`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-secondary/60">
              <span>0%</span>
              <span className="text-secondary text-[10px]">avg {row.avg}%</span>
              <span>100%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
