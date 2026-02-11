"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertTriangle,
  Video,
  ArrowRight,
  Users,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  joinSession,
  getSessionStatus,
  getAvailableSessions,
  getErrorMessage,
  type ApiError,
  type SessionJoinResponse,
  type AvailableSession,
} from "@/api/tutoring";

/* ─── Storage helpers (shared with session page) ─────────────────────────── */

const STORAGE_KEY_STUDENT_SESSION = "tutoring_student_session_data";
const STORAGE_KEY_STUDENT_USER = "tutoring_student_user_data";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatTime(iso: string): string {
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

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function StudentTutoringPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const [availableSessions, setAvailableSessions] = useState<
    AvailableSession[]
  >([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active session detection
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Auth + role guard
  useEffect(() => {
    if (isReady && (!isAuthenticated || user?.role !== "student")) {
      router.replace(
        !isAuthenticated
          ? "/signin"
          : user?.role === "teacher"
            ? "/teacher/dashboard"
            : "/signin",
      );
    }
  }, [isReady, isAuthenticated, user, router]);

  // Check for an existing active session in sessionStorage
  useEffect(() => {
    if (!isReady || !user) return;

    try {
      const savedSession = sessionStorage.getItem(STORAGE_KEY_STUDENT_SESSION);
      if (savedSession) {
        const parsed: SessionJoinResponse = JSON.parse(savedSession);
        getSessionStatus(parsed.session_id)
          .then((status) => {
            if (
              status.status === "ACTIVE" ||
              status.status === "WAITING" ||
              status.status === "GRACE"
            ) {
              setHasActiveSession(true);
            } else {
              sessionStorage.removeItem(STORAGE_KEY_STUDENT_SESSION);
              sessionStorage.removeItem(STORAGE_KEY_STUDENT_USER);
            }
          })
          .catch(() => {
            sessionStorage.removeItem(STORAGE_KEY_STUDENT_SESSION);
            sessionStorage.removeItem(STORAGE_KEY_STUDENT_USER);
          })
          .finally(() => setCheckingSession(false));
      } else {
        setCheckingSession(false);
      }
    } catch {
      setCheckingSession(false);
    }
  }, [isReady, user]);

  // Fetch available sessions
  const fetchAvailableSessions = useCallback(async () => {
    try {
      const sessions = await getAvailableSessions();
      setAvailableSessions(sessions);
    } catch (err) {
      console.error("Failed to fetch available sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Initial fetch + polling every 10 seconds
  useEffect(() => {
    if (!isReady || !user || hasActiveSession) return;

    fetchAvailableSessions();
    const interval = setInterval(fetchAvailableSessions, 10000);
    return () => clearInterval(interval);
  }, [isReady, user, hasActiveSession, fetchAvailableSessions]);

  const handleJoin = async (sessionId: string) => {
    setError(null);
    setJoiningSessionId(sessionId);

    try {
      const response: SessionJoinResponse = await joinSession(sessionId);

      const tutoringUser = {
        id: user!.id,
        email: user!.email,
        full_name: `${user!.first_name} ${user!.last_name}`,
        role: "STUDENT" as const,
        created_at: user!.date_joined,
      };

      sessionStorage.setItem(
        STORAGE_KEY_STUDENT_SESSION,
        JSON.stringify(response),
      );
      sessionStorage.setItem(
        STORAGE_KEY_STUDENT_USER,
        JSON.stringify(tutoringUser),
      );

      router.push("/student/tutoring/session");
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setJoiningSessionId(null);
    }
  };

  // Loading state
  if (!isReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
              Live Tutoring
            </h1>
            <p className="text-sm text-primary">
              Join a live tutoring session from your section
            </p>
          </div>
          {!hasActiveSession && (
            <button
              onClick={() => {
                setLoadingSessions(true);
                fetchAvailableSessions();
              }}
              disabled={loadingSessions}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingSessions ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-8 max-w-2xl mx-auto">
        {/* Active session - return to it */}
        {!checkingSession && hasActiveSession ? (
          <div className="bg-white rounded-2xl border border-secondary/30 p-10 shadow-sm flex flex-col items-center text-center">
            <div className="relative flex h-5 w-5 mb-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-primary-dark mb-1">
              Session in Progress
            </h2>
            <p className="text-sm text-muted mb-6">
              You are currently in an active tutoring session. Return to
              continue.
            </p>
            <button
              onClick={() => router.push("/student/tutoring/session")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow"
            >
              Go to Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : checkingSession ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          /* Available sessions list */
          <div className="space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {loadingSessions ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : availableSessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-secondary/30 p-10 text-center shadow-sm">
                <Video className="w-12 h-12 text-secondary mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-primary-dark mb-1">
                  No Live Sessions
                </h2>
                <p className="text-sm text-muted">
                  There are no live tutoring sessions for your section right now.
                  <br />
                  Check back later or wait for your teacher to start one.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">
                  {availableSessions.length} session
                  {availableSessions.length !== 1 ? "s" : ""} available for your
                  section
                </p>

                {availableSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-2xl border border-secondary/30 p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-primary-dark">
                          {session.class_name && session.section_name
                            ? `Class ${session.class_name} - Section ${session.section_name}`
                            : "Tutoring Session"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-3.5 h-3.5 text-muted" />
                          <span className="text-sm text-muted">
                            {session.teacher_name}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full ${
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

                    {/* Info */}
                    <div className="flex items-center gap-4 mb-5 text-xs text-muted">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {session.participant_count}{" "}
                          {session.participant_count === 1
                            ? "student"
                            : "students"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Started {formatTime(session.created_at)}</span>
                      </div>
                    </div>

                    {/* Join button */}
                    <button
                      onClick={() => handleJoin(session.id)}
                      disabled={joiningSessionId !== null}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {joiningSessionId === session.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <Video className="w-4 h-4" />
                          Join Session
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
