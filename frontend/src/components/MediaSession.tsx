/**
 * Media Session Component - Phase 4
 *
 * Integrates LiveKit media (audio + video) with session context.
 * Replaces AudioSession to support both audio and video.
 *
 * Features:
 * - LiveKit room connection management
 * - Audio and video track display
 * - Mute/unmute controls
 * - Video on/off controls
 * - Connection status display
 * - Graceful video failure handling (audio continues)
 */

"use client";

import React from "react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { VideoRenderer } from "@/components/VideoRenderer";
import { LiveKitConnectionState } from "@/lib/livekit";

interface MediaSessionProps {
  /** LiveKit WebSocket URL */
  wsUrl: string | null;
  /** LiveKit access token */
  token: string | null;
  /** User's role in the session */
  role: "teacher" | "student";
  /** Session ID (for display) */
  sessionId?: string;
}

/**
 * Get connection status text
 */
function getConnectionStatusText(state: LiveKitConnectionState): string {
  switch (state) {
    case "disconnected":
      return "Disconnected";
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting...";
    default:
      return "Unknown";
  }
}

/**
 * Get connection status color
 */
function getConnectionStatusColor(state: LiveKitConnectionState): string {
  switch (state) {
    case "connected":
      return "text-green-500";
    case "connecting":
    case "reconnecting":
      return "text-yellow-500";
    case "disconnected":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

export function MediaSession({
  wsUrl,
  token,
  role,
  sessionId,
}: MediaSessionProps) {
  const {
    connectionState,
    localTracks,
    remoteTracks,
    isConnected,
    isPeerConnected,
    error,
    toggleAudio,
    toggleVideo,
    attachLocalVideo,
    detachLocalVideo,
    attachRemoteVideo,
    detachRemoteVideo,
  } = useLiveKit({
    wsUrl,
    token,
    role,
    autoConnect: true,
  });

  // Derived states
  const isAudioMuted = !localTracks.isAudioEnabled;
  const isVideoOff = !localTracks.isVideoEnabled;
  const hasLocalAudio = !!localTracks.audioTrack;
  const hasLocalVideo = !!localTracks.videoTrack;
  const hasRemoteAudio = !!remoteTracks.audioTrack;
  const hasRemoteVideo = !!remoteTracks.videoTrack;

  // Show waiting message if not connected yet
  if (!wsUrl || !token) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <p>Waiting for session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">
          Video Session
          {sessionId && (
            <span className="text-gray-400 text-sm ml-2">({role})</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span
            className={`text-sm ${getConnectionStatusColor(connectionState)}`}
          >
            {getConnectionStatusText(connectionState)}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Video-only error (info level, not critical) */}
      {localTracks.videoError && !error && (
        <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-3">
          <p className="text-yellow-200 text-sm">
            📹 {localTracks.videoError}
          </p>
          <p className="text-yellow-300 text-xs mt-1">
            Session continues with audio only.
          </p>
        </div>
      )}

      {/* Video feeds */}
      <VideoRenderer
        localTracks={localTracks}
        remoteTracks={remoteTracks}
        role={role}
        attachLocalVideo={attachLocalVideo}
        detachLocalVideo={detachLocalVideo}
        attachRemoteVideo={attachRemoteVideo}
        detachRemoteVideo={detachRemoteVideo}
        isPeerConnected={isPeerConnected}
      />

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Audio toggle */}
        <button
          onClick={toggleAudio}
          disabled={!hasLocalAudio}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            !hasLocalAudio
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : isAudioMuted
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
        >
          <span className="text-lg">{isAudioMuted ? "🔇" : "🎤"}</span>
          <span>{isAudioMuted ? "Unmute" : "Mute"}</span>
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          disabled={!hasLocalVideo}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            !hasLocalVideo
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : isVideoOff
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          title={isVideoOff ? "Turn on camera" : "Turn off camera"}
        >
          <span className="text-lg">{isVideoOff ? "📷" : "📹"}</span>
          <span>{isVideoOff ? "Start Video" : "Stop Video"}</span>
        </button>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-700 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasLocalAudio && !isAudioMuted ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Your mic: {hasLocalAudio ? (isAudioMuted ? "Muted" : "Active") : "Off"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasLocalVideo && !isVideoOff ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Your camera: {hasLocalVideo ? (isVideoOff ? "Off" : "On") : "Unavailable"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasRemoteAudio ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Remote audio: {hasRemoteAudio ? "Active" : "Waiting"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              hasRemoteVideo ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          <span className="text-gray-300">
            Remote video: {hasRemoteVideo ? "Active" : "Waiting"}
          </span>
        </div>
      </div>

      {/* Peer status */}
      <div className="text-center text-sm">
        {isPeerConnected ? (
          <span className="text-green-400">
            ✓ {role === "teacher" ? "Student" : "Teacher"} connected
          </span>
        ) : (
          <span className="text-gray-400">
            Waiting for {role === "teacher" ? "student" : "teacher"} to join...
          </span>
        )}
      </div>
    </div>
  );
}
