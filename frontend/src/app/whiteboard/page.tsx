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
      <>
        {user && (
          <Sidebar role={user.role === "student" ? "student" : "teacher"} />
        )}
        <div className={user ? "ml-60" : ""}>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-primary-dark">
                Initializing whiteboard...
              </p>
              <p className="text-xs text-muted mt-1">
                Authenticating and loading sessions
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showPicker && !session) {
    const sidebarRole = user?.role === "student" ? "student" : "teacher";
    return (
      <>
        <Sidebar role={sidebarRole} />
        <div className="ml-60 min-h-screen bg-background">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
            <div className="flex items-center justify-between px-8 py-4">
              <div>
                <h1 className="text-2xl font-bold text-primary-dark">
                  Whiteboard
                </h1>
                <p className="text-sm text-primary">
                  Welcome, {user?.username}
                </p>
              </div>
              {canCreateSession && (
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
              )}
            </div>
          </header>

          <main className="px-8 py-6 max-w-6xl">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Create Session card */}
            {canCreateSession && (
              <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-6 mb-8">
                <h2 className="text-base font-semibold text-primary-dark mb-4">
                  Create New Session
                </h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Session name (optional)"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    disabled={isCreatingSession}
                    className="flex-1 px-4 py-2.5 bg-background border border-secondary/40 rounded-lg text-sm text-primary-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleCreateSession}
                    disabled={isCreatingSession}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isCreatingSession ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {isCreatingSession ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}

            {/* Sessions list */}
            <div>
              <h2 className="text-lg font-semibold text-primary-dark mb-4">
                Your Sessions ({sessions.length})
              </h2>

              {sessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-secondary/30 p-10 text-center shadow-sm">
                  <PenTool className="w-10 h-10 text-secondary mx-auto mb-3" />
                  <p className="text-sm font-medium text-primary-dark mb-1">
                    {canCreateSession
                      ? "No sessions yet"
                      : "No sessions shared with you"}
                  </p>
                  <p className="text-xs text-muted">
                    {canCreateSession
                      ? "Create a new session to get started!"
                      : "Whiteboard sessions shared with you will appear here."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess)}
                      className="bg-white rounded-2xl border border-secondary/30 p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
                    >
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
                              void handleDeleteSession(sess.id);
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
                  ))}
                </div>
              )}
            </div>
          </main>

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
      </>
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

export default function WhiteboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
