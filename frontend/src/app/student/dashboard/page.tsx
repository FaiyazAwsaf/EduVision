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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSessionStatus, type SessionJoinResponse } from "@/api/tutoring";

/* ─── Quick-action card data ─────────────────────────────────────────────── */

const actions = [
  {
    title: "Upload New Script",
    description: "OCR analysis for handwritten notes",
    icon: Upload,
    href: "/evaluation",
    cta: "+ Upload",
    color: "bg-[#E8F4F5]",
    iconColor: "text-primary-dark",
  },
  {
    title: "Start Tutoring",
    description: "1-on-1 personalized AI session",
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

/* ─── Dummy recent-feedback data ─────────────────────────────────────────── */

const recentFeedback = [
  {
    id: 1,
    title: "Calculus Notes: Limits & Continuity",
    meta: "Yesterday • Mathematics",
    status: "PROCESSED",
    statusColor: "bg-primary/15 text-primary-dark",
    excerpt:
      '"…OCR extraction complete. Analysis shows strong understanding of basic limit laws, but suggests review of Squeeze Theorem application…"',
  },
  {
    id: 2,
    title: "Organic Chemistry: Functional Groups",
    meta: "2 days ago • Science",
    status: "REVIEW REQUIRED",
    statusColor: "bg-amber-100 text-amber-700",
    excerpt:
      "\"…Handwriting detected in margin: 'Review alcohol dehydration mechanism'. 3 key diagrams identified and digitized…\"",
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

        {/* Recent Feedback */}
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-dark">
            Recent Feedback
          </h2>
          <Link
            href="/evaluation"
            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            View All
          </Link>
        </div>

        <div className="space-y-4">
          {recentFeedback.map((fb) => (
            <div
              key={fb.id}
              className="bg-white rounded-2xl border border-secondary/30 p-5 shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#E8F4F5] rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-dark">
                      {fb.title}
                    </p>
                    <p className="text-xs text-muted">{fb.meta}</p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ${fb.statusColor}`}
                >
                  {fb.status}
                </span>
              </div>

              {/* Excerpt */}
              <div className="bg-background rounded-lg px-4 py-3 mb-3">
                <p className="text-xs text-muted italic leading-relaxed">
                  {fb.excerpt}
                </p>
              </div>

              {/* Link */}
              <Link
                href="/evaluation"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                VIEW REPORT
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
