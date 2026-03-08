"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ProgressDataPoint } from "@/api/analytics";

interface Props {
  data: ProgressDataPoint[];
}

export default function StudentProgressChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No assessment data yet
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    name: d.assessment.length > 18 ? d.assessment.slice(0, 18) + "…" : d.assessment,
    percentage: d.percentage,
    subject: d.subject,
    date: d.date,
    index: i + 1,
  }));

  const avg =
    Math.round(
      chartData.reduce((s, d) => s + d.percentage, 0) / chartData.length
    );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number, _name: string, props) => [
            `${value}%`,
            props.payload?.subject || "Score",
          ]}
          labelFormatter={(label) => `Assessment: ${label}`}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        />
        <ReferenceLine
          y={avg}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: `Avg ${avg}%`, position: "insideRight", fontSize: 11, fill: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="#2563eb"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          name="Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
