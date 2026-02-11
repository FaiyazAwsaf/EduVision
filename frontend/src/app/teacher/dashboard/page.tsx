"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Pencil,
  ArrowRight,
  Loader2,
  Users,
  Clock,
  Video,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listSessions,
  createSession,
  type SessionStatus,
} from "@/api/tutoring";
import { getMyClass, type MyClassInfo } from "@/api/school";

/* ─── Dummy data (submissions – keep for now) ────────────────────────────── */

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
    statusColor: "text-primary-dark",
    statusDot: "bg-primary",
  },
  {
    id: 2,
    student: "Ava Chen",
    avatarColor: "#F0C987",
    assignment: "Midterm Essay",
    status: "OCR COMPLETE",
    statusColor: "text-primary-dark",
    statusDot: "bg-primary",
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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Format ISO date to a human-readable relative/absolute string */
function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
}

/** Pick a deterministic avatar colour from a name string */
const AVATAR_COLORS = [
  "#9ACBD0",
  "#48A6A7",
  "#006A71",
  "#D4C5A9",
  "#B39DDB",
  "#F0C987",
  "#FFD6A5",
];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Get initials from a name */
function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TeacherDashboard() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [activeSessions, setActiveSessions] = useState<SessionStatus[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [myClass, setMyClass] = useState<MyClassInfo | null>(null);

  // Authorization check
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    } else if (isReady && isAuthenticated && user?.role !== "teacher") {
      // Redirect non-teachers to their appropriate dashboard
      router.replace("/student/dashboard");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch active sessions for this teacher
  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      // Fetch both WAITING and ACTIVE sessions
      const [waiting, active] = await Promise.all([
        listSessions("WAITING"),
        listSessions("ACTIVE"),
      ]);
      setActiveSessions([...active, ...waiting]);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      fetchSessions();
      // Poll every 15 seconds for live updates
      const interval = setInterval(fetchSessions, 15000);
      return () => clearInterval(interval);
    }
  }, [isReady, isAuthenticated, fetchSessions]);

  // Fetch class-teacher info (once)
  useEffect(() => {
    if (isReady && isAuthenticated) {
      getMyClass()
        .then(setMyClass)
        .catch(() => setMyClass(null)); // silently ignore if not a class teacher
    }
  }, [isReady, isAuthenticated]);

  // Create a new session and redirect to the session page
  const handleNewClass = async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const session = await createSession();
      // Save session data to sessionStorage so the session page can restore it
      const tutoringUser = {
        id: user!.id,
        email: user!.email,
        full_name: `${user!.first_name} ${user!.last_name}`,
        role: user!.role.toUpperCase() as "TEACHER" | "STUDENT",
        created_at: user!.date_joined,
      };
      sessionStorage.setItem(
        "tutoring_teacher_session",
        JSON.stringify(session),
      );
      sessionStorage.setItem(
        "tutoring_teacher_user",
        JSON.stringify(tutoringUser),
      );
      router.push("/teacher/dashboard/session");
    } catch (err) {
      console.error("Failed to create session:", err);
      setCreatingSession(false);
    }
  };

  // Show loading state while checking authentication or if wrong role (will redirect)
  if (!isReady || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              Classroom Monitoring
            </h1>
            <p className="text-sm text-primary">
              {loadingSessions
                ? "Loading sessions…"
                : `Monitoring ${activeSessions.length} active session${activeSessions.length !== 1 ? "s" : ""} in real-time`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* New Class button */}
            <button
              onClick={handleNewClass}
              disabled={creatingSession}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingSession ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creatingSession ? "Creating…" : "New Class"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-6 max-w-6xl">
        {/* My Class card */}
        {myClass && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <h2 className="text-lg font-semibold text-primary-dark">
                        Class {myClass.class_name}
                        {myClass.stream && ` — ${myClass.stream}`}, Section{" "}
                        {myClass.name}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                        <GraduationCap className="w-3 h-3" />
                        Class Teacher
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {myClass.academic_year} &middot; Capacity:{" "}
                      {myClass.capacity}
                    </p>
                  </div>
                </div>

                <Link
                  href="/teacher/students"
                  className="flex items-center gap-3 bg-background hover:bg-primary/5 rounded-xl px-5 py-3 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary-dark leading-tight">
                      {myClass.student_count}
                    </p>
                    <p className="text-xs text-muted">Students</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary ml-2 transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Active Sessions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-primary-dark mb-4">
            Active Sessions
          </h2>

          {loadingSessions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-secondary/30 p-10 text-center shadow-sm">
              <Video className="w-10 h-10 text-secondary mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-dark mb-1">
                No active sessions
              </p>
              <p className="text-xs text-muted mb-4">
                Create a new class to start a live tutoring session
              </p>
              <button
                onClick={handleNewClass}
                disabled={creatingSession}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creatingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {creatingSession ? "Creating…" : "New Class"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => router.push("/teacher/dashboard/session")}
                  className="bg-white rounded-2xl border border-secondary/30 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-primary-dark truncate">
                        Tutoring Session
                      </h3>
                      <p className="text-xs text-muted mt-0.5 font-mono truncate">
                        {session.room_id}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 ml-3 ${
                        session.status === "ACTIVE"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            session.status === "ACTIVE"
                              ? "bg-red-400"
                              : "bg-amber-400"
                          }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                            session.status === "ACTIVE"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                        />
                      </span>
                      {session.status === "ACTIVE" ? "LIVE" : "WAITING"}
                    </span>
                  </div>

                  {/* Session Info */}
                  <div className="space-y-3 mb-5">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {session.status === "ACTIVE"
                            ? "1 Student connected"
                            : "Waiting for student…"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Started {formatSessionTime(session.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Participant cards */}
                    <div className="flex flex-col gap-2">
                      {/* Teacher */}
                      <div className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                          style={{
                            backgroundColor: avatarColor(session.teacher_name),
                          }}
                        >
                          {initials(session.teacher_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-primary-dark truncate">
                            {session.teacher_name}
                          </p>
                          <p className="text-[10px] text-muted">Teacher</p>
                        </div>
                      </div>

                      {/* Student */}
                      {session.student_name ? (
                        <div className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                            style={{
                              backgroundColor: avatarColor(
                                session.student_name,
                              ),
                            }}
                          >
                            {initials(session.student_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary-dark truncate">
                              {session.student_name}
                            </p>
                            <p className="text-[10px] text-muted">Student</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 border border-dashed border-secondary/40 rounded-lg px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-secondary" />
                          </div>
                          <p className="text-xs text-secondary italic">
                            No student has joined yet
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end pt-3 border-t border-secondary/20">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary-dark transition-colors">
                      GO TO SESSION
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Script Submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-dark">
              Recent Script Submissions
            </h2>
            <Link
              href="/evaluation"
              className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              View Engine Queue
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-background/50 border-b border-secondary/20 text-xs font-semibold text-muted uppercase tracking-wide">
              <span>Student</span>
              <span>Assignment</span>
              <span>Engine Status</span>
              <span>Actions</span>
            </div>

            {/* Rows */}
            {recentSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-secondary/10 last:border-b-0 items-center hover:bg-background/30 transition-colors"
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
                  <span className="text-sm font-medium text-primary-dark">
                    {sub.student}
                  </span>
                </div>

                {/* Assignment */}
                <span className="text-sm text-muted">{sub.assignment}</span>

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
                    <button className="p-1.5 rounded-lg hover:bg-[#E8F4F5] transition text-primary">
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {sub.status === "OCR COMPLETE" && (
                    <button className="p-1.5 rounded-lg hover:bg-[#E8F4F5] transition text-primary">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {sub.status === "PROCESSING..." && (
                    <button
                      className="p-1.5 rounded-lg text-secondary cursor-not-allowed"
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
