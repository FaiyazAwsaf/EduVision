"use client";

/**
 * Student Join Page (Phase 2 - WebSocket Version)
 *
 * Allows students to join a tutoring session using the room ID.
 * Uses WebSocket for real-time updates instead of polling.
 * Phase 3: Audio-only WebRTC integration.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  User,
  GraduationCap,
  Link as LinkIcon,
  Square,
  Circle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import UserSelector from "@/components/tutoring/UserSelector";
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
  ApiError,
  joinSession,
  getErrorMessage,
} from "@/api/tutoring";
import { SessionEndedEvent } from "@/lib/websocket";

// Inner component that uses WebSocket context
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
    isConnected,
    isSessionEnded,
    error: wsError,
  } = useSession();

  // Get effective status from WebSocket or fallback to initial
  const effectiveStatus = (sessionState?.status || joinData.status) as
    | "WAITING"
    | "ACTIVE"
    | "GRACE"
    | "ENDED";
  const isEnded = effectiveStatus === "ENDED";

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Session Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Connected to Session
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
        {!isEnded && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Circle className="w-6 h-6 text-green-600 fill-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  Connected! Initializing video...
                </p>
                <p className="text-sm text-green-600">
                  You are now in a tutoring session with {joinData.teacher_name}
                  .
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
          <label className="block text-sm font-medium text-gray-700 mb-3">
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
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
            {joinData.teacher_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{joinData.teacher_name}</p>
            <p className="text-sm text-gray-500">Your Teacher</p>
          </div>
        </div>

        {/* Video + Audio Session - Phase 4 */}
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
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="text-center space-y-3">
          {!isEnded && (
            <button
              onClick={onLeaveSession}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Leave Session
            </button>
          )}
          {isEnded && (
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage keys for session persistence
const STORAGE_KEY_STUDENT_SESSION = "tutoring_student_session";
const STORAGE_KEY_STUDENT_USER = "tutoring_student_user";
const STORAGE_KEY_STUDENT_ROOM = "tutoring_student_room";

// Helper functions for session persistence
function saveStudentSession(
  joinData: SessionJoinResponse,
  user: TutoringUser,
  roomId: string,
) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_STUDENT_SESSION, JSON.stringify(joinData));
    localStorage.setItem(STORAGE_KEY_STUDENT_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_STUDENT_ROOM, roomId);
  }
}

function loadStudentSession(currentRoomId: string): {
  joinData: SessionJoinResponse | null;
  user: TutoringUser | null;
} {
  if (typeof window === "undefined") {
    return { joinData: null, user: null };
  }
  try {
    const savedRoom = localStorage.getItem(STORAGE_KEY_STUDENT_ROOM);
    console.log(
      "[Session Restore] Current room:",
      currentRoomId,
      "Saved room:",
      savedRoom,
    );
    // Only restore if it's the same room
    if (savedRoom !== currentRoomId) {
      console.log("[Session Restore] Room mismatch, not restoring");
      return { joinData: null, user: null };
    }
    const sessionStr = localStorage.getItem(STORAGE_KEY_STUDENT_SESSION);
    const userStr = localStorage.getItem(STORAGE_KEY_STUDENT_USER);
    const result = {
      joinData: sessionStr ? JSON.parse(sessionStr) : null,
      user: userStr ? JSON.parse(userStr) : null,
    };
    console.log("[Session Restore] Restored:", result.joinData ? "yes" : "no");
    return result;
  } catch (e) {
    console.error("[Session Restore] Error:", e);
    return { joinData: null, user: null };
  }
}

function clearStudentSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_STUDENT_SESSION);
    localStorage.removeItem(STORAGE_KEY_STUDENT_USER);
    localStorage.removeItem(STORAGE_KEY_STUDENT_ROOM);
  }
}

// Main page component
export default function StudentJoinPage() {
  const params = useParams();
  const roomId = params.room_id as string;

  const [user, setUser] = useState<TutoringUser | null>(null);
  const [joinData, setJoinData] = useState<SessionJoinResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const { joinData: savedSession, user: savedUser } =
      loadStudentSession(roomId);
    if (savedSession && savedUser) {
      setJoinData(savedSession);
      setUser(savedUser);
    }
    setIsRestoring(false);
  }, [roomId]);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (joinData && user && roomId) {
      saveStudentSession(joinData, user, roomId);
    }
  }, [joinData, user, roomId]);

  const handleUserChange = useCallback((selectedUser: TutoringUser | null) => {
    setUser(selectedUser);
    setJoinData(null);
    setError(null);
  }, []);

  const handleJoinSession = async () => {
    if (!user) {
      setError("Please select a student user first");
      return;
    }

    if (user.role !== "STUDENT") {
      setError("Only students can join tutoring sessions");
      return;
    }

    if (!roomId) {
      setError("Invalid room ID");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: SessionJoinResponse = await joinSession(roomId);
      console.log("[StudentJoin] Session joined:", response);
      console.log("[StudentJoin] LiveKit WS URL:", response.livekit_ws_url);
      console.log("[StudentJoin] Token:", response.token ? "present" : "null");
      setJoinData(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  // Event handlers for WebSocket events
  const handleSessionEnded = useCallback((event: SessionEndedEvent) => {
    console.log("Session ended:", event);
    // Clear session storage when session ends
    clearStudentSession();
    // Could add toast notification here
  }, []);

  // Handle student leaving the session
  const handleLeaveSession = useCallback(() => {
    console.log("Student leaving session");
    // Clear session storage
    clearStudentSession();
    // Reset state to show user selection again
    setJoinData(null);
    setUser(null);
    // WebSocket will automatically disconnect when SessionProvider unmounts
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Join Tutoring Session
              </h1>
              <p className="text-gray-500 mt-1">
                Connect with your teacher (Real-time)
              </p>
            </div>
            <UserSelector
              filterRole="STUDENT"
              onUserChange={handleUserChange}
            />
          </div>
        </div>

        {/* Room ID Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-500" />
            <p className="text-blue-700">
              <span className="font-medium">Room ID:</span>{" "}
              <span className="font-mono">{roomId}</span>
            </p>
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
            <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading session...</p>
          </div>
        ) : /* Main Content */
        !user ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Select a Student Account
            </h2>
            <p className="text-gray-500">
              Choose a student account from the dropdown above to join.
            </p>
          </div>
        ) : !joinData ? (
          /* Join View */
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Ready to Join?
            </h2>
            <p className="text-gray-500 mb-6">
              Click below to join the tutoring session with your teacher.
            </p>
            <button
              onClick={handleJoinSession}
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
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
                  Joining...
                </span>
              ) : (
                "Join Session"
              )}
            </button>
          </div>
        ) : (
          /* Session View with WebSocket */
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
        )}
      </div>
    </div>
  );
}
