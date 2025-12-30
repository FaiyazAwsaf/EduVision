"use client";

/**
 * Student Join Page (Phase 2 - WebSocket Version)
 *
 * Allows students to join a tutoring session using the room ID.
 * Uses WebSocket for real-time updates instead of polling.
 */

import React, { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import UserSelector from "@/components/tutoring/UserSelector";
import SessionStatusBadge from "@/components/tutoring/SessionStatus";
import {
  ConnectionStatusBadge,
  ParticipantStatus,
} from "@/components/ConnectionStatus";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
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
}: {
  joinData: SessionJoinResponse;
  user: TutoringUser;
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
              <span className="text-red-500">⚠️</span>
              <p className="text-red-700">{wsError}</p>
            </div>
          </div>
        )}

        {/* Status Message */}
        {!isEnded && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🟢</span>
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
              <span className="text-2xl">⏹️</span>
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

        {/* Video Placeholder */}
        <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-5xl mb-4">📹</div>
            <p>Video will appear here in Phase 3</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isEnded && (
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main page component
export default function StudentJoinPage() {
  const params = useParams();
  const roomId = params.room_id as string;

  const [user, setUser] = useState<TutoringUser | null>(null);
  const [joinData, setJoinData] = useState<SessionJoinResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // Could add toast notification here
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
            <span className="text-blue-500">🔗</span>
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
              <span className="text-red-500">⚠️</span>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!user ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">👤</div>
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
            <div className="text-gray-400 text-5xl mb-4">🎓</div>
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
            <SessionView joinData={joinData} user={user} />
          </SessionProvider>
        )}

        {/* Debug Info (Development) */}
        {joinData?.token && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Debug Info (Development Only)
            </h3>
            <div className="space-y-2 text-xs font-mono text-gray-500">
              <p>
                <span className="text-gray-400">Session ID:</span>{" "}
                {joinData.session_id}
              </p>
              <p>
                <span className="text-gray-400">Token:</span>{" "}
                {joinData.token.substring(0, 50)}...
              </p>
              {joinData.livekit_ws_url && (
                <p>
                  <span className="text-gray-400">LiveKit URL:</span>{" "}
                  {joinData.livekit_ws_url}
                </p>
              )}
              <p>
                <span className="text-gray-400">WebSocket:</span>{" "}
                ws://localhost:8000/ws/tutoring/{joinData.session_id}/
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
