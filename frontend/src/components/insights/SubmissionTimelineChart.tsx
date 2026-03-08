"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SubmissionTimelineProps {
  data: { week: string; submitted: number; evaluated: number }[];
}

export default function SubmissionTimelineChart({
  data,
}: SubmissionTimelineProps) {
  if (data.every((d) => d.submitted === 0 && d.evaluated === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-secondary text-sm">
        No submission activity in the last 30 days.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradEvaluated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="submitted"
          stroke="#6366f1"
          fill="url(#gradSubmitted)"
          name="Submitted"
        />
        <Area
          type="monotone"
          dataKey="evaluated"
          stroke="#10b981"
          fill="url(#gradEvaluated)"
          name="Evaluated"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
