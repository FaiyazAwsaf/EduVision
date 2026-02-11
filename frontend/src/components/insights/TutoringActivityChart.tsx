"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TutoringActivityProps {
  data: {
    total_sessions: number;
    avg_duration_seconds: number;
    sessions_by_day: { date: string; count: number }[];
  };
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "N/A";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export default function TutoringActivityChart({
  data,
}: TutoringActivityProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-secondary">Total Sessions</p>
          <p className="text-xl font-bold text-primary-dark">
            {data.total_sessions}
          </p>
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-secondary">Avg Duration</p>
          <p className="text-xl font-bold text-primary-dark">
            {formatDuration(data.avg_duration_seconds)}
          </p>
        </div>
      </div>

      {data.sessions_by_day.every((d) => d.count === 0) ? (
        <div className="flex items-center justify-center h-32 text-secondary text-sm">
          No sessions in the last 14 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={data.sessions_by_day}
            margin={{ top: 5, right: 5, bottom: 5, left: -15 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
              }}
              formatter={(value) => [value, "Sessions"]}
            />
            <Bar
              dataKey="count"
              fill="#8b5cf6"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
