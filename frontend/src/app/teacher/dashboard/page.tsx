"use client";

import React from "react";
import Link from "next/link";
import { Plus, Bell, Eye, Pencil, ArrowRight } from "lucide-react";

/* ─── Dummy data ─────────────────────────────────────────────────────────── */

const activeClasses = [
  {
    id: 1,
    name: "Advanced Physics 101",
    room: "Room 402",
    students: 32,
    engagement: 92,
    topic: "Kinematics",
    topicProgress: 65,
    avatarColors: ["#9ACBD0", "#48A6A7", "#006A71", "#D4C5A9"],
  },
  {
    id: 2,
    name: "Organic Chemistry",
    room: "Room 215",
    students: 28,
    engagement: 78,
    topic: "Alkanes",
    topicProgress: 40,
    avatarColors: ["#B39DDB", "#9ACBD0", "#48A6A7", "#F0C987"],
  },
];

type EngineStatus = "AI SCORED" | "OCR COMPLETE" | "PROCESSING...";

const recentSubmissions: {
  id: number;
  student: string;
  avatarColor: string;
  assignment: string;
  status: EngineStatus;
  statusColor: string;
  statusDot: string;
}[] = [
  {
    id: 1,
    student: "Liam Thompson",
    avatarColor: "#9ACBD0",
    assignment: "Lab Report #3",
    status: "AI SCORED",
    statusColor: "text-[#006A71]",
    statusDot: "bg-[#48A6A7]",
  },
  {
    id: 2,
    student: "Ava Chen",
    avatarColor: "#F0C987",
    assignment: "Midterm Essay",
    status: "OCR COMPLETE",
    statusColor: "text-[#006A71]",
    statusDot: "bg-[#48A6A7]",
  },
  {
    id: 3,
    student: "Noah Wilson",
    avatarColor: "#FFD6A5",
    assignment: "Calculus HW 8",
    status: "PROCESSING...",
    statusColor: "text-amber-600",
    statusDot: "bg-amber-400",
  },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TeacherDashboard() {
  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#9ACBD0]/30">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-[#006A71]">
              Classroom Monitoring
            </h1>
            <p className="text-sm text-[#48A6A7]">
              Monitoring {activeClasses.length} active classes in real-time
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Live badge */}
            <div className="flex items-center gap-2 text-sm font-medium text-[#006A71]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              LIVE SYSTEM ACTIVE
            </div>

            {/* Notification bell */}
            <button className="relative p-2 rounded-lg hover:bg-[#F2EFE7] transition">
              <Bell className="w-5 h-5 text-[#006A71]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* New Class button */}
            <Link
              href="/teacher/dashboard/session"
              className="inline-flex items-center gap-2 rounded-lg bg-[#48A6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006A71] transition-colors shadow"
            >
              <Plus className="w-4 h-4" />
              New Class
            </Link>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-6 max-w-6xl">
        {/* Active Classes */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#006A71] mb-4">
            Active Classes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeClasses.map((cls) => (
              <div
                key={cls.id}
                className="bg-white rounded-2xl border border-[#9ACBD0]/30 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-base font-semibold text-[#006A71]">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {cls.room} &bull; {cls.students} Students
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide bg-red-50 text-red-600 px-2.5 py-1 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    LIVE
                  </span>
                </div>

                {/* Engagement */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#6B7280]">Engagement Level</span>
                    <span className="font-semibold text-[#006A71]">
                      {cls.engagement}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#F2EFE7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#48A6A7] rounded-full transition-all"
                      style={{ width: `${cls.engagement}%` }}
                    />
                  </div>
                </div>

                {/* Topic progress */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#6B7280]">
                      Topic Progress: {cls.topic}
                    </span>
                    <span className="font-semibold text-[#006A71]">
                      {cls.topicProgress}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#F2EFE7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#006A71] rounded-full transition-all"
                      style={{ width: `${cls.topicProgress}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  {/* Avatars */}
                  <div className="flex -space-x-2">
                    {cls.avatarColors.map((c, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full border-2 border-white"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-[#F2EFE7] flex items-center justify-center text-[10px] font-semibold text-[#006A71]">
                      +{cls.students - 4}
                    </div>
                  </div>

                  <Link
                    href="/teacher/dashboard/session"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#48A6A7] hover:text-[#006A71] transition-colors"
                  >
                    MONITOR FEED
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Script Submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#006A71]">
              Recent Script Submissions
            </h2>
            <Link
              href="/evaluation"
              className="text-sm font-medium text-[#48A6A7] hover:text-[#006A71] transition-colors"
            >
              View Engine Queue
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#9ACBD0]/30 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-[#F2EFE7]/50 border-b border-[#9ACBD0]/20 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
              <span>Student</span>
              <span>Assignment</span>
              <span>Engine Status</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            {recentSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-[#9ACBD0]/10 last:border-b-0 items-center hover:bg-[#F2EFE7]/30 transition-colors"
              >
                {/* Student */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: sub.avatarColor }}
                  >
                    {sub.student
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <span className="text-sm font-medium text-[#006A71]">
                    {sub.student}
                  </span>
                </div>

                {/* Assignment */}
                <span className="text-sm text-[#6B7280]">{sub.assignment}</span>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${sub.statusDot}`} />
                  <span
                    className={`text-xs font-semibold tracking-wide ${sub.statusColor}`}
                  >
                    {sub.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {sub.status === "AI SCORED" && (
                    <button className="p-1.5 rounded-lg hover:bg-[#E8F4F5] transition text-[#48A6A7]">
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {sub.status === "OCR COMPLETE" && (
                    <button className="p-1.5 rounded-lg hover:bg-[#E8F4F5] transition text-[#48A6A7]">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {sub.status === "PROCESSING..." && (
                    <button
                      className="p-1.5 rounded-lg text-[#9ACBD0] cursor-not-allowed"
                      disabled
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
