"use client";

/**
 * Teacher Session Page - Google Meet-style layout
 *
 * Full-screen session view with a slim top bar, MediaSession filling the viewport,
 * and integrated control bar / participant panel.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import { ConnectionStatusBadge } from "@/components/tutoring/ConnectionStatus";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { MediaSession } from "@/components/tutoring/media/MediaSession";
import {
  TutoringUser,
  SessionCreateResponse,
  endSession,
  getErrorMessage,
  ApiError,
} from "@/api/tutoring";
import { SessionEndedEvent } from "@/lib/websocket";
import { useAuth } from "@/contexts/AuthContext";

// ─── Inner SessionView (uses WebSocket context) ───────────────────────────────

function SessionView({
  sessionData,
  user,
  onEndSession,
  isLoading,
}: {
  sessionData: SessionCreateResponse;
  user: TutoringUser;
  onEndSession: () => void;
  isLoading: boolean;
}) {
  const router = useRouter();
  const {
    sessionState,
    connectionState,
    isSessionEnded,
    error: wsError,
  } = useSession();

  const effectiveStatus = (sessionState?.status || sessionData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";

  const sectionLabel = sessionData.section_name
    ? `Class ${sessionData.class_name} - Section ${sessionData.section_name}`
    : "Tutoring Session";

  // If session ended, show a return screen
  if (isEnded) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F2EFE7" }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "#9ACBD0" }}
          >
            <ArrowLeft className="w-8 h-8 text-white" />
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: "#006A71" }}
          >
            Session Ended
          </h2>
          <p className="mb-6" style={{ color: "#48A6A7" }}>
            The tutoring session has ended.
          </p>
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="px-6 py-2.5 text-white font-medium rounded-full transition-colors"
            style={{ backgroundColor: "#48A6A7" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#006A71")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#48A6A7")
            }
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
            onClick={() => router.push("/teacher/dashboard")}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: "#006A71" }}
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium" style={{ color: "#006A71" }}>
            {sectionLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatusBadge state={connectionState} showLabel={false} />
          <SessionStatusBadge status={effectiveStatus} />
        </div>
      </div>

      {/* Media fills remaining space */}
      <div className="flex-1 min-h-0">
        <MediaSession
          wsUrl={sessionData.livekit_ws_url}
          token={sessionData.token}
          role="teacher"
          userName={user.full_name}
          sessionLabel={sectionLabel}
          onEndSession={onEndSession}
        />
      </div>
    </div>
  );
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY_TEACHER_SESSION = "tutoring_teacher_session";
const STORAGE_KEY_TEACHER_USER = "tutoring_teacher_user";

function saveTeacherSession(
  sessionData: SessionCreateResponse,
  user: TutoringUser,
) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      STORAGE_KEY_TEACHER_SESSION,
      JSON.stringify(sessionData),
    );
    sessionStorage.setItem(STORAGE_KEY_TEACHER_USER, JSON.stringify(user));
  }
}

function loadTeacherSession(): {
  sessionData: SessionCreateResponse | null;
  user: TutoringUser | null;
} {
  if (typeof window === "undefined") {
    return { sessionData: null, user: null };
  }
  try {
    const sessionStr = sessionStorage.getItem(STORAGE_KEY_TEACHER_SESSION);
    const userStr = sessionStorage.getItem(STORAGE_KEY_TEACHER_USER);
    return {
      sessionData: sessionStr ? JSON.parse(sessionStr) : null,
      user: userStr ? JSON.parse(userStr) : null,
    };
  } catch {
    return { sessionData: null, user: null };
  }
}

function clearTeacherSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY_TEACHER_SESSION);
    sessionStorage.removeItem(STORAGE_KEY_TEACHER_USER);
  }
}

// ─── Main page component ─────────────────────────────────────────────────────

export default function TeacherSessionPage() {
  const router = useRouter();
  const { user: authUser, isReady, isAuthenticated } = useAuth();
  const [user, setUser] = useState<TutoringUser | null>(null);
  const [sessionData, setSessionData] = useState<SessionCreateResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Role guard
  useEffect(() => {
    if (isReady && (!isAuthenticated || authUser?.role !== "teacher")) {
      router.replace(
        authUser?.role === "student" ? "/student/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, authUser, router]);

  // Restore session on mount
  useEffect(() => {
    const { sessionData: savedSession, user: savedUser } = loadTeacherSession();
    if (savedSession && savedUser) {
      setSessionData(savedSession);
      setUser(savedUser);
      setIsRestoring(false);
    } else {
      router.replace("/teacher/dashboard");
    }
  }, [router]);

  // Persist session changes
  useEffect(() => {
    if (sessionData && user) {
      saveTeacherSession(sessionData, user);
    }
  }, [sessionData, user]);

  const handleEndSession = async () => {
    if (!sessionData?.session_id) return;
    setIsLoading(true);
    setError(null);
    try {
      await endSession(sessionData.session_id);
      clearTeacherSession();
      router.push("/teacher/dashboard");
    } catch (err) {
      setError(getErrorMessage(err as ApiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionEnded = useCallback(
    (event: SessionEndedEvent) => {
      clearTeacherSession();
      router.push("/teacher/dashboard");
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
          <Loader2
            className="w-10 h-10 animate-spin mx-auto mb-4"
            style={{ color: "#48A6A7" }}
          />
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
            onClick={() => router.push("/teacher/dashboard")}
            className="px-5 py-2 text-white rounded-full transition-colors"
            style={{ backgroundColor: "#48A6A7" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#006A71")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#48A6A7")
            }
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData || !user) return null;

  return (
    <SessionProvider
      sessionId={sessionData.session_id}
      userId={user.id}
      onSessionEnded={handleSessionEnded}
    >
      <SessionView
        sessionData={sessionData}
        user={user}
        onEndSession={handleEndSession}
        isLoading={isLoading}
      />
    </SessionProvider>
  );
}
