/**
 * Session Context
 *
 * React Context for managing tutoring session state with WebSocket integration.
 * Provides:
 * - Real-time session state updates
 * - Participant connection status
 * - Connection state management
 * - Automatic reconnection handling
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  TutoringWebSocketManager,
  ConnectionState,
  SessionStatus,
  Participant,
  InitialState,
  ParticipantEvent,
  StatusChangeEvent,
  SessionEndedEvent,
  ErrorEvent,
} from "@/lib/websocket";

// Session state interface
export interface SessionState {
  sessionId: string;
  roomId: string;
  status: SessionStatus;
  yourRole: "teacher" | "student";
  teacher: Participant | null;
  student: Participant | null;
  isTeacherConnected: boolean;
  isStudentConnected: boolean;
}

// Context value interface
export interface SessionContextValue {
  // State
  sessionState: SessionState | null;
  connectionState: ConnectionState;
  error: string | null;

  // Status helpers
  isConnected: boolean;
  isReconnecting: boolean;
  isSessionActive: boolean;
  isSessionEnded: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;
  clearError: () => void;
}

// Create context with undefined default
const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

// Props for provider
interface SessionProviderProps {
  children: ReactNode;
  sessionId: string;
  userId: string;
  /** Called when session ends */
  onSessionEnded?: (event: SessionEndedEvent) => void;
  /** Called when participant joins */
  onParticipantJoined?: (event: ParticipantEvent) => void;
  /** Called when participant leaves */
  onParticipantLeft?: (event: ParticipantEvent) => void;
  /** Called when status changes */
  onStatusChanged?: (event: StatusChangeEvent) => void;
}

/**
 * Session Provider Component
 *
 * Wrap your session components with this provider to access session state.
 */
export function SessionProvider({
  children,
  sessionId,
  userId,
  onSessionEnded,
  onParticipantJoined,
  onParticipantLeft,
  onStatusChanged,
}: SessionProviderProps) {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [wsManager, setWsManager] = useState<TutoringWebSocketManager | null>(
    null
  );

  // Initialize WebSocket manager
  useEffect(() => {
    const manager = new TutoringWebSocketManager(sessionId, userId, {
      debug: process.env.NODE_ENV === "development",
    });

    // Set up event handlers
    manager.on("connectionStateChange", (state) => {
      setConnectionState(state);
    });

    manager.on("initialState", (state: InitialState) => {
      setSessionState({
        sessionId: state.session_id,
        roomId: state.room_id,
        status: state.status,
        yourRole: state.your_role,
        teacher: state.teacher,
        student: state.student,
        // Use the connected status from the server
        isTeacherConnected: state.teacher?.connected || false,
        isStudentConnected: state.student?.connected || false,
      });
      setError(null);
    });

    manager.on("participantJoined", (event: ParticipantEvent) => {
      setSessionState((prev) => {
        if (!prev) return prev;

        if (event.role === "teacher") {
          return {
            ...prev,
            isTeacherConnected: true,
            teacher: prev.teacher
              ? { ...prev.teacher, connected: true }
              : { id: event.user_id, name: event.user_name, connected: true },
          };
        } else {
          return {
            ...prev,
            isStudentConnected: true,
            student: prev.student
              ? { ...prev.student, connected: true }
              : { id: event.user_id, name: event.user_name, connected: true },
          };
        }
      });

      onParticipantJoined?.(event);
    });

    manager.on("participantLeft", (event: ParticipantEvent) => {
      setSessionState((prev) => {
        if (!prev) return prev;

        if (event.role === "teacher") {
          return {
            ...prev,
            isTeacherConnected: false,
            teacher: prev.teacher
              ? { ...prev.teacher, connected: false }
              : null,
          };
        } else {
          return {
            ...prev,
            isStudentConnected: false,
            student: prev.student
              ? { ...prev.student, connected: false }
              : null,
          };
        }
      });

      onParticipantLeft?.(event);
    });

    manager.on("statusChanged", (event: StatusChangeEvent) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        return { ...prev, status: event.status };
      });

      // Update student info if a student joined
      if (event.metadata?.student_id && event.metadata?.student_name) {
        setSessionState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            student: {
              id: event.metadata.student_id as string,
              name: event.metadata.student_name as string,
              connected: true,
            },
            isStudentConnected: true,
          };
        });
      }

      onStatusChanged?.(event);
    });

    manager.on("sessionEnded", (event: SessionEndedEvent) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "ENDED" };
      });

      onSessionEnded?.(event);
    });

    manager.on("error", (event: ErrorEvent) => {
      setError(event.message);
    });

    setWsManager(manager);

    // Auto-connect
    manager.connect();

    // Cleanup on unmount
    return () => {
      manager.disconnect();
    };
  }, [sessionId, userId]); // Only recreate when session or user changes

  // Connect action
  const connect = useCallback(() => {
    wsManager?.connect();
  }, [wsManager]);

  // Disconnect action
  const disconnect = useCallback(() => {
    wsManager?.disconnect();
  }, [wsManager]);

  // Clear error action
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed properties
  const isConnected = connectionState === "connected";
  const isReconnecting = connectionState === "reconnecting";
  const isSessionActive = sessionState?.status === "ACTIVE";
  const isSessionEnded = sessionState?.status === "ENDED";

  // Memoized context value
  const contextValue = useMemo<SessionContextValue>(
    () => ({
      sessionState,
      connectionState,
      error,
      isConnected,
      isReconnecting,
      isSessionActive,
      isSessionEnded,
      connect,
      disconnect,
      clearError,
    }),
    [
      sessionState,
      connectionState,
      error,
      isConnected,
      isReconnecting,
      isSessionActive,
      isSessionEnded,
      connect,
      disconnect,
      clearError,
    ]
  );

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to access session context.
 *
 * Must be used within a SessionProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { sessionState, isConnected, isSessionActive } = useSession();
 *
 *   if (!sessionState) return <Loading />;
 *
 *   return (
 *     <div>
 *       <p>Status: {sessionState.status}</p>
 *       <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}

/**
 * Hook to get just the session state.
 * Re-renders only when session state changes.
 */
export function useSessionState(): SessionState | null {
  const { sessionState } = useSession();
  return sessionState;
}

/**
 * Hook to get just the connection state.
 * Re-renders only when connection state changes.
 */
export function useConnectionState(): {
  connectionState: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
} {
  const { connectionState, isConnected, isReconnecting } = useSession();
  return { connectionState, isConnected, isReconnecting };
}
