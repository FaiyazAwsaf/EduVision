"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ContentSummaryProps {
  data: {
    total: number;
    completed: number;
    success_rate: number;
    by_type: { content_type: string; count: number }[];
  };
}

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const TYPE_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  WORKED_EXAMPLES: "Worked Examples",
  FORMULA_SHEET: "Formula Sheet",
  LESSON_PLAN: "Lesson Plan",
  QUIZ_GENERATOR: "Quiz",
  WORKSHEET_BUILDER: "Worksheet",
  TOPIC_EXPLANATION: "Topic Explanation",
};

export default function ContentSummaryChart({ data }: ContentSummaryProps) {
  const chartData = data.by_type.map((d) => ({
    name: TYPE_LABELS[d.content_type] || d.content_type,
    value: d.count,
  }));

  if (data.total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No content generated yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="w-full md:w-1/2">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
              }}
            />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full md:w-1/2 space-y-3">
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-secondary">Total Generated</p>
          <p className="text-xl font-bold text-primary-dark">{data.total}</p>
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-secondary">Completed</p>
          <p className="text-xl font-bold text-emerald-600">{data.completed}</p>
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-secondary">Success Rate</p>
          <p className="text-xl font-bold text-primary-dark">
            {data.success_rate}%
          </p>
        </div>
      </div>
    </div>
  );
}
