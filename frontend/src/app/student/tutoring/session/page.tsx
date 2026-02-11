"use client";

/**
 * Student Session Page
 *
 * Displays the active tutoring session for a student.
 * Redirects to /student/tutoring if no session data is found.
 * Includes a back button to return to the student dashboard.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Square, Circle, ArrowLeft } from "lucide-react";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import {
  ConnectionStatusBadge,
  ParticipantStatus,
} from "@/components/tutoring/ConnectionStatus";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { MediaSession } from "@/components/tutoring/media/MediaSession";
import {
  TutoringUser,
  SessionJoinResponse,
  getErrorMessage,
  ApiError,
} from "@/api/tutoring";
import { SessionEndedEvent } from "@/lib/websocket";
import { useAuth } from "@/contexts/AuthContext";

// ─── Storage keys (shared with tutoring page) ────────────────────────────────

const STORAGE_KEY_STUDENT_SESSION = "tutoring_student_session_data";
const STORAGE_KEY_STUDENT_USER = "tutoring_student_user_data";

function loadStudentSession(): {
  joinData: SessionJoinResponse | null;
  user: TutoringUser | null;
} {
  if (typeof window === "undefined") {
    return { joinData: null, user: null };
  }
  try {
    const sessionStr = sessionStorage.getItem(STORAGE_KEY_STUDENT_SESSION);
    const userStr = sessionStorage.getItem(STORAGE_KEY_STUDENT_USER);
    return {
      joinData: sessionStr ? JSON.parse(sessionStr) : null,
      user: userStr ? JSON.parse(userStr) : null,
    };
  } catch {
    return { joinData: null, user: null };
  }
}

function clearStudentSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY_STUDENT_SESSION);
    sessionStorage.removeItem(STORAGE_KEY_STUDENT_USER);
  }
}

// ─── Inner SessionView component (uses WebSocket context) ────────────────────

function SessionView({
  joinData,
  user,
  onLeaveSession,
}: {
  joinData: SessionJoinResponse;
  user: TutoringUser;
  onLeaveSession: () => void;
}) {
  const {
    sessionState,
    connectionState,
    isConnected,
    isSessionEnded,
    error: wsError,
  } = useSession();

  const effectiveStatus = (sessionState?.status || joinData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";

  return (
    <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
      {/* Session Header */}
      <div className="p-6 border-b border-secondary/20">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-dark">
            Connected to Session
          </h2>
          <div className="flex items-center gap-3">
            <ConnectionStatusBadge state={connectionState} showLabel={true} />
            <SessionStatusBadge status={effectiveStatus} />
          </div>
        </div>
      </div>

      {/* Session Details */}
      <div className="p-6 space-y-6">
        {/* WebSocket Error */}
        {wsError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{wsError}</p>
            </div>
          </div>
        )}

        {/* Status messages */}
        {!isEnded && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Circle className="w-6 h-6 text-green-600 fill-green-600" />
              <div>
                <p className="font-medium text-green-800">Session Active</p>
                <p className="text-sm text-green-600">
                  You are in a tutoring session with {joinData.teacher_name}.
                </p>
              </div>
            </div>
          </div>
        )}

        {isEnded && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Square className="w-6 h-6 text-gray-600 fill-gray-600" />
              <div>
                <p className="font-medium text-gray-800">Session has ended</p>
                <p className="text-sm text-gray-600">
                  The teacher has ended this tutoring session.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-3">
            Participants
          </label>
          <div className="space-y-2">
            <ParticipantStatus
              name={sessionState?.teacher?.name || joinData.teacher_name}
              role="teacher"
              connected={sessionState?.isTeacherConnected || false}
            />
            <ParticipantStatus
              name={user.full_name}
              role="student"
              connected={isConnected}
            />
          </div>
        </div>

        {/* Teacher Info */}
        <div className="flex items-center gap-4 p-4 bg-background/60 rounded-lg">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white text-xl font-semibold">
            {joinData.teacher_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-primary-dark">
              {joinData.teacher_name}
            </p>
            <p className="text-sm text-muted">Your Teacher</p>
          </div>
        </div>

        {/* Media Session */}
        {!isEnded && (
          <MediaSession
            wsUrl={joinData.livekit_ws_url}
            token={joinData.token}
            role="student"
            sessionId={joinData.session_id}
          />
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-secondary/20 bg-background/30">
        <div className="flex justify-end">
          <button
            onClick={onLeaveSession}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            {isEnded ? "Return to Dashboard" : "Leave Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function StudentSessionPage() {
  const router = useRouter();
  const { user: authUser, isReady, isAuthenticated } = useAuth();
  const [user, setUser] = useState<TutoringUser | null>(null);
  const [joinData, setJoinData] = useState<SessionJoinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Role guard: only students can access
  useEffect(() => {
    if (isReady && (!isAuthenticated || authUser?.role !== "student")) {
      router.replace(
        authUser?.role === "teacher" ? "/teacher/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, authUser, router]);

  // Restore session from sessionStorage on mount.
  // If no session data exists, redirect to the tutoring join page.
  useEffect(() => {
    const { joinData: savedSession, user: savedUser } = loadStudentSession();
    if (savedSession && savedUser) {
      setJoinData(savedSession);
      setUser(savedUser);
      setIsRestoring(false);
    } else {
      router.replace("/student/tutoring");
    }
  }, [router]);

  const handleLeaveSession = useCallback(() => {
    clearStudentSession();
    router.push("/student/dashboard");
  }, [router]);

  const handleBack = () => {
    router.push("/student/dashboard");
  };

  const handleSessionEnded = useCallback(
    (event: SessionEndedEvent) => {
      console.log("Session ended:", event);
      clearStudentSession();
      router.push("/student/dashboard");
    },
    [router],
  );

  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-muted hover:text-primary-dark hover:bg-background transition-colors"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                Live Session
              </h1>
              <p className="text-sm text-primary">
                Tutoring session in progress
              </p>
            </div>
          </div>
          {user && (
            <div className="text-sm text-muted">
              Joined as{" "}
              <span className="font-semibold text-primary-dark">
                {user.full_name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-6 max-w-4xl mx-auto">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isRestoring ? (
          <div className="bg-white rounded-2xl border border-secondary/30 p-8 text-center shadow-sm">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted">Loading session…</p>
          </div>
        ) : joinData && user ? (
          <SessionProvider
            sessionId={joinData.session_id}
            userId={user.id}
            onSessionEnded={handleSessionEnded}
          >
            <SessionView
              joinData={joinData}
              user={user}
              onLeaveSession={handleLeaveSession}
            />
          </SessionProvider>
        ) : null}
      </main>
    </div>
  );
}
