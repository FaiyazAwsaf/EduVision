"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PerformerEntry } from "@/api/evaluation";

interface StudentPerformanceChartProps {
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
}

export default function StudentPerformanceChart({
  topPerformers,
  bottomPerformers,
}: StudentPerformanceChartProps) {
  // Merge and deduplicate by user_id, then sort descending
  const seen = new Set<string>();
  const all: PerformerEntry[] = [];
  for (const p of [...topPerformers, ...bottomPerformers]) {
    if (!seen.has(p.user_id)) {
      seen.add(p.user_id);
      all.push(p);
    }
  }
  all.sort((a, b) => b.avg_percentage - a.avg_percentage);

  if (all.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No student performance data available yet.
      </div>
    );
  }

  const avg =
    all.reduce((s, p) => s + p.avg_percentage, 0) / all.length;

  const chartData = all.map((p) => ({
    name: p.name.split(" ")[0],
    fullName: p.name,
    percentage: p.avg_percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={chartData.length > 8 ? -35 : 0}
          textAnchor={chartData.length > 8 ? "end" : "middle"}
          height={chartData.length > 8 ? 60 : 30}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
          }}
          formatter={(value) => [`${value}%`, "Avg Score"]}
          labelFormatter={(_label, payload) => {
            if (payload && payload.length > 0) {
              return payload[0].payload.fullName;
            }
            return _label;
          }}
        />
        <ReferenceLine
          y={Math.round(avg * 10) / 10}
          stroke="#6366f1"
          strokeDasharray="4 4"
          label={{
            value: `Avg ${Math.round(avg)}%`,
            fill: "#6366f1",
            fontSize: 11,
            position: "right",
          }}
        />
        <Bar
          dataKey="percentage"
          radius={[4, 4, 0, 0]}
          maxBarSize={45}
          fill="#10b981"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
