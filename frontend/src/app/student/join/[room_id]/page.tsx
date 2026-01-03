"use client";

/**
 * Student Join Page
 *
 * Allows students to join a tutoring session using the room ID.
 * Handles all error cases with specific messages.
 */

import React, { useState, useCallback, useEffect } from "react";
import { GraduationCap, User, Link as LinkIcon, Video, AlertTriangle, Circle } from "lucide-react";
import { useParams } from "next/navigation";
import UserSelector from "@/components/tutoring/UserSelector";
import SessionStatus from "@/components/tutoring/SessionStatus";
import {
  TutoringUser,
  SessionJoinResponse,
  SessionStatus as SessionStatusType,
  ApiError,
  joinSession,
  getSessionStatus,
  getErrorMessage,
} from "@/api/tutoring";

interface JoinState {
  session_id: string | null;
  token: string | null;
  status: "idle" | "joining" | "connected" | "error";
  teacher_name: string | null;
  livekit_ws_url: string | null;
  session_status: "WAITING" | "ACTIVE" | "GRACE" | "ENDED" | null;
}

export default function StudentJoinPage() {
  const params = useParams();
  const roomId = params.room_id as string;

  const [user, setUser] = useState<TutoringUser | null>(null);
  const [joinState, setJoinState] = useState<JoinState>({
    session_id: null,
    token: null,
    status: "idle",
    teacher_name: null,
    livekit_ws_url: null,
    session_status: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUserChange = useCallback((selectedUser: TutoringUser | null) => {
    setUser(selectedUser);
    // Reset state when user changes
    setJoinState({
      session_id: null,
      token: null,
      status: "idle",
      teacher_name: null,
      livekit_ws_url: null,
      session_status: null,
    });
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
    setJoinState((prev) => ({ ...prev, status: "joining" }));

    try {
      const response: SessionJoinResponse = await joinSession(roomId);

      setJoinState({
        session_id: response.session_id,
        token: response.token,
        status: "connected",
        teacher_name: response.teacher_name,
        livekit_ws_url: response.livekit_ws_url,
        session_status: response.status as "ACTIVE",
      });
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
      setJoinState((prev) => ({ ...prev, status: "error" }));
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for session status updates when connected
  useEffect(() => {
    if (!joinState.session_id || joinState.status !== "connected") return;

    const interval = setInterval(async () => {
      try {
        const status = await getSessionStatus(joinState.session_id!);
        setJoinState((prev) => ({
          ...prev,
          session_status: status.status,
        }));

        // Stop polling if session ended
        if (status.status === "ENDED") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to poll session status:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [joinState.session_id, joinState.status]);

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
                Connect with your teacher for a one-on-one session
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

        {/* Main Content */}
        {!user ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Select a Student Account
            </h2>
            <p className="text-gray-500">
              Choose a student account from the dropdown above to join.
            </p>
          </div>
        ) : joinState.status === "idle" || joinState.status === "error" ? (
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
        ) : joinState.status === "joining" ? (
          /* Joining View */
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4 animate-pulse">⏳</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Connecting...
            </h2>
            <p className="text-gray-500">
              Please wait while we connect you to the session.
            </p>
          </div>
        ) : (
          /* Connected View */
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Session Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Connected to Session
                </h2>
                {joinState.session_status && (
                  <SessionStatus status={joinState.session_status} />
                )}
              </div>
            </div>

            {/* Session Details */}
            <div className="p-6 space-y-6">
              {/* Status Message */}
              {joinState.session_status === "ACTIVE" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Circle className="w-6 h-6 text-green-600 fill-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        Connected! Initializing video...
                      </p>
                      <p className="text-sm text-green-600">
                        You are now in a tutoring session with{" "}
                        {joinState.teacher_name}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {joinState.session_status === "ENDED" && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏹️</span>
                    <div>
                      <p className="font-medium text-gray-800">
                        Session has ended
                      </p>
                      <p className="text-sm text-gray-600">
                        The teacher has ended this tutoring session.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Teacher Info */}
              {joinState.teacher_name && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                    {joinState.teacher_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {joinState.teacher_name}
                    </p>
                    <p className="text-sm text-gray-500">Your Teacher</p>
                  </div>
                </div>
              )}

              {/* Video Placeholder */}
              <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Video className="w-16 h-16 mx-auto mb-4" />
                  <p>Video will appear here in Phase 3</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info (Development) */}
        {joinState.token && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Debug Info (Development Only)
            </h3>
            <div className="space-y-2 text-xs font-mono text-gray-500">
              <p>
                <span className="text-gray-400">Session ID:</span>{" "}
                {joinState.session_id}
              </p>
              <p>
                <span className="text-gray-400">Token:</span>{" "}
                {joinState.token.substring(0, 50)}...
              </p>
              {joinState.livekit_ws_url && (
                <p>
                  <span className="text-gray-400">WebSocket URL:</span>{" "}
                  {joinState.livekit_ws_url}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
