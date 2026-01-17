"use client";

/**
 * Teacher Dashboard Page (Phase 2 - WebSocket Version)
 *
 * Allows teachers to create and manage tutoring sessions.
 * Uses WebSocket for real-time updates instead of polling.
 * Phase 3: Audio-only WebRTC integration.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  Square,
  User,
  GraduationCap,
  Check,
  Circle,
} from "lucide-react";
import UserSelector from "@/components/tutoring/UserSelector";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import {
  ConnectionStatusBadge,
  ParticipantStatus,
} from "@/components/ConnectionStatus";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { MediaSession } from "@/components/MediaSession";
import {
  TutoringUser,
  SessionCreateResponse,
  createSession,
  endSession,
  getErrorMessage,
  ApiError,
} from "@/api/tutoring";
import {
  ParticipantEvent,
  StatusChangeEvent,
  SessionEndedEvent,
} from "@/lib/websocket";

// Inner component that uses WebSocket context
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

  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!sessionData.join_url) return;

    try {
      await navigator.clipboard.writeText(sessionData.join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Get effective status from WebSocket or fallback to initial
  const effectiveStatus = (sessionState?.status || sessionData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";
  const isActive = effectiveStatus === "ACTIVE";
  const isWaiting = effectiveStatus === "WAITING";

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Session Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Tutoring Session
          </h2>
          <div className="flex items-center gap-4">
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
                  Waiting for student to join...
                </p>
                <p className="text-sm text-yellow-600">
                  Share the link below with your student. You&apos;ll be
                  notified automatically when they join.
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
                  {sessionState?.student?.name
                    ? `${sessionState.student.name} has joined!`
                    : "Student has joined!"}
                </p>
                <p className="text-sm text-green-600">
                  The tutoring session is now active.
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
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Participants
          </label>
          <div className="space-y-2">
            <ParticipantStatus
              name={user.full_name}
              role="teacher"
              connected={isConnected}
            />
            {sessionState?.student ? (
              <ParticipantStatus
                name={sessionState.student.name}
                role="student"
                connected={sessionState.isStudentConnected}
              />
            ) : (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
                <GraduationCap className="w-6 h-6 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-400">
                    Waiting for student...
                  </p>
                  <p className="text-xs text-gray-400">Student</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Join Link */}
        {!isEnded && sessionData.join_url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share this link with your student:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={sessionData.join_url}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied!
                  </>
                ) : (
                  "Copy Link"
                )}
              </button>
            </div>
          </div>
        )}

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

        {/* Video + Audio Session - Phase 4 */}
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
      <div className="p-6 border-t border-gray-200 bg-gray-50">
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
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start New Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage keys for session persistence
const STORAGE_KEY_TEACHER_SESSION = "tutoring_teacher_session";
const STORAGE_KEY_TEACHER_USER = "tutoring_teacher_user";

// Helper functions for session persistence
function saveTeacherSession(
  sessionData: SessionCreateResponse,
  user: TutoringUser
) {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY_TEACHER_SESSION,
      JSON.stringify(sessionData)
    );
    localStorage.setItem(STORAGE_KEY_TEACHER_USER, JSON.stringify(user));
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
    const sessionStr = localStorage.getItem(STORAGE_KEY_TEACHER_SESSION);
    const userStr = localStorage.getItem(STORAGE_KEY_TEACHER_USER);
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
    localStorage.removeItem(STORAGE_KEY_TEACHER_SESSION);
    localStorage.removeItem(STORAGE_KEY_TEACHER_USER);
  }
}

// Main page component
export default function TeacherDashboardPage() {
  const [user, setUser] = useState<TutoringUser | null>(null);
  const [sessionData, setSessionData] = useState<SessionCreateResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const { sessionData: savedSession, user: savedUser } = loadTeacherSession();
    if (savedSession && savedUser) {
      setSessionData(savedSession);
      setUser(savedUser);
    }
    setIsRestoring(false);
  }, []);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (sessionData && user) {
      saveTeacherSession(sessionData, user);
    }
  }, [sessionData, user]);

  const handleUserChange = useCallback((selectedUser: TutoringUser | null) => {
    setUser(selectedUser);
    // Reset session state when user changes (but don't clear storage yet)
    setSessionData(null);
    setError(null);
  }, []);

  const handleCreateSession = async () => {
    if (!user) {
      setError("Please select a teacher user first");
      return;
    }

    if (user.role !== "TEACHER") {
      setError("Only teachers can create tutoring sessions");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: SessionCreateResponse = await createSession();
      setSessionData(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionData?.session_id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Pass the teacher_id from session creation to ensure authorization
      await endSession(sessionData.session_id, sessionData.teacher_id);
      // Session ended - WebSocket will receive the event
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    clearTeacherSession();
    setSessionData(null);
    setError(null);
  };

  // Event handlers for WebSocket events
  const handleParticipantJoined = useCallback((event: ParticipantEvent) => {
    console.log("Participant joined:", event);
    // Could add toast notification here
  }, []);

  const handleParticipantLeft = useCallback((event: ParticipantEvent) => {
    console.log("Participant left:", event);
    // Could add toast notification here
  }, []);

  const handleStatusChanged = useCallback((event: StatusChangeEvent) => {
    console.log("Status changed:", event);
    // Could add toast notification here
  }, []);

  const handleSessionEnded = useCallback((event: SessionEndedEvent) => {
    console.log("Session ended:", event);
    // Clear session storage when session ends
    clearTeacherSession();
    // Could add toast notification here
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Teacher Dashboard
              </h1>
              <p className="text-gray-500 mt-1">
                Create and manage tutoring sessions (Real-time)
              </p>
            </div>
            <UserSelector
              filterRole="TEACHER"
              onUserChange={handleUserChange}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading while restoring session */}
        {isRestoring ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading session...</p>
          </div>
        ) : /* Main Content */
        !user ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Select a Teacher
            </h2>
            <p className="text-gray-500">
              Choose a teacher account from the dropdown above to get started.
            </p>
          </div>
        ) : !sessionData ? (
          /* Create Session View */
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Start a New Tutoring Session
            </h2>
            <p className="text-gray-500 mb-6">
              Create a new session and share the link with your student.
            </p>
            <button
              onClick={handleCreateSession}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Session...
                </span>
              ) : (
                "Start New Tutoring Session"
              )}
            </button>
          </div>
        ) : (
          /* Session View with WebSocket */
          <SessionProvider
            sessionId={sessionData.session_id}
            userId={user.id}
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            onStatusChanged={handleStatusChanged}
            onSessionEnded={handleSessionEnded}
          >
            <SessionView
              sessionData={sessionData}
              user={user}
              onEndSession={handleEndSession}
              onNewSession={handleNewSession}
              isLoading={isLoading}
            />
          </SessionProvider>
        )}
      </div>
    </div>
  );
}
