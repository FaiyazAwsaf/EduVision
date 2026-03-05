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

interface ScoreDistributionProps {
  data: { bucket: string; count: number }[];
}

export default function ScoreDistributionChart({
  data,
}: ScoreDistributionProps) {
  if (data.every((d) => d.count === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No score data available yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
          }}
          formatter={(value) => [value, "Students"]}
        />
        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
