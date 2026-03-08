"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  MessageSquare,
  BookOpen,
  Plus,
  Zap,
  ArrowRight,
  Bell,
  Calendar,
  Loader2,
  Video,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSessionStatus, type SessionJoinResponse } from "@/api/tutoring";
import {
  getMyScripts,
  getStudentOpenForms,
  type AnswerScript,
  type SubmissionForm,
} from "@/api/evaluation";

/* ─── Quick-action card data ─────────────────────────────────────────────── */

const actions = [
  {
    title: "Upload New Script",
    description: "OCR analysis for handwritten notes",
    icon: Upload,
    href: "/student/scripts",
    cta: "+ Upload",
    color: "bg-[#E8F4F5]",
    iconColor: "text-primary-dark",
  },
  {
    title: "Join Tutoring Session",
    description: "Classroom session",
    icon: MessageSquare,
    href: "/student/tutoring",
    cta: "Launch",
    color: "bg-[#E8F4F5]",
    iconColor: "text-primary-dark",
  },
  {
    title: "Request Content",
    description: "Generate custom study guides",
    icon: BookOpen,
    href: "/content",
    cta: "+ Create",
    color: "bg-[#E8F4F5]",
    iconColor: "text-primary-dark",
  },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function StudentDashboard() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  // Active session state
  const [activeSessionTeacher, setActiveSessionTeacher] = useState<
    string | null
  >(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Scripts & forms state
  const [myScripts, setMyScripts] = useState<AnswerScript[]>([]);
  const [dueForms, setDueForms] = useState<SubmissionForm[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(true);

  // Authorization check - redirect to signin if not authenticated
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    } else if (isReady && isAuthenticated && user?.role !== "student") {
      // Redirect non-students to their appropriate dashboard
      router.replace("/teacher/dashboard");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Check for an active tutoring session in sessionStorage
  useEffect(() => {
    if (!isReady || !user) return;

    try {
      const saved = sessionStorage.getItem("tutoring_student_session_data");
      if (saved) {
        const parsed: SessionJoinResponse = JSON.parse(saved);
        getSessionStatus(parsed.session_id)
          .then((status) => {
            if (
              status.status === "ACTIVE" ||
              status.status === "WAITING" ||
              status.status === "GRACE"
            ) {
              setHasActiveSession(true);
              setActiveSessionTeacher(parsed.teacher_name);
            } else {
              sessionStorage.removeItem("tutoring_student_session_data");
              sessionStorage.removeItem("tutoring_student_user_data");
            }
          })
          .catch(() => {
            sessionStorage.removeItem("tutoring_student_session_data");
            sessionStorage.removeItem("tutoring_student_user_data");
          });
      }
    } catch {}
  }, [isReady, user]);

  // Fetch student scripts and open forms
  useEffect(() => {
    if (!isReady || !user || user.role !== "student") return;

    async function fetchData() {
      setScriptsLoading(true);
      try {
        const [scripts, forms] = await Promise.all([
          getMyScripts(),
          getStudentOpenForms(),
        ]);
        setMyScripts(scripts);

        // Filter to forms the student hasn't submitted yet
        const submittedFormIds = new Set(
          scripts.map((s) => s.submission_form).filter(Boolean),
        );
        setDueForms(forms.filter((f) => !submittedFormIds.has(f.id)));
      } catch {
        // silently fail – cards will show empty state
      } finally {
        setScriptsLoading(false);
      }
    }

    fetchData();
  }, [isReady, user]);

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Show loading state while checking authentication or if wrong role (will redirect)
  if (!isReady || !user || user.role !== "student") {
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
            <h1 className="text-2xl font-bold text-primary-dark">Dashboard</h1>
            <p className="text-sm text-primary">
              Welcome back, {user.first_name}. Ready for today&apos;s goals?
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Date badge */}
            <div className="flex items-center gap-2 bg-white border border-secondary/40 rounded-lg px-3 py-1.5 text-sm text-primary-dark font-medium shadow-sm">
              <Calendar className="w-4 h-4 text-primary" />
              {today}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-6 max-w-6xl">
        {/* Active session banner */}
        {hasActiveSession && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Active Tutoring Session
                </p>
                <p className="text-xs text-green-600">
                  You&apos;re currently in a session
                  {activeSessionTeacher ? ` with ${activeSessionTeacher}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/student/tutoring/session")}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow"
            >
              Go to Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {actions.map((a) => (
            <div
              key={a.title}
              className="bg-white rounded-2xl border border-secondary/30 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`w-14 h-14 ${a.color} rounded-2xl flex items-center justify-center mb-4`}
              >
                <a.icon className={`w-6 h-6 ${a.iconColor}`} />
              </div>
              <h3 className="text-base font-semibold text-primary-dark mb-1">
                {a.title}
              </h3>
              <p className="text-xs text-muted mb-5">{a.description}</p>
              <Link
                href={a.href}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow"
              >
                {a.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Scripts & Due Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* ── Due Scripts Card ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-secondary/30 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-primary-dark">
                Scripts Due
              </h2>
            </div>

            {scriptsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : dueForms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-400 mb-2" />
                <p className="text-sm text-muted">No scripts due to submit</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {dueForms.map((form) => {
                  const deadlineDate = form.deadline
                    ? new Date(form.deadline)
                    : null;
                  const isOverdue = deadlineDate && deadlineDate < new Date();

                  return (
                    <li
                      key={form.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-secondary/30 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary-dark truncate">
                          {form.title}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {form.subject_name} &middot; {form.class_name}{" "}
                          {form.section_name}
                        </p>
                        {deadlineDate ? (
                          <p
                            className={`text-xs mt-1 font-medium ${
                              isOverdue ? "text-red-600" : "text-amber-600"
                            }`}
                          >
                            {isOverdue ? "Overdue" : "Due"}{" "}
                            {deadlineDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            at{" "}
                            {deadlineDate.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        ) : (
                          <p className="text-xs mt-1 text-muted">No deadline</p>
                        )}
                      </div>
                      <Link
                        href="/student/scripts"
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
                      >
                        Submit
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Submitted Scripts Card ────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-secondary/30 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#E8F4F5] rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-dark" />
              </div>
              <h2 className="text-lg font-semibold text-primary-dark">
                Submitted Scripts
              </h2>
            </div>

            {scriptsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : myScripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm text-muted">No scripts submitted yet</p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {myScripts.map((script) => {
                  const isEvaluated = script.status === "evaluated";
                  const isPending =
                    script.status === "pending" ||
                    script.status === "processing";

                  return (
                    <li
                      key={script.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-secondary/30 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary-dark truncate">
                          {script.submission_form_title ||
                            script.rubric_set_title ||
                            "Answer Script"}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {new Date(script.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>

                      {isEvaluated ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {script.total_score != null
                            ? `${script.total_score}${
                                script.percentage != null
                                  ? ` (${Math.round(script.percentage)}%)`
                                  : ""
                              }`
                            : "Evaluated"}
                        </span>
                      ) : isPending ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
                          <Clock className="w-3.5 h-3.5" />
                          Submitted
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Error
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
