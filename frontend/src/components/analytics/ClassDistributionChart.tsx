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
import type { ClassDistribution } from "@/api/analytics";

interface Props {
  data: ClassDistribution;
}

function bucketColor(bucket: string): string {
  const start = parseInt(bucket.split("-")[0], 10);
  if (start < 40) return "#ef4444";
  if (start < 60) return "#f97316";
  if (start < 75) return "#eab308";
  if (start < 90) return "#22c55e";
  return "#16a34a";
}

export default function ClassDistributionChart({ data }: Props) {
  if (!data.distribution || data.total_students === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-secondary text-sm">
        No evaluated scripts yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-6 text-sm">
        <span className="text-secondary">
          Total students:{" "}
          <span className="font-semibold text-primary-dark">{data.total_students}</span>
        </span>
        <span className="text-secondary">
          Class avg:{" "}
          <span className="font-semibold text-primary-dark">{data.avg_percentage}%</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data.distribution}
          margin={{ top: 4, right: 8, left: -10, bottom: 4 }}
          barCategoryGap="15%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            label={{ value: "Score Range (%)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            label={{ value: "Students", angle: -90, position: "insideLeft", offset: 14, fontSize: 11, fill: "#9ca3af" }}
          />
          <Tooltip
            formatter={(value: number) => [value, "Students"]}
            labelFormatter={(label) => `Score range: ${label}%`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Students">
            {data.distribution.map((entry, i) => (
              <Cell key={i} fill={bucketColor(entry.bucket)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
