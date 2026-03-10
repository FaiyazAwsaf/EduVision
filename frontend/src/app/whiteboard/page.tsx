/**
 * Whiteboard Page
 *
 * Entry point for the collaborative whiteboard
 * Authenticates user and loads/creates session from backend
 */

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Users,
  Trash2,
  UserPlus,
  ArrowRight,
  PenTool,
  Calendar,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import Whiteboard from "@/components/whiteboard/Whiteboard";
import Sidebar from "@/components/shared/Sidebar";
import { getUserData } from "@/api/auth";
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<WhiteboardSession | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [preInviteStudentIds, setPreInviteStudentIds] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const canCreateSession = user?.role === "teacher";
  const cachedRole = getUserData()?.role;
  const shellRole: "teacher" | "student" | "admin" = user?.role ?? cachedRole ?? "teacher";

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
          console.log("[Whiteboard Page] Loaded session for user:", currentUser.username, "role:", currentUser.role);
          console.log("[Whiteboard Page] Session data:", loadedSession);
          console.log("[Whiteboard Page] Latest state:", loadedSession.latest_state);
          setSession(loadedSession);
          setShowPicker(false);
          setIsLoading(false);
          return;
        }

        // 3. Load user's sessions
        console.log("[Whiteboard] Loading user sessions...");
        const userSessions = await getUserSessions();
        setSessions(userSessions);

        // Load students early so teachers can pre-invite while creating a session.
        if (currentUser.role === "teacher") {
          try {
            const fetchedStudents = await getMyStudents();
            setStudents(fetchedStudents);
          } catch (studentErr) {
            console.warn("[Whiteboard] Failed to preload students for pre-invite:", studentErr);
          }
        }

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
          setTimeout(() => router.push("/signin"), 2000);
        }
      }
    };

    initializeWhiteboard();
  }, [searchParams, router]);

  const handleSelectSession = async (selectedSession: WhiteboardSession) => {
    try {
      const loadedSession = await getSession(selectedSession.id);
      console.log("[Whiteboard Page] Loaded session for user:", user?.username, "role:", user?.role);
      console.log("[Whiteboard Page] Session data:", loadedSession);
      console.log("[Whiteboard Page] Latest state:", loadedSession.latest_state);
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

      if (preInviteStudentIds.length > 0) {
        try {
          await inviteStudentsToSession(newSession.id, preInviteStudentIds);
        } catch (inviteErr) {
          console.error("[Whiteboard] Session created but pre-invite failed:", inviteErr);
          setError("Session created, but inviting selected students failed.");
        }
      }

      setSession(newSession);
      setShowPicker(false);
      setPreInviteStudentIds([]);
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
    // Clear the session URL parameter
    router.replace("/whiteboard");
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

  const togglePreInviteSelection = (studentId: string) => {
    setPreInviteStudentIds((prev) =>
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

  const handleDeleteSession = (targetSession: WhiteboardSession) => {
    if (!canCreateSession) {
      setError("Only teachers can delete sessions.");
      return;
    }

    setSessionToDelete(targetSession);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      setIsDeletingSession(true);
      await deleteSession(sessionToDelete.id);
      const updatedSessions = await getUserSessions();
      setSessions(updatedSessions);
      setShowDeleteModal(false);
      setSessionToDelete(null);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete session";
      setError(errorMessage);
    } finally {
      setIsDeletingSession(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar role={shellRole} />
        <div className="ml-60 flex flex-col min-h-screen">
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
            <div className="px-8 py-4">
              <h1 className="text-2xl font-bold text-primary-dark">Whiteboard</h1>
              <p className="text-sm text-primary">
                Create or open collaborative whiteboard sessions
              </p>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
              <div className="text-lg text-primary-dark font-semibold mt-4">Initializing whiteboard...</div>
              <div className="text-sm text-muted mt-2">Authenticating and loading sessions</div>
            </div>
          </main>
        </div>
      </div>);
  }

  if (showPicker && !session) {
    const sidebarRole = user?.role === "student" ? "student" : "teacher";
    return (
      <div className="min-h-screen bg-background">
        <Sidebar role={user?.role === "student" ? "student" : "teacher"} />
        <div className="ml-60 flex flex-col min-h-screen">
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
            <div className="px-8 py-4">
              <h1 className="text-2xl font-bold text-primary-dark">Whiteboard</h1>
              <p className="text-sm text-primary">
                Create or open collaborative whiteboard sessions
              </p>
            </div>
          </header>

          <main className="flex-1 px-8 py-8">
            <div style={{ maxWidth: "980px" }}>

          {error && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "30px",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {canCreateSession && (
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #9acbd0",
                borderRadius: "8px",
                padding: "24px",
                marginBottom: "40px",
                boxShadow: "0 4px 12px rgba(0, 106, 113, 0.08)",
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
                    backgroundColor: "#ffffff",
                    border: "1px solid #9acbd0",
                    borderRadius: "6px",
                    color: "#006a71",
                    fontSize: "14px",
                  }}
                />
                <button
                  onClick={handleCreateSession}
                  disabled={isCreatingSession}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isCreatingSession ? "Creating..." : "New Session"}
                </button>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  border: "1px solid #9acbd0",
                  borderRadius: "6px",
                  backgroundColor: "#f8fbfb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#006a71",
                  }}
                >
                  <span>Invite students before creating</span>
                  <span style={{ color: "#48A6A7", fontWeight: 600 }}>
                    Selected: {preInviteStudentIds.length}
                  </span>
                </div>

                {students.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    No students available to pre-invite.
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    {students.map((student) => (
                      <label
                        key={student.user_id}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          fontSize: "13px",
                          color: "#006a71",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={preInviteStudentIds.includes(student.user_id)}
                          onChange={() => togglePreInviteSelection(student.user_id)}
                          disabled={isCreatingSession}
                        />
                        <span>
                          {student.username} ({student.email})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                  backgroundColor: "#ffffff",
                  border: "1px solid #9acbd0",
                  borderRadius: "8px",
                  padding: "40px",
                  textAlign: "center",
                  color: "#6b7280",
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
                      backgroundColor: "#ffffff",
                      border: "1px solid #9acbd0",
                      borderRadius: "8px",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 3px 10px rgba(0, 106, 113, 0.06)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fbfb";
                      e.currentTarget.style.borderColor = "#48A6A7";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.borderColor = "#9acbd0";
                    }}
                  >
                    <div>
                      {/* Session name */}
                      <h3 className="text-sm font-semibold text-primary mb-1 truncate group-hover:text-primary-dark transition-colors">
                        {sess.name}
                      </h3>
                      <p className="text-xs text-muted mb-3">
                        Owner: {sess.owner.username}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-muted mb-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {sess.members?.length || 0} members
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(sess.updated_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Actions */}
                      {canCreateSession && sess.owner.id === user?.id && (
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleInviteStudents(sess.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Invite
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(sess);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}

                      {/* Open link */}
                      <div className="flex items-center justify-end pt-3 border-t border-secondary/20">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary-dark transition-colors">
                          Open Session
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
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

            <DeleteSessionModal
              open={showDeleteModal}
              sessionName={sessionToDelete?.name ?? ""}
              onClose={() => {
                if (isDeletingSession) return;
                setShowDeleteModal(false);
                setSessionToDelete(null);
              }}
              onConfirm={() => {
                void handleConfirmDeleteSession();
              }}
              isDeleting={isDeletingSession}
            />
          </main>
        </div>
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
          initialPageStates={session.page_states || []}
          pageCount={session.page_count || 1}
          onExitSession={handleExitSession}
          members={session.members}
          ownerId={session.owner.id}
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
        backgroundColor: "#f2efe7",
        color: "#006a71",
      }}
    >
      Initializing...
    </div>
  );
}

export default function WhiteboardPage() {
  const cachedRole = getUserData()?.role;
  const fallbackRole: "teacher" | "student" | "admin" = cachedRole ?? "teacher";

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <Sidebar role={fallbackRole} />
          <div className="ml-60 flex flex-col min-h-screen">
            <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
              <div className="px-8 py-4">
                <h1 className="text-2xl font-bold text-primary-dark">Whiteboard</h1>
                <p className="text-sm text-primary">Create or open collaborative whiteboard sessions</p>
              </div>
            </header>
            <main className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
                <div className="text-primary-dark mt-4">Loading...</div>
              </div>
            </main>
          </div>
        </div>
      }
    >
      <WhiteboardContent />
    </Suspense>
  );
}

function DeleteSessionModal({
  open,
  sessionName,
  onClose,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  sessionName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 2100,
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
          maxWidth: "460px",
          backgroundColor: "#1f1f1f",
          border: "1px solid #5e2b2b",
          borderRadius: "10px",
          padding: "20px",
          color: "#fff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: "12px", color: "#ff9a9a" }}>
          Delete Session
        </h3>
        <p style={{ margin: "0 0 8px 0", color: "#e7e7e7" }}>
          Are you sure you want to delete <strong>{sessionName}</strong>?
        </p>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#9aa0a6" }}>
          This action is permanent and cannot be undone.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #666",
              backgroundColor: "transparent",
              color: "#ddd",
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#ff6b6b",
              color: "#fff",
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? "Deleting..." : "Delete Session"}
          </button>
        </div>
      </div>
    </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[80vh] overflow-auto bg-white rounded-2xl border border-secondary/30 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary/20">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">
              Invite Students
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Select students to share this session with
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-primary-dark hover:bg-background transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-secondary mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-dark mb-1">
                No students available
              </p>
              <p className="text-xs text-muted">
                Please check that you are assigned as the class teacher for a
                section.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const isSelected = selectedStudentIds.includes(
                  student.user_id,
                );
                return (
                  <button
                    key={student.user_id}
                    onClick={() => onToggle(student.user_id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-secondary/30 hover:border-primary/40 hover:bg-background"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-secondary/50"
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-primary-dark">
                      {student.first_name} {student.last_name}{" "}
                      <span className="text-muted">({student.username})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-primary-dark hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isInviting || students.length === 0 || selectedStudentIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isInviting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {isInviting ? "Inviting..." : "Send Invites"}
          </button>
        </div>
      </div>
    </div>
  );
}
