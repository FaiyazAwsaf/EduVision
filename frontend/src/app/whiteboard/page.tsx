/**
 * Whiteboard Page
 *
 * Entry point for the collaborative whiteboard
 * Authenticates user and loads/creates session from backend
 */

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Whiteboard from "@/components/whiteboard/Whiteboard";
import {
  getCurrentUser,
  getSession,
  createSession,
  CurrentUser,
  WhiteboardSessionDetail,
} from "@/api/whiteboardService";

function WhiteboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [session, setSession] = useState<WhiteboardSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeWhiteboard = async () => {
      try {
        setIsLoading(true);

        // 1. Check authentication and get current user
        console.log("[Whiteboard] Checking authentication...");
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        console.log("[Whiteboard] User authenticated:", currentUser);

        // 2. Get session ID from URL or create new one
        const sessionId = searchParams.get("session");

        if (sessionId) {
          console.log("[Whiteboard] Loading session:", sessionId);
          const loadedSession = await getSession(sessionId);
          setSession(loadedSession);
          console.log("[Whiteboard] Session loaded:", loadedSession);
        } else {
          // Create new session if none provided
          console.log("[Whiteboard] Creating new session...");
          const newSession = await createSession(`Whiteboard - ${new Date().toLocaleString()}`);
          setSession(newSession);
          console.log("[Whiteboard] Session created:", newSession);

          // Update URL with session ID (optional)
          window.history.replaceState(
            null,
            "",
            `?session=${newSession.id}`,
          );
        }

        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        console.error("[Whiteboard] Initialization error:", errorMessage);
        setError(errorMessage);
        setIsLoading(false);

        // If not authenticated, redirect to login
        if (errorMessage.includes("not authenticated") || errorMessage.includes("401")) {
          console.log("[Whiteboard] Redirecting to login...");
          router.push("/auth/login");
        }
      }
    };

    initializeWhiteboard();
  }, [searchParams, router]);

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          fontSize: "18px",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>Initializing whiteboard...</div>
        <div style={{ fontSize: "14px", color: "#888" }}>
          Authenticating and loading session
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#ff6b6b",
          fontSize: "18px",
          flexDirection: "column",
          gap: "16px",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div>Error initializing whiteboard:</div>
        <div style={{ fontSize: "14px", color: "#ff9999" }}>{error}</div>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#48A6A7",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Not authenticated or session not loaded
  if (!user || !session) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          fontSize: "18px",
        }}
      >
        Initializing...
      </div>
    );
  }

  // Success - render whiteboard
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Whiteboard
        sessionId={session.id}
        userId={user.id}
        role={user.role}
        initialState={session.latest_state}
      />
    </div>
  );
}

export default function WhiteboardPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            color: "#fff",
          }}
        >
          Loading...
        </div>
      }
    >
      <WhiteboardContent />
    </Suspense>
  );
}
