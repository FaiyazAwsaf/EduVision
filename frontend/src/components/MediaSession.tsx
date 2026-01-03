/**
 * Media Session Component - Professional UI
 *
 * Google Meet-inspired interface for live tutoring sessions
 * Features video, audio, and screen sharing capabilities
 */

"use client";

import React from "react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { VideoRenderer } from "@/components/VideoRenderer";
import { ScreenShareRenderer } from "@/components/ScreenShareRenderer";
import { LiveKitConnectionState } from "@/lib/livekit";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  AlertCircle,
} from "lucide-react";

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
    toggleScreenShare,
    attachLocalVideo,
    detachLocalVideo,
    attachRemoteVideo,
    detachRemoteVideo,
    attachLocalScreenShare,
    detachLocalScreenShare,
    attachRemoteScreenShare,
    detachRemoteScreenShare,
  } = useLiveKit({
    wsUrl,
    token,
    role,
    autoConnect: true,
  });

  // Derived states
  const isAudioMuted = !localTracks.isAudioEnabled;
  const isVideoOff = !localTracks.isVideoEnabled;
  const isScreenSharing = localTracks.isScreenSharing;
  const hasLocalVideo = !!localTracks.videoTrack;
  const hasRemoteVideo = !!remoteTracks.videoTrack;
  const hasLocalScreenShare = !!localTracks.screenShareTrack;
  const hasRemoteScreenShare = !!remoteTracks.screenShareTrack;

  // Check if any screen is being shared
  const isAnyScreenSharing = hasLocalScreenShare || hasRemoteScreenShare;

  // Show waiting message if not connected yet
  if (!wsUrl || !token) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#F2EFE7" }}>
        <div className="text-center" style={{ color: "#006A71" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "#48A6A7" }}></div>
          <p className="text-lg font-medium">Waiting for session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: "#F2EFE7" }}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ backgroundColor: "#FFFFFF", borderColor: "#9ACBD0" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold" style={{ color: "#006A71" }}>
            EduVision Tutoring
          </h1>
          {sessionId && (
            <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: "#9ACBD0", color: "#006A71" }}>
              {role === "teacher" ? "Teacher" : "Student"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm" style={{ color: "#006A71" }}>
            {getConnectionStatusText(connectionState)}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "#fee", borderLeft: "4px solid #dc2626" }}>
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Connection Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Video/Screen Share error (non-critical) */}
      {(localTracks.videoError || localTracks.screenShareError) && !error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "#fffbeb", borderLeft: "4px solid #f59e0b" }}>
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            {localTracks.videoError && (
              <p className="text-sm text-amber-900">{localTracks.videoError}</p>
            )}
            {localTracks.screenShareError && (
              <p className="text-sm text-amber-900">{localTracks.screenShareError}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {isAnyScreenSharing ? (
          /* Screen Share Layout: Full screen with minimized videos at top */
          <div className="h-full flex flex-col">
            {/* Minimized Videos at Top */}
            <div className="absolute top-4 left-4 right-4 z-20 flex gap-3">
              {hasRemoteVideo && (
                <div className="w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2" style={{ borderColor: "#48A6A7" }}>
                  <VideoRenderer
                    localTracks={localTracks}
                    remoteTracks={remoteTracks}
                    role={role}
                    attachLocalVideo={attachLocalVideo}
                    detachLocalVideo={detachLocalVideo}
                    attachRemoteVideo={attachRemoteVideo}
                    detachRemoteVideo={detachRemoteVideo}
                    isPeerConnected={isPeerConnected}
                    layout="remote-only"
                  />
                </div>
              )}
              {hasLocalVideo && (
                <div className="w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2" style={{ borderColor: "#9ACBD0" }}>
                  <VideoRenderer
                    localTracks={localTracks}
                    remoteTracks={remoteTracks}
                    role={role}
                    attachLocalVideo={attachLocalVideo}
                    detachLocalVideo={detachLocalVideo}
                    attachRemoteVideo={attachRemoteVideo}
                    detachRemoteVideo={detachRemoteVideo}
                    isPeerConnected={isPeerConnected}
                    layout="local-only"
                  />
                </div>
              )}
            </div>

            {/* Screen Share Display */}
            <div className="flex-1 flex items-center justify-center p-6">
              {hasRemoteScreenShare && (
                <div className="w-full h-full max-w-7xl max-h-full">
                  <ScreenShareRenderer
                    track={remoteTracks.screenShareTrack}
                    isLocal={false}
                    participantName={remoteTracks.participantName || undefined}
                    attachScreenShare={attachRemoteScreenShare}
                    detachScreenShare={detachRemoteScreenShare}
                  />
                </div>
              )}
              {hasLocalScreenShare && !hasRemoteScreenShare && (
                <div className="w-full h-full max-w-7xl max-h-full">
                  <ScreenShareRenderer
                    track={localTracks.screenShareTrack}
                    isLocal={true}
                    attachScreenShare={attachLocalScreenShare}
                    detachScreenShare={detachLocalScreenShare}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal Video Layout: Large remote + Small local */
          <div className="h-full relative">
            {/* Large Remote Video (main view) */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <VideoRenderer
                localTracks={localTracks}
                remoteTracks={remoteTracks}
                role={role}
                attachLocalVideo={attachLocalVideo}
                detachLocalVideo={detachLocalVideo}
                attachRemoteVideo={attachRemoteVideo}
                detachRemoteVideo={detachRemoteVideo}
                isPeerConnected={isPeerConnected}
                layout="remote-only"
              />
            </div>

            {/* Small Local Video (bottom-right corner) */}
            <div className="absolute bottom-6 right-6 w-64 h-48 rounded-lg overflow-hidden shadow-2xl border-3 z-10" style={{ borderColor: "#48A6A7" }}>
              <VideoRenderer
                localTracks={localTracks}
                remoteTracks={remoteTracks}
                role={role}
                attachLocalVideo={attachLocalVideo}
                detachLocalVideo={detachLocalVideo}
                attachRemoteVideo={attachRemoteVideo}
                detachRemoteVideo={detachRemoteVideo}
                isPeerConnected={isPeerConnected}
                layout="local-only"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="px-6 py-4 border-t" style={{ backgroundColor: "#FFFFFF", borderColor: "#9ACBD0" }}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Peer Status */}
          <div className="text-sm" style={{ color: "#006A71" }}>
            {isPeerConnected ? (
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                {role === "teacher" ? "Student" : "Teacher"} joined
              </span>
            ) : (
              <span className="flex items-center gap-2" style={{ color: "#9ACBD0" }}>
                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                Waiting for {role === "teacher" ? "student" : "teacher"}...
              </span>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            {/* Microphone Toggle */}
            <button
              onClick={toggleAudio}
              disabled={!isConnected}
              className={`p-4 rounded-full transition-all duration-200 ${
                !isConnected
                  ? "bg-gray-200 cursor-not-allowed"
                  : isAudioMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "hover:bg-gray-100"
              }`}
              style={{
                backgroundColor: !isConnected ? "#e5e7eb" : isAudioMuted ? "#ef4444" : "#48A6A7",
                color: isAudioMuted || !isConnected ? "#fff" : "#fff",
              }}
              title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isAudioMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleVideo}
              disabled={!isConnected || !hasLocalVideo}
              className={`p-4 rounded-full transition-all duration-200 ${
                !isConnected || !hasLocalVideo
                  ? "bg-gray-200 cursor-not-allowed"
                  : isVideoOff
                  ? "bg-red-500 hover:bg-red-600"
                  : "hover:bg-gray-100"
              }`}
              style={{
                backgroundColor: !isConnected || !hasLocalVideo ? "#e5e7eb" : isVideoOff ? "#ef4444" : "#48A6A7",
                color: isVideoOff || !isConnected || !hasLocalVideo ? "#fff" : "#fff",
              }}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              {isVideoOff ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>

            {/* Screen Share Toggle */}
            <button
              onClick={toggleScreenShare}
              disabled={!isConnected}
              className={`p-4 rounded-full transition-all duration-200 ${
                !isConnected
                  ? "bg-gray-200 cursor-not-allowed"
                  : isScreenSharing
                  ? "bg-red-500 hover:bg-red-600"
                  : "hover:bg-gray-100"
              }`}
              style={{
                backgroundColor: !isConnected ? "#e5e7eb" : isScreenSharing ? "#ef4444" : "#48A6A7",
                color: isScreenSharing || !isConnected ? "#fff" : "#fff",
              }}
              title={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-5 h-5" />
              ) : (
                <Monitor className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Spacer for symmetry */}
          <div className="w-32"></div>
        </div>
      </div>
    </div>
  );
}
