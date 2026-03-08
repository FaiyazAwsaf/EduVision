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
  Cell,
} from "recharts";
import type { QuestionPerformanceEntry } from "@/api/analytics";

interface Props {
  data: QuestionPerformanceEntry[];
}

function difficultyColor(pct: number): string {
  if (pct < 40) return "#ef4444";
  if (pct < 60) return "#f97316";
  if (pct < 75) return "#eab308";
  return "#22c55e";
}

export default function QuestionDifficultyChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No question data yet
      </div>
    );
  }

  const chartData = data.map((q) => ({
    label: `Q${q.question_number}`,
    avg_percentage: q.avg_percentage,
    avg_marks: q.avg_marks,
    max_marks: q.max_marks,
    text: q.question_text,
    responses: q.response_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: -10, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#6b7280" }}
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
        <ReferenceLine
          y={60}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: "60%", position: "insideRight", fontSize: 10, fill: "#94a3b8" }}
        />
        <Tooltip
          formatter={(value: number, _name, props) => [
            `${value}% (${props.payload?.avg_marks}/${props.payload?.max_marks} marks)`,
            props.payload?.text || "Score",
          ]}
          labelFormatter={(label) => `${label}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="avg_percentage" radius={[6, 6, 0, 0]} name="Avg Score">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={difficultyColor(entry.avg_percentage)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
