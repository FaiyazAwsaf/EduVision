"use client";

/**
 * Student Session Page - Google Meet-style layout
 *
 * Full-screen session view with a slim top bar, MediaSession filling the viewport,
 * and integrated control bar / participant panel.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import { ConnectionStatusBadge } from "@/components/tutoring/ConnectionStatus";
import {
  SessionProvider,
  useSession,
} from "@/contexts/SessionContext";
import { MediaSession } from "@/components/tutoring/media/MediaSession";
import {
  TutoringUser,
  SessionJoinResponse,
  leaveSession,
  getErrorMessage,
  ApiError,
} from "@/api/tutoring";
import { SessionEndedEvent } from "@/lib/websocket";
import { useAuth } from "@/contexts/AuthContext";

// ─── Storage helpers ──────────────────────────────────────────────────────────

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

// ─── Inner SessionView (uses WebSocket context) ───────────────────────────────

function SessionView({
  joinData,
  user,
  onLeaveSession,
}: {
  joinData: SessionJoinResponse;
  user: TutoringUser;
  onLeaveSession: () => void;
}) {
  const router = useRouter();
  const {
    sessionState,
    connectionState,
    isSessionEnded,
    error: wsError,
  } = useSession();

  const [isLeaving, setIsLeaving] = useState(false);

  const effectiveStatus = (sessionState?.status || joinData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";

  const sectionLabel = joinData.section_name
    ? `Class ${joinData.class_name} - Section ${joinData.section_name}`
    : "Tutoring Session";

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveSession(joinData.session_id);
    } catch {
      // Ignore errors on leave
    }
    onLeaveSession();
  };

  // If session ended, show a return screen
  if (isEnded) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F2EFE7" }}
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#9ACBD0" }}>
            <ArrowLeft className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#006A71" }}>
            Session Ended
          </h2>
          <p className="mb-6" style={{ color: "#48A6A7" }}>
            The teacher has ended this tutoring session.
          </p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="px-6 py-2.5 text-white font-medium rounded-full transition-colors"
            style={{ backgroundColor: "#48A6A7" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#006A71")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#48A6A7")}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundColor: "#F2EFE7" }}
    >
      {/* Slim top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          backgroundColor: "#ffffff",
          borderColor: "#9ACBD0",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/student/dashboard")}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: "#006A71" }}
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium" style={{ color: "#006A71" }}>{sectionLabel}</span>
          <span className="text-xs" style={{ color: "#48A6A7" }}>
            with {joinData.teacher_name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatusBadge state={connectionState} showLabel={false} />
          <SessionStatusBadge status={effectiveStatus} />
        </div>
      </div>

      {/* WS error banner */}
      {wsError && (
        <div className="mx-2 mt-1 px-3 py-1.5 rounded flex items-center gap-2 bg-red-50 border border-red-300">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{wsError}</span>
        </div>
      )}

      {/* Media fills remaining space */}
      <div className="flex-1 min-h-0">
        <MediaSession
          wsUrl={joinData.livekit_ws_url}
          token={joinData.token}
          role="student"
          userName={user.full_name}
          sessionLabel={sectionLabel}
          onLeaveSession={handleLeave}
        />
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

  // Role guard
  useEffect(() => {
    if (isReady && (!isAuthenticated || authUser?.role !== "student")) {
      router.replace(
        authUser?.role === "teacher" ? "/teacher/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, authUser, router]);

  // Restore session from sessionStorage on mount
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

  const handleSessionEnded = useCallback(
    (event: SessionEndedEvent) => {
      clearStudentSession();
      router.push("/student/dashboard");
    },
    [router],
  );

  // Loading state
  if (isRestoring) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F2EFE7" }}
      >
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#48A6A7" }} />
          <p style={{ color: "#006A71" }}>Loading session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F2EFE7" }}
      >
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="px-5 py-2 text-white rounded-full transition-colors"
            style={{ backgroundColor: "#48A6A7" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#006A71")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#48A6A7")}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!joinData || !user) return null;

  return (
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
  );
}
