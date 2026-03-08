/**
 * Whiteboard Page
 * Session picker + canvas interface
 */

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import Whiteboard from "@/components/whiteboard/Whiteboard";
import {
  getCurrentUser,
  getSession,
  createSession,
  getUserSessions,
  deactivateSession,
  CurrentUser,
  WhiteboardSession,
  WhiteboardSessionDetail,
} from "@/api/whiteboardService";

function WhiteboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessions, setSessions] = useState<WhiteboardSession[]>([]);
  const [session, setSession] = useState<WhiteboardSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(true);
  const [newSessionName, setNewSessionName] = useState<string>("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    const initializeWhiteboard = async () => {
      try {
        setIsLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        const sessionIdParam = searchParams.get("session");
        if (sessionIdParam) {
          const loadedSession = await getSession(sessionIdParam);
          setSession(loadedSession);
          setShowPicker(false);
          setIsLoading(false);
          return;
        }

        const userSessions = await getUserSessions();
        setSessions(userSessions);
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        setIsLoading(false);
        if (
          errorMessage.includes("not authenticated") ||
          errorMessage.includes("401")
        ) {
          setTimeout(() => router.push("/auth/login"), 2000);
        }
      }
    };

    initializeWhiteboard();
  }, [searchParams, router]);

  const handleSelectSession = async (selectedSession: WhiteboardSession) => {
    try {
      const loadedSession = await getSession(selectedSession.id);
      setSession(loadedSession);
      setShowPicker(false);
      window.history.replaceState(null, "", `?session=${selectedSession.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load session";
      setError(errorMessage);
    }
  };

  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true);
      const name =
        newSessionName.trim() ||
        `Whiteboard - ${new Date().toLocaleString()}`;
      const newSession = await createSession(name);
      setSession(newSession);
      setShowPicker(false);
      window.history.replaceState(null, "", `?session=${newSession.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create session";
      setError(errorMessage);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleExitSession = async () => {
    if (!session) return;
    try {
      await deactivateSession(session.id);
      const updatedSessions = await getUserSessions();
      setSessions(updatedSessions);
      setSession(null);
      setShowPicker(true);
      setNewSessionName("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save session";
      setError(errorMessage);
    }
  };

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
          Authenticating and loading sessions
        </div>
      </div>
    );
  }

  if (showPicker && !session) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          overflow: "auto",
          padding: "40px 20px",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ marginBottom: "40px" }}>
            <h1 style={{ fontSize: "2.5em", margin: "0 0 8px 0" }}>
              Whiteboard
            </h1>
            <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
              Welcome, {user?.username}
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#2a1515",
                border: "1px solid #ff6b6b",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "30px",
                color: "#ff6b6b",
                fontSize: "14px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div
            style={{
              backgroundColor: "#252525",
              border: "1px solid #405d5d",
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "40px",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "1.2em" }}>
              Create New Session
            </h2>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                placeholder="Session name (optional)"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                disabled={isCreatingSession}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #405d5d",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "14px",
                }}
              />
              <button
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#48A6A7",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isCreatingSession ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  opacity: isCreatingSession ? 0.6 : 1,
                }}
              >
                {isCreatingSession ? "Creating..." : "Create New"}
              </button>
            </div>
          </div>

          <div>
            <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "1.2em" }}>
              Your Sessions ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#252525",
                  border: "1px solid #405d5d",
                  borderRadius: "8px",
                  padding: "40px",
                  textAlign: "center",
                  color: "#888",
                }}
              >
                No sessions yet. Create one to get started!
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    onClick={() => handleSelectSession(sess)}
                    style={{
                      backgroundColor: "#252525",
                      border: "1px solid #405d5d",
                      borderRadius: "8px",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#2a2a2a";
                      e.currentTarget.style.borderColor = "#48A6A7";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#252525";
                      e.currentTarget.style.borderColor = "#405d5d";
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "1.1em",
                        color: "#48A6A7",
                      }}
                    >
                      {sess.name}
                    </h3>
                    <p
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "12px",
                        color: "#888",
                      }}
                    >
                      Owner: {sess.owner.username}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        color: "#666",
                      }}
                    >
                      <span>Members: {sess.members?.length || 0}</span>
                      <span>
                        Updated:{" "}
                        {new Date(sess.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid #404040",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#48A6A7",
                          fontWeight: "600",
                        }}
                      >
                        Click to open →
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!showPicker && session && user) {
    return (
      <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
        <button
          onClick={handleExitSession}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            padding: "10px 20px",
            backgroundColor: "#ff6b6b",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          Save & Exit
        </button>
        <Whiteboard
          sessionId={session.id}
          userId={user.id}
          role={user.role}
          initialState={session.latest_state}
        />
      </div>
    );
  }

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
      }}
    >
      Initializing...
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
