"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TopicPerformance } from "@/api/analytics";

interface Props {
  data: TopicPerformance[];
}

export default function TopicRadarChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No topic data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    topic: d.topic,
    fullText: d.question_text,
    score: d.avg_percentage,
    attempts: d.attempts,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="topic"
          tick={{ fontSize: 12, fill: "#374151" }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickFormatter={(v) => `${v}%`}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
        />
        <Tooltip
          formatter={(value, _name, props) => [
            `${value}%`,
            props.payload?.fullText || "Score",
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
