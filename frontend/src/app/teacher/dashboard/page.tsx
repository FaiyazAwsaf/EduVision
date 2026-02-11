"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  ArrowRight,
  Loader2,
  Users,
  Clock,
  Video,
  GraduationCap,
  BookOpen,
  FileText,
  CheckCircle,
  AlertCircle,
  Hourglass,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listSessions,
  createSession,
  type SessionStatus,
} from "@/api/tutoring";
import { getMyClass, type MyClassInfo } from "@/api/school";
import {
  getMyTeachingAssignments,
  type TeachingAssignment,
} from "@/api/school";
import { getScripts, type AnswerScript } from "@/api/evaluation";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Section Picker Modal ───────────────────────────────────────────────── */

interface UniqueSection {
  id: number;
  section_name: string;
  class_name: string;
  stream: string;
  academic_year: string;
}

function SectionPickerModal({
  sections,
  onSelect,
  onClose,
  isCreating,
}: {
  sections: UniqueSection[];
  onSelect: (sectionId: number) => void;
  onClose: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary/20">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">
              Start a Tutoring Session
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Choose the section for this session
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="p-2 rounded-lg text-muted hover:text-primary-dark hover:bg-background transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section list */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {sections.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-secondary mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-dark mb-1">
                No assigned sections
              </p>
              <p className="text-xs text-muted">
                You have not been assigned to any section yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => onSelect(section.id)}
                  disabled={isCreating}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-secondary/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary-dark">
                      Class {section.class_name} - Section{" "}
                      {section.section_name}
                    </p>
                    <p className="text-xs text-muted">
                      {section.stream && `${section.stream} · `}
                      {section.academic_year}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-secondary/20">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="w-full text-sm text-muted hover:text-primary-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TeacherDashboard() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const [activeSessions, setActiveSessions] = useState<SessionStatus[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [myClass, setMyClass] = useState<MyClassInfo | null>(null);
  const [recentScripts, setRecentScripts] = useState<AnswerScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);

  // Section picker modal state
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [sections, setSections] = useState<UniqueSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Authorization check
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    } else if (isReady && isAuthenticated && user?.role !== "teacher") {
      router.replace("/student/dashboard");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch active sessions
  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
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
      const interval = setInterval(fetchSessions, 15000);
      return () => clearInterval(interval);
    }
  }, [isReady, isAuthenticated, fetchSessions]);

  // Fetch class-teacher info
  useEffect(() => {
    if (isReady && isAuthenticated) {
      getMyClass()
        .then(setMyClass)
        .catch(() => setMyClass(null));
    }
  }, [isReady, isAuthenticated]);

  // Fetch recent script submissions
  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    setLoadingScripts(true);
    getScripts()
      .then((scripts) => {
        const sorted = [...scripts].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        );
        setRecentScripts(sorted.slice(0, 6));
      })
      .catch(() => setRecentScripts([]))
      .finally(() => setLoadingScripts(false));
  }, [isReady, isAuthenticated]);

  // Open section picker: fetch teaching assignments and deduplicate by section
  const handleOpenSectionPicker = async () => {
    setShowSectionPicker(true);
    setLoadingSections(true);
    try {
      const assignments = await getMyTeachingAssignments();
      // Deduplicate by section id
      const sectionMap = new Map<number, UniqueSection>();
      for (const a of assignments) {
        if (!sectionMap.has(a.section)) {
          sectionMap.set(a.section, {
            id: a.section,
            section_name: a.section_name,
            class_name: a.class_name,
            stream: a.stream,
            academic_year: a.academic_year,
          });
        }
      }
      setSections(Array.from(sectionMap.values()));
    } catch (err) {
      console.error("Failed to fetch sections:", err);
      setSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  // Create session for selected section
  const handleCreateSession = async (sectionId: number) => {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const session = await createSession(sectionId);
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
      setShowSectionPicker(false);
      router.push("/teacher/dashboard/session");
    } catch (err) {
      console.error("Failed to create session:", err);
      setCreatingSession(false);
    }
  };

  // Loading state
  if (!isReady || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Section Picker Modal ───────────────────────────────────────── */}
      {showSectionPicker && !loadingSections && (
        <SectionPickerModal
          sections={sections}
          onSelect={handleCreateSession}
          onClose={() => {
            setShowSectionPicker(false);
            setCreatingSession(false);
          }}
          isCreating={creatingSession}
        />
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              Classroom Monitoring
            </h1>
            <p className="text-sm text-primary">
              {loadingSessions
                ? "Loading sessions..."
                : `Monitoring ${activeSessions.length} active session${activeSessions.length !== 1 ? "s" : ""} in real-time`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleOpenSectionPicker}
              disabled={creatingSession || loadingSections}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingSession || loadingSections ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creatingSession
                ? "Creating..."
                : loadingSections
                  ? "Loading..."
                  : "New Session"}
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
                        {myClass.stream && ` - ${myClass.stream}`}, Section{" "}
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
                Start a new session to begin live tutoring
              </p>
              <button
                onClick={handleOpenSectionPicker}
                disabled={creatingSession}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                New Session
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
                        {session.class_name && session.section_name
                          ? `Class ${session.class_name} - Section ${session.section_name}`
                          : "Tutoring Session"}
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
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {session.participant_count}{" "}
                          {session.participant_count === 1
                            ? "student"
                            : "students"}{" "}
                          connected
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Started {formatSessionTime(session.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Teacher card */}
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

                    {/* Participant summary */}
                    {session.participant_count > 0 ? (
                      <div className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <p className="text-xs font-medium text-primary-dark">
                          {session.participant_count}{" "}
                          {session.participant_count === 1
                            ? "student"
                            : "students"}{" "}
                          in session
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 border border-dashed border-secondary/40 rounded-lg px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-secondary" />
                        </div>
                        <p className="text-xs text-secondary italic">
                          Waiting for students to join...
                        </p>
                      </div>
                    )}
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
              Recent Submissions
            </h2>
            <Link
              href="/evaluation"
              className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              View All
            </Link>
          </div>

          {loadingScripts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : recentScripts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-secondary/30 p-10 text-center shadow-sm">
              <FileText className="w-10 h-10 text-secondary mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-dark mb-1">
                No submissions yet
              </p>
              <p className="text-xs text-muted">
                Scripts submitted by students or uploaded by you will appear here
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-background/50 border-b border-secondary/20 text-xs font-semibold text-muted uppercase tracking-wide">
                <span className="col-span-3">Student</span>
                <span className="col-span-3">Form / Rubric</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2">Score</span>
                <span className="col-span-2">Submitted</span>
              </div>

              {recentScripts.map((script) => {
                const studentName =
                  script.student_full_name ||
                  script.student_name ||
                  "Unknown Student";
                const formTitle =
                  script.submission_form_title ||
                  script.rubric_set_title ||
                  "Manual Upload";

                return (
                  <Link
                    key={script.id}
                    href={`/evaluation?script=${script.id}`}
                    className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-secondary/10 last:border-b-0 items-center hover:bg-background/30 transition-colors"
                  >
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                        style={{ backgroundColor: avatarColor(studentName) }}
                      >
                        {initials(studentName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary-dark truncate">
                          {studentName}
                        </p>
                        {script.student_roll_number && (
                          <p className="text-[10px] text-muted">
                            {script.student_roll_number}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <p className="text-sm text-primary-dark truncate">
                        {formTitle}
                      </p>
                      {script.page_count != null && (
                        <p className="text-[10px] text-muted">
                          {script.page_count} page
                          {script.page_count !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          script.status === "evaluated"
                            ? "bg-emerald-50 text-emerald-700"
                            : script.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : script.status === "processing"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-red-50 text-red-700"
                        }`}
                      >
                        {script.status === "evaluated" && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {script.status === "pending" && (
                          <Hourglass className="w-3 h-3" />
                        )}
                        {script.status === "processing" && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {script.status === "error" && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {script.status.charAt(0).toUpperCase() +
                          script.status.slice(1)}
                      </span>
                    </div>

                    <div className="col-span-2">
                      {script.status === "evaluated" &&
                      script.percentage != null ? (
                        <div>
                          <p
                            className={`text-sm font-bold ${
                              script.percentage >= 80
                                ? "text-emerald-600"
                                : script.percentage >= 60
                                  ? "text-primary"
                                  : script.percentage >= 40
                                    ? "text-amber-600"
                                    : "text-red-600"
                            }`}
                          >
                            {script.percentage.toFixed(1)}%
                          </p>
                          {script.total_score != null && (
                            <p className="text-[10px] text-muted">
                              {script.total_score.toFixed(1)} marks
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">--</span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-xs text-muted">
                        {formatSessionTime(script.created_at)}
                      </span>
                      {script.status === "evaluated" && (
                        <Eye className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
