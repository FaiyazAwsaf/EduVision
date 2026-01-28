/**
 * Audio Session Component - Phase 3
 *
 * Wrapper component that integrates WebRTC with SessionContext.
 * Handles the audio connection lifecycle automatically based on session state.
 */

"use client";

import React from "react";
import { useSession } from "@/contexts/SessionContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { AudioStatus } from "./AudioStatus";

interface AudioSessionProps {
  /** Session ID */
  sessionId: string;
  /** Room ID */
  roomId: string;
  /** User's role */
  role: "teacher" | "student";
}

export function AudioSession({ sessionId, roomId, role }: AudioSessionProps) {
  const { sessionState, wsManager, isConnected } = useSession();

  // Determine if peer is connected based on role
  const peerConnected =
    role === "teacher"
      ? sessionState?.isStudentConnected ?? false
      : sessionState?.isTeacherConnected ?? false;

  // Use WebRTC hook
  const {
    connectionState,
    hasLocalAudio,
    hasRemoteAudio,
    isMuted,
    error,
    toggleMute,
  } = useWebRTC({
    sessionId,
    roomId,
    role,
    wsManager,
    peerConnected,
  });

  // Only render if WebSocket is connected
  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm">
          Waiting for WebSocket connection...
        </p>
      </div>
    );
  }

  return (
    <AudioStatus
      connectionState={connectionState}
      hasLocalAudio={hasLocalAudio}
      hasRemoteAudio={hasRemoteAudio}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      error={error}
      role={role}
    />
  );
}
