/**
 * Audio Status Component - Phase 3
 *
 * Displays WebRTC audio connection status and provides mute controls.
 */

"use client";

import React from "react";
import { WebRTCConnectionState } from "@/lib/webrtc";

interface AudioStatusProps {
  /** Current WebRTC connection state */
  connectionState: WebRTCConnectionState;
  /** Whether local audio is active */
  hasLocalAudio: boolean;
  /** Whether remote audio is being received */
  hasRemoteAudio: boolean;
  /** Whether local audio is muted */
  isMuted: boolean;
  /** Callback to toggle mute */
  onToggleMute: () => void;
  /** Error message if any */
  error?: string | null;
  /** User's role */
  role: "teacher" | "student";
}

/**
 * Get status text based on connection state
 */
function getStatusText(state: WebRTCConnectionState): string {
  switch (state) {
    case "new":
      return "Initializing...";
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "failed":
      return "Connection Failed";
    case "closed":
      return "Closed";
    default:
      return "Unknown";
  }
}

/**
 * Get status color based on connection state
 */
function getStatusColor(state: WebRTCConnectionState): string {
  switch (state) {
    case "connected":
      return "text-green-600";
    case "connecting":
      return "text-yellow-600";
    case "disconnected":
    case "failed":
    case "closed":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

export function AudioStatus({
  connectionState,
  hasLocalAudio,
  hasRemoteAudio,
  isMuted,
  onToggleMute,
  error,
  role,
}: AudioStatusProps) {
  const isConnected = connectionState === "connected";

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Audio ({role})</h3>
        <span className={`text-sm ${getStatusColor(connectionState)}`}>
          {getStatusText(connectionState)}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Status indicators */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasLocalAudio ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Microphone {hasLocalAudio ? "Active" : "Off"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasRemoteAudio ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Remote {hasRemoteAudio ? "Active" : "Off"}
          </span>
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={onToggleMute}
        disabled={!hasLocalAudio}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          !hasLocalAudio
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : isMuted
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
        }`}
      >
        {isMuted ? "🔇 Unmute" : "🎤 Mute"}
      </button>

      {/* Audio indicator */}
      {isConnected && hasRemoteAudio && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <span className="animate-pulse">🔊</span>
          <span>
            Receiving audio from {role === "teacher" ? "student" : "teacher"}
          </span>
        </div>
      )}
    </div>
  );
}
