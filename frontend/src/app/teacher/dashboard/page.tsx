"use client";

/**
 * Teacher Dashboard Page
 *
 * Allows teachers to create and manage tutoring sessions.
 * Displays session information including the shareable join link.
 */

import React, { useState, useCallback } from "react";
import UserSelector from "@/components/tutoring/UserSelector";
import SessionStatus from "@/components/tutoring/SessionStatus";
import {
  TutoringUser,
  SessionCreateResponse,
  SessionStatus as SessionStatusType,
  ApiError,
  createSession,
  endSession,
  getSessionStatus,
  getErrorMessage,
} from "@/api/tutoring";

interface SessionState {
  session_id: string | null;
  room_id: string | null;
  token: string | null;
  status: "idle" | "waiting" | "active" | "ended";
  join_url: string | null;
  livekit_ws_url: string | null;
}

export default function TeacherDashboardPage() {
  const [user, setUser] = useState<TutoringUser | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    session_id: null,
    room_id: null,
    token: null,
    status: "idle",
    join_url: null,
    livekit_ws_url: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Poll for session status updates
  const [pollingInterval, setPollingIntervalState] =
    useState<NodeJS.Timeout | null>(null);

  const handleUserChange = useCallback((selectedUser: TutoringUser | null) => {
    setUser(selectedUser);
    // Reset session state when user changes
    setSessionState({
      session_id: null,
      room_id: null,
      token: null,
      status: "idle",
      join_url: null,
      livekit_ws_url: null,
    });
    setError(null);
  }, []);

  const startPolling = useCallback(
    (sessionId: string) => {
      // Clear any existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      const interval = setInterval(async () => {
        try {
          const status = await getSessionStatus(sessionId);
          setSessionState((prev) => ({
            ...prev,
            status:
              status.status === "WAITING"
                ? "waiting"
                : status.status === "ACTIVE"
                ? "active"
                : status.status === "ENDED"
                ? "ended"
                : prev.status,
          }));

          // Stop polling if session is active or ended
          if (status.status === "ACTIVE" || status.status === "ENDED") {
            clearInterval(interval);
            setPollingIntervalState(null);
          }
        } catch (err) {
          console.error("Failed to poll session status:", err);
        }
      }, 3000);

      setPollingIntervalState(interval);
    },
    [pollingInterval]
  );

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

      setSessionState({
        session_id: response.session_id,
        room_id: response.room_id,
        token: response.token,
        status: "waiting",
        join_url: response.join_url,
        livekit_ws_url: response.livekit_ws_url,
      });

      // Start polling for status updates
      startPolling(response.session_id);
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionState.session_id) return;

    setIsLoading(true);
    setError(null);

    try {
      await endSession(sessionState.session_id);
      setSessionState((prev) => ({
        ...prev,
        status: "ended",
      }));

      // Stop polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingIntervalState(null);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(getErrorMessage(apiError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!sessionState.join_url) return;

    try {
      await navigator.clipboard.writeText(sessionState.join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleNewSession = () => {
    // Stop polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingIntervalState(null);
    }

    setSessionState({
      session_id: null,
      room_id: null,
      token: null,
      status: "idle",
      join_url: null,
      livekit_ws_url: null,
    });
    setError(null);
  };

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
                Create and manage tutoring sessions
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
              Select a Teacher
            </h2>
            <p className="text-gray-500">
              Choose a teacher account from the dropdown above to get started.
            </p>
          </div>
        ) : sessionState.status === "idle" ? (
          /* Create Session View */
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">🎓</div>
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
          /* Active Session View */
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Session Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Tutoring Session Active
                </h2>
                <SessionStatus
                  status={
                    sessionState.status === "waiting"
                      ? "WAITING"
                      : sessionState.status === "active"
                      ? "ACTIVE"
                      : "ENDED"
                  }
                />
              </div>
            </div>

            {/* Session Details */}
            <div className="p-6 space-y-6">
              {/* Status Message */}
              {sessionState.status === "waiting" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <p className="font-medium text-yellow-800">
                        Waiting for student to join...
                      </p>
                      <p className="text-sm text-yellow-600">
                        Share the link below with your student.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {sessionState.status === "active" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🟢</span>
                    <div>
                      <p className="font-medium text-green-800">
                        Student has joined!
                      </p>
                      <p className="text-sm text-green-600">
                        The tutoring session is now active.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {sessionState.status === "ended" && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏹️</span>
                    <div>
                      <p className="font-medium text-gray-800">
                        Session has ended
                      </p>
                      <p className="text-sm text-gray-600">
                        You can start a new session anytime.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Join Link */}
              {sessionState.status !== "ended" && sessionState.join_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Share this link with your student:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={sessionState.join_url}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <span>✓</span> Copied!
                        </>
                      ) : (
                        <>
                          <span>📋</span> Copy Link
                        </>
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
                    {sessionState.session_id?.substring(0, 8)}...
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Room ID
                  </label>
                  <p className="text-sm text-gray-700 font-mono">
                    {sessionState.room_id?.substring(0, 20)}...
                  </p>
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

            {/* Session Actions */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end gap-3">
                {sessionState.status !== "ended" ? (
                  <button
                    onClick={handleEndSession}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? "Ending..." : "End Session"}
                  </button>
                ) : (
                  <button
                    onClick={handleNewSession}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Start New Session
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Debug Info (Development) */}
        {sessionState.token && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Debug Info (Development Only)
            </h3>
            <div className="space-y-2 text-xs font-mono text-gray-500">
              <p>
                <span className="text-gray-400">Token:</span>{" "}
                {sessionState.token.substring(0, 50)}...
              </p>
              {sessionState.livekit_ws_url && (
                <p>
                  <span className="text-gray-400">WebSocket URL:</span>{" "}
                  {sessionState.livekit_ws_url}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
