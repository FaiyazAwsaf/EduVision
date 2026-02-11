"use client";

/**
 * Teacher Session Page
 *
 * Displays the active tutoring session for a teacher.
 * Shows a participant list with online/offline indicators for all students.
 * Session info includes section name, participant count, and session controls.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Square,
  GraduationCap,
  Circle,
  ArrowLeft,
  Users,
  User,
} from "lucide-react";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import { ConnectionStatusBadge } from "@/components/tutoring/ConnectionStatus";
import {
  SessionProvider,
  useSession,
  type SessionParticipant,
} from "@/contexts/SessionContext";
import { MediaSession } from "@/components/tutoring/media/MediaSession";
import {
  TutoringUser,
  SessionCreateResponse,
  endSession,
  getErrorMessage,
  ApiError,
} from "@/api/tutoring";
import {
  ParticipantEvent,
  StatusChangeEvent,
  SessionEndedEvent,
} from "@/lib/websocket";
import { useAuth } from "@/contexts/AuthContext";

// ─── Inner SessionView component ──────────────────────────────────────────────

function SessionView({
  sessionData,
  user,
  onEndSession,
  onNewSession,
  isLoading,
}: {
  sessionData: SessionCreateResponse;
  user: TutoringUser;
  onEndSession: () => void;
  onNewSession: () => void;
  isLoading: boolean;
}) {
  const {
    sessionState,
    connectionState,
    isConnected,
    isSessionActive,
    isSessionEnded,
    error: wsError,
  } = useSession();

  const effectiveStatus = (sessionState?.status || sessionData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";
  const isActive = effectiveStatus === "ACTIVE";
  const isWaiting = effectiveStatus === "WAITING";

  const participants: SessionParticipant[] =
    sessionState?.participants || [];
  const onlineCount = participants.filter((p) => p.connected).length;

  return (
    <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
      {/* Session Header */}
      <div className="p-6 border-b border-secondary/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">
              Tutoring Session
            </h2>
            {sessionData.section_name && (
              <p className="text-sm text-muted mt-0.5">
                Class {sessionData.class_name} - Section{" "}
                {sessionData.section_name}
              </p>
            )}
          </div>
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

        {/* Status Message */}
        {isWaiting && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  Waiting for students to join...
                </p>
                <p className="text-sm text-yellow-600">
                  Students from the selected section will see this session and
                  can join automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {isActive && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Circle className="w-6 h-6 text-green-600 fill-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  Session Active - {participants.length}{" "}
                  {participants.length === 1 ? "student" : "students"} joined
                </p>
                <p className="text-sm text-green-600">
                  {onlineCount} currently online
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
                  You can start a new session anytime.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Participants */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-primary-dark">
              Participants
            </label>
            <span className="text-xs text-muted">
              {participants.length}{" "}
              {participants.length === 1 ? "student" : "students"}
              {onlineCount > 0 && ` (${onlineCount} online)`}
            </span>
          </div>
          <div className="space-y-2">
            {/* Teacher (self) */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-green-50 border-green-200">
              <User className="w-6 h-6" style={{ color: "#48A6A7" }} />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{user.full_name}</p>
                <p className="text-xs text-gray-500">Teacher</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600">Online</span>
              </div>
            </div>

            {/* Student Participants */}
            {participants.length > 0 ? (
              participants.map((p) => {
                const statusColor = p.connected
                  ? "bg-green-500"
                  : "bg-gray-400";
                const bgColor = p.connected ? "bg-green-50" : "bg-gray-50";
                const borderColor = p.connected
                  ? "border-green-200"
                  : "border-gray-200";

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${bgColor} ${borderColor}`}
                  >
                    <GraduationCap
                      className="w-6 h-6"
                      style={{ color: "#48A6A7" }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">Student</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${statusColor}`}
                      />
                      <span className="text-xs text-gray-600">
                        {p.connected ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
                <GraduationCap className="w-6 h-6 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-400">
                    Waiting for students...
                  </p>
                  <p className="text-xs text-gray-400">
                    Students from the section will appear here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Session ID
            </label>
            <p className="text-sm text-gray-700 font-mono">
              {sessionData.session_id?.substring(0, 8)}...
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Room ID
            </label>
            <p className="text-sm text-gray-700 font-mono">
              {sessionData.room_id?.substring(0, 20)}...
            </p>
          </div>
        </div>

        {/* Media Session */}
        {!isEnded && (
          <MediaSession
            wsUrl={sessionData.livekit_ws_url}
            token={sessionData.token}
            role="teacher"
            sessionId={sessionData.session_id}
          />
        )}
      </div>

      {/* Session Actions */}
      <div className="p-6 border-t border-secondary/20 bg-background/30">
        <div className="flex items-center justify-end gap-3">
          {!isEnded ? (
            <button
              onClick={onEndSession}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Ending..." : "End Session"}
            </button>
          ) : (
            <button
              onClick={onNewSession}
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Start New Session
            </button>
          )}
        </div>
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
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    clearTeacherSession();
    router.push("/teacher/dashboard");
  };

  const handleBack = () => {
    router.push("/teacher/dashboard");
  };

  const handleSessionEnded = useCallback(
    (event: SessionEndedEvent) => {
      console.log("Session ended:", event);
      clearTeacherSession();
      router.push("/teacher/dashboard");
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
              Logged in as{" "}
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
            <p className="text-muted">Loading session...</p>
          </div>
        ) : sessionData ? (
          <SessionProvider
            sessionId={sessionData.session_id}
            userId={user!.id}
            onSessionEnded={handleSessionEnded}
          >
            <SessionView
              sessionData={sessionData}
              user={user!}
              onEndSession={handleEndSession}
              onNewSession={handleNewSession}
              isLoading={isLoading}
            />
          </SessionProvider>
        ) : null}
      </main>
    </div>
  );
}
