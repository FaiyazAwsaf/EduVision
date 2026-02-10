"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon,
  Loader2,
  AlertTriangle,
  Video,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  joinSession,
  getSessionStatus,
  getErrorMessage,
  type ApiError,
  type SessionJoinResponse,
} from "@/api/tutoring";

/* ─── Storage helpers (shared with session page) ─────────────────────────── */

const STORAGE_KEY_STUDENT_SESSION = "tutoring_student_session_data";
const STORAGE_KEY_STUDENT_USER = "tutoring_student_user_data";

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function StudentTutoringPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const [joinLink, setJoinLink] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active session detection
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Auth guard
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, router]);

  // Check for an existing active session in sessionStorage
  useEffect(() => {
    if (!isReady || !user) return;

    try {
      const savedSession = sessionStorage.getItem(STORAGE_KEY_STUDENT_SESSION);
      if (savedSession) {
        const parsed: SessionJoinResponse = JSON.parse(savedSession);
        // Verify it's still active by checking status
        getSessionStatus(parsed.session_id)
          .then((status) => {
            if (
              status.status === "ACTIVE" ||
              status.status === "WAITING" ||
              status.status === "GRACE"
            ) {
              setHasActiveSession(true);
            } else {
              // Session ended, clear storage
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

  /**
   * Extract room_id from a join link.
   * Supports:
   *   - Full URL: http(s)://…/student/join/{room_id}
   *   - Just the room_id string
   */
  function extractRoomId(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try to parse as URL
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      // Expect …/student/join/{room_id}
      const joinIdx = parts.indexOf("join");
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        return parts[joinIdx + 1];
      }
    } catch {
      // Not a URL — treat as raw room_id
    }

    // If it looks like a plain room_id (alphanumeric + hyphens/underscores)
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  const handleJoin = async () => {
    setError(null);

    const roomId = extractRoomId(joinLink);
    if (!roomId) {
      setError(
        "Please paste a valid session link or room ID. Example: http://localhost:3000/student/join/abc123",
      );
      return;
    }

    setIsJoining(true);

    try {
      const response: SessionJoinResponse = await joinSession(roomId);

      // Save session data so the session page can restore it
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
      setIsJoining(false);
    }
  };

  // Loading state
  if (!isReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#48A6A7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-[#9ACBD0]/30">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-[#006A71]">
              Join Tutoring Session
            </h1>
            <p className="text-sm text-[#48A6A7]">
              Paste the session link shared by your teacher to join
            </p>
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main className="px-8 py-8 max-w-2xl mx-auto">
        {/* Active session — focused view (no join card) */}
        {!checkingSession && hasActiveSession ? (
          <div className="bg-white rounded-2xl border border-[#9ACBD0]/30 p-10 shadow-sm flex flex-col items-center text-center">
            <div className="relative flex h-5 w-5 mb-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-[#006A71] mb-1">
              Session in Progress
            </h2>
            <p className="text-sm text-[#6B7280] mb-6">
              You are currently in an active tutoring session. Return to
              continue.
            </p>
            <button
              onClick={() => router.push("/student/tutoring/session")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#48A6A7] px-6 py-3 text-sm font-semibold text-white hover:bg-[#006A71] transition-colors shadow"
            >
              Go to Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Join card — only when no active session */
          <div className="bg-white rounded-2xl border border-[#9ACBD0]/30 p-8 shadow-sm">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-[#E8F4F5] rounded-2xl flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-[#006A71]" />
              </div>
              <h2 className="text-xl font-semibold text-[#006A71] mb-1">
                Enter Session Link
              </h2>
              <p className="text-sm text-[#6B7280]">
                Ask your teacher for the session link and paste it below
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="join-link"
                  className="block text-sm font-medium text-[#006A71] mb-2"
                >
                  Session Link or Room ID
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ACBD0]" />
                  <input
                    id="join-link"
                    type="text"
                    value={joinLink}
                    onChange={(e) => setJoinLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isJoining) handleJoin();
                    }}
                    placeholder="http://localhost:3000/student/join/room-abc123"
                    className="w-full pl-11 pr-4 py-3 border border-[#9ACBD0]/40 rounded-xl text-sm text-[#006A71] placeholder:text-[#9ACBD0] focus:outline-none focus:ring-2 focus:ring-[#48A6A7]/40 focus:border-[#48A6A7] transition"
                  />
                </div>
              </div>

              <button
                onClick={handleJoin}
                disabled={isJoining || !joinLink.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#48A6A7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#006A71] transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining Session…
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    Join Session
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
