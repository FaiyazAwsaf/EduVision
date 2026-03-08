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
  getUserSessions,
  deleteSession,
  inviteStudentsToSession,
  CurrentUser,
  WhiteboardSession,
  WhiteboardSessionDetail,
} from "@/api/whiteboardService";
import { getMyStudents, StudentProfile } from "@/api/school";

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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSessionId, setInviteSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const canCreateSession = user?.role === "teacher";

  useEffect(() => {
    const initializeWhiteboard = async () => {
      try {
        setIsLoading(true);

        // 1. Check authentication and get current user
        console.log("[Whiteboard] Checking authentication...");
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        console.log("[Whiteboard] User authenticated:", currentUser);

        const sessionId = searchParams.get("session");
        if (sessionId) {
          console.log("[Whiteboard] Loading session from URL:", sessionId);
          const loadedSession = await getSession(sessionId);
          setSession(loadedSession);
          setShowPicker(false);
          setIsLoading(false);
          return;
        }

        // 3. Load user's sessions
        console.log("[Whiteboard] Loading user sessions...");
        const userSessions = await getUserSessions();
        setSessions(userSessions);
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        console.error("[Whiteboard] Initialization error:", errorMessage);
        console.error("[Whiteboard] Full error:", err);
        setError(errorMessage);
        setIsLoading(false);

        // If not authenticated, redirect to login
        if (
          errorMessage.includes("not authenticated") ||
          errorMessage.includes("401")
        ) {
          console.log("[Whiteboard] Redirecting to login...");
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
    if (!canCreateSession) {
      setError("Only teachers can create whiteboard sessions.");
      return;
    }

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
    const updatedSessions = await getUserSessions();
    setSessions(updatedSessions);
    setSession(null);
    setShowPicker(true);
    setNewSessionName("");
    setError(null);
  };

  const handleInviteStudents = async (sessionId: string) => {
    if (!canCreateSession) {
      setError("Only teachers can invite students.");
      return;
    }

    try {
      setError(null);
      const fetchedStudents = await getMyStudents();
      setStudents(fetchedStudents);
      setInviteSessionId(sessionId);
      setSelectedStudentIds([]);
      setShowInviteModal(true);
      
      if (fetchedStudents.length === 0) {
        console.warn("[Whiteboard] No students found in teacher's assigned class");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load students";
      setError(errorMessage);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const handleConfirmInvite = async () => {
    if (!inviteSessionId) return;
    if (selectedStudentIds.length === 0) {
      setError("Select at least one student to invite.");
      return;
    }

    try {
      setIsInviting(true);
      await inviteStudentsToSession(inviteSessionId, selectedStudentIds);
      const updatedSessions = await getUserSessions();
      setSessions(updatedSessions);
      setShowInviteModal(false);
      setInviteSessionId(null);
      setSelectedStudentIds([]);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to invite students";
      setError(errorMessage);
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!canCreateSession) {
      setError("Only teachers can delete sessions.");
      return;
    }

    const confirmed = window.confirm(
      "Delete this session permanently? This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await deleteSession(sessionId);
      const updatedSessions = await getUserSessions();
      setSessions(updatedSessions);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete session";
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

          {canCreateSession && (
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
          )}

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
                {canCreateSession
                  ? "No sessions yet. Create one to get started!"
                  : "No whiteboard sessions shared with you yet."}
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
                      {canCreateSession && sess.owner.id === user?.id && (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "10px",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleInviteStudents(sess.id);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #48A6A7",
                              backgroundColor: "transparent",
                              color: "#48A6A7",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Invite Students
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteSession(sess.id);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #ff6b6b",
                              backgroundColor: "transparent",
                              color: "#ff6b6b",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Delete Session
                          </button>
                        </div>
                      )}
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

        <InviteStudentsModal
          open={showInviteModal}
          students={students}
          selectedStudentIds={selectedStudentIds}
          onToggle={toggleStudentSelection}
          onClose={() => {
            setShowInviteModal(false);
            setInviteSessionId(null);
            setSelectedStudentIds([]);
            setError(null);
          }}
          onConfirm={() => {
            void handleConfirmInvite();
          }}
          isInviting={isInviting}
        />
      </div>
    );
  }

  if (!showPicker && session && user) {
    return (
      <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
        <Whiteboard
          sessionId={session.id}
          userId={user.id}
          role={user.role}
          initialState={session.latest_state}
          onExitSession={handleExitSession}
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

function InviteStudentsModal({
  open,
  students,
  selectedStudentIds,
  onToggle,
  onClose,
  onConfirm,
  isInviting,
}: {
  open: boolean;
  students: StudentProfile[];
  selectedStudentIds: string[];
  onToggle: (studentId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isInviting: boolean;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "80vh",
          overflow: "auto",
          backgroundColor: "#1f1f1f",
          border: "1px solid #405d5d",
          borderRadius: "10px",
          padding: "20px",
          color: "#fff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Invite Students</h3>
        {students.length === 0 ? (
          <div style={{ color: "#aaa" }}>
            <p style={{ margin: "0 0 8px 0" }}>
              No students available in your assigned class.
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
              Please check that you are assigned as the class teacher for a section in the system.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
            {students.map((student) => (
              <label
                key={student.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  border: "1px solid #2e2e2e",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.user_id)}
                  onChange={() => onToggle(student.user_id)}
                />
                <span>
                  {student.first_name} {student.last_name} ({student.username})
                </span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #666",
              backgroundColor: "transparent",
              color: "#ddd",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isInviting || students.length === 0}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#48A6A7",
              color: "#fff",
              cursor: isInviting ? "not-allowed" : "pointer",
              opacity: isInviting ? 0.7 : 1,
            }}
          >
            {isInviting ? "Inviting..." : "Send Invites"}
          </button>
        </div>
      </div>
    </div>
  );
}
