"use client";

import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  color?: "primary" | "emerald" | "amber" | "red" | "blue" | "purple";
}

const colorMap = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
  color = "primary",
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-secondary">{label}</p>
          <p className="text-2xl font-bold text-primary-dark mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
