"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SectionPerformanceProps {
  data: {
    section_name: string;
    class_name: string;
    avg_percentage: number;
    script_count: number;
  }[];
}

export default function SectionPerformanceChart({
  data,
}: SectionPerformanceProps) {
  const chartData = data.map((d) => ({
    name: `${d.class_name}-${d.section_name}`,
    avg: Math.round(d.avg_percentage * 10) / 10,
    scripts: d.script_count,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No section performance data available yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
          }}
          formatter={(value) => [`${value}%`, "Avg Score"]}
        />
        <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
      </BarChart>
    </ResponsiveContainer>
  );
}
