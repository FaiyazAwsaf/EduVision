"use client";

import React, { useEffect, useState } from "react";
import { getAdminStats, type AdminStats } from "@/api/admin";
import {
  Users,
  GraduationCap,
  School,
  BookOpen,
  Layers,
  ClipboardCheck,
  UserCheck,
  UserX,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "primary",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.primary}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-primary-dark">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 rounded-xl p-4 border border-red-200">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          Admin Dashboard
        </h1>
        <p className="text-muted text-sm mt-1">School management overview</p>
      </div>

      {/* Users Section */}
      <div>
        <h2 className="text-lg font-semibold text-primary-dark mb-4">Users</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total_users}
            icon={Users}
            color="primary"
          />
          <StatCard
            label="Teachers"
            value={stats.total_teachers}
            icon={GraduationCap}
            color="blue"
          />
          <StatCard
            label="Students"
            value={stats.total_students}
            icon={Users}
            color="teal"
          />
          <StatCard
            label="Active Users"
            value={stats.active_users}
            icon={UserCheck}
            color="green"
          />
        </div>
      </div>

      {/* Profile Status */}
      <div>
        <h2 className="text-lg font-semibold text-primary-dark mb-4">
          Profile Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Teachers w/ Profile"
            value={stats.teachers_with_profile}
            icon={UserCheck}
            color="green"
          />
          <StatCard
            label="Teachers w/o Profile"
            value={stats.teachers_without_profile}
            icon={UserX}
            color="rose"
          />
          <StatCard
            label="Students w/ Profile"
            value={stats.students_with_profile}
            icon={UserCheck}
            color="green"
          />
          <StatCard
            label="Students w/o Profile"
            value={stats.students_without_profile}
            icon={UserX}
            color="rose"
          />
        </div>
      </div>

      {/* School Section */}
      <div>
        <h2 className="text-lg font-semibold text-primary-dark mb-4">
          School Structure
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Classes"
            value={stats.total_classes}
            icon={School}
            color="indigo"
          />
          <StatCard
            label="Sections"
            value={stats.total_sections}
            icon={Layers}
            color="purple"
          />
          <StatCard
            label="Subjects"
            value={stats.total_subjects}
            icon={BookOpen}
            color="amber"
          />
          <StatCard
            label="Assignments"
            value={stats.total_assignments}
            icon={ClipboardCheck}
            color="blue"
          />
        </div>
      </div>
    </div>
  );
}
