"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface QuestionAnalysisProps {
  data: {
    question_number: string;
    question_text: string;
    avg_marks: number;
    max_marks: number;
  }[];
}

export default function QuestionAnalysisChart({
  data,
}: QuestionAnalysisProps) {
  const chartData = data.map((d) => ({
    name: `Q${d.question_number}`,
    avg: Math.round(d.avg_marks * 10) / 10,
    max: d.max_marks,
    text: d.question_text,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No question analysis data available yet. Evaluate scripts in a
        submission form to see data here.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 20, bottom: 5, left: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={40} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
          }}
          formatter={(value, name) => [
            value,
            name === "avg" ? "Avg Marks" : "Max Marks",
          ]}
          labelFormatter={(label) => {
            const item = chartData.find((d) => d.name === label);
            return item ? `${label}: ${item.text?.slice(0, 60)}...` : label;
          }}
        />
        <Legend
          formatter={(value) =>
            value === "max" ? "Max Marks" : "Avg Awarded"
          }
        />
        <Bar dataKey="max" fill="#cbd5e1" radius={[0, 4, 4, 0]} maxBarSize={20} />
        <Bar dataKey="avg" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
