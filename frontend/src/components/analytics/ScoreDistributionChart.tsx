"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ProgressDataPoint } from "@/api/analytics";

interface Props {
  data: ProgressDataPoint[];
}

const BUCKETS = [
  { label: "0–49", min: 0, max: 49, color: "#ef4444" },
  { label: "50–74", min: 50, max: 74, color: "#eab308" },
  { label: "75–89", min: 75, max: 89, color: "#22c55e" },
  { label: "90–100", min: 90, max: 100, color: "#2563eb" },
];

export default function ScoreDistributionChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No assessment data yet
      </div>
    );
  }

  const chartData = BUCKETS.map((b) => ({
    label: b.label,
    count: data.filter((d) => d.percentage >= b.min && d.percentage <= b.max).length,
    color: b.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: -10, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          formatter={(value) => [`${value} assessment${value !== 1 ? "s" : ""}`, "Count"]}
          labelFormatter={(label) => `Score range: ${label}%`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Assessments">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
