/**
 * Video Renderer Component - Professional UI
 *
 * Google Meet-inspired video display for tutoring sessions
 * Supports flexible layouts: remote-only, local-only, or both
 */

"use client";

import React, { useRef, useEffect, useState } from "react";
import { LocalTrackState, RemoteTrackState } from "@/lib/livekit";
import { Mic, MicOff, User } from "lucide-react";

interface VideoRendererProps {
  /** Local track state */
  localTracks: LocalTrackState;
  /** Remote track state */
  remoteTracks: RemoteTrackState;
  /** User's role */
  role: "teacher" | "student";
  /** Attach local video callback */
  attachLocalVideo: (element: HTMLVideoElement) => void;
  /** Detach local video callback */
  detachLocalVideo: (element: HTMLVideoElement) => void;
  /** Attach remote video callback */
  attachRemoteVideo: (element: HTMLVideoElement) => void;
  /** Detach remote video callback */
  detachRemoteVideo: (element: HTMLVideoElement) => void;
  /** Whether peer is connected */
  isPeerConnected: boolean;
  /** Layout mode */
  layout?: "both" | "remote-only" | "local-only";
}

/**
 * Get initials from name
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Video Tile Component - renders a single video feed with placeholder
 */
function VideoTile({
  label,
  name,
  role,
  hasVideo,
  hasAudio,
  isLocal,
  videoRef,
  isTeacher,
  isPeerConnected,
}: {
  label: string;
  name: string | null;
  role: "teacher" | "student" | null;
  hasVideo: boolean;
  hasAudio: boolean;
  isLocal: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTeacher: boolean;
  isPeerConnected?: boolean;
}) {
  const displayName = name || (isLocal ? "You" : "Waiting...");

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: "var(--background)" }}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${
          hasVideo ? "block" : "hidden"
        }`}
      />

      {/* Placeholder when no video */}
      {!hasVideo && (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "var(--primary-dark)" }}>
          <div className="flex flex-col items-center gap-3">
            {/* Avatar Circle */}
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {isPeerConnected !== false ? (
                <span className="text-3xl font-bold text-white">
                  {getInitials(name)}
                </span>
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
            {/* Name */}
            <span className="text-white text-lg font-medium">{displayName}</span>
            {!isLocal && !isPeerConnected && (
              <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: "var(--secondary)", color: "var(--primary-dark)" }}>
                Waiting to join...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Overlay with Name and Audio Status */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent)" }}>
        <div className="flex items-center gap-2">
          {isTeacher && (
            <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: "var(--primary)", color: "#FFFFFF" }}>
              {isLocal ? "You" : "Teacher"}
            </span>
          )}
          {!isTeacher && !isLocal && (
            <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: "var(--secondary)", color: "var(--primary-dark)" }}>
              Student
            </span>
          )}
          <span className="text-white text-sm font-medium truncate max-w-[150px]">
            {label}
          </span>
        </div>

        {/* Audio indicator */}
        <div className={`p-1.5 rounded-full ${hasAudio ? "bg-white/20" : "bg-red-500"}`}>
          {hasAudio ? (
            <Mic className="w-4 h-4 text-white" />
          ) : (
            <MicOff className="w-4 h-4 text-white" />
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoRenderer({
  localTracks,
  remoteTracks,
  role,
  attachLocalVideo,
  detachLocalVideo,
  attachRemoteVideo,
  detachRemoteVideo,
  isPeerConnected,
  layout = "both",
}: VideoRendererProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Track attachment state
  const [isLocalAttached, setIsLocalAttached] = useState(false);
  const [isRemoteAttached, setIsRemoteAttached] = useState(false);

  // Attach/detach local video
  useEffect(() => {
    const element = localVideoRef.current;
    if (!element) return;

    if (localTracks.videoTrack && !isLocalAttached) {
      attachLocalVideo(element);
      setIsLocalAttached(true);
    }

    return () => {
      if (element && isLocalAttached) {
        detachLocalVideo(element);
        setIsLocalAttached(false);
      }
    };
  }, [
    localTracks.videoTrack,
    attachLocalVideo,
    detachLocalVideo,
    isLocalAttached,
  ]);

  // Attach/detach remote video
  useEffect(() => {
    const element = remoteVideoRef.current;
    if (!element) return;

    if (remoteTracks.videoTrack && !isRemoteAttached) {
      attachRemoteVideo(element);
      setIsRemoteAttached(true);
    }

    return () => {
      if (element && isRemoteAttached) {
        detachRemoteVideo(element);
        setIsRemoteAttached(false);
      }
    };
  }, [
    remoteTracks.videoTrack,
    attachRemoteVideo,
    detachRemoteVideo,
    isRemoteAttached,
  ]);

  // Reset attachment state when tracks change
  useEffect(() => {
    if (!localTracks.videoTrack) {
      setIsLocalAttached(false);
    }
  }, [localTracks.videoTrack]);

  useEffect(() => {
    if (!remoteTracks.videoTrack) {
      setIsRemoteAttached(false);
    }
  }, [remoteTracks.videoTrack]);

  // Determine if participants are teachers
  const isLocalTeacher = role === "teacher";
  const isRemoteTeacher = remoteTracks.participantRole === "teacher";

  // Determine local participant info
  const localLabel = isLocalTeacher ? "You (Teacher)" : "You";
  const localName = isLocalTeacher ? "Teacher" : "Student";

  // Determine remote participant info
  const remoteName =
    remoteTracks.participantName ||
    (isPeerConnected ? (isRemoteTeacher ? "Teacher" : "Student") : null);
  const remoteLabel = isPeerConnected
    ? isRemoteTeacher
      ? "Teacher"
      : remoteTracks.participantName || "Student"
    : "Waiting...";

  // Render based on layout mode
  if (layout === "remote-only") {
    return (
      <div className="w-full h-full">
        <VideoTile
          label={remoteLabel}
          name={remoteName}
          role={remoteTracks.participantRole}
          hasVideo={!!remoteTracks.videoTrack}
          hasAudio={!!remoteTracks.audioTrack}
          isLocal={false}
          videoRef={remoteVideoRef}
          isTeacher={isRemoteTeacher}
          isPeerConnected={isPeerConnected}
        />
      </div>
    );
  }

  if (layout === "local-only") {
    return (
      <div className="w-full h-full">
        <VideoTile
          label={localLabel}
          name={localName}
          role={role}
          hasVideo={!!localTracks.videoTrack && localTracks.isVideoEnabled}
          hasAudio={!!localTracks.audioTrack && localTracks.isAudioEnabled}
          isLocal={true}
          videoRef={localVideoRef}
          isTeacher={isLocalTeacher}
          isPeerConnected={true}
        />
      </div>
    );
  }

  // Default: both videos side by side
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
      {/* Remote video */}
      <div className="aspect-video">
        <VideoTile
          label={remoteLabel}
          name={remoteName}
          role={remoteTracks.participantRole}
          hasVideo={!!remoteTracks.videoTrack}
          hasAudio={!!remoteTracks.audioTrack}
          isLocal={false}
          videoRef={remoteVideoRef}
          isTeacher={isRemoteTeacher}
          isPeerConnected={isPeerConnected}
        />
      </div>

      {/* Local video */}
      <div className="aspect-video">
        <VideoTile
          label={localLabel}
          name={localName}
          role={role}
          hasVideo={!!localTracks.videoTrack && localTracks.isVideoEnabled}
          hasAudio={!!localTracks.audioTrack && localTracks.isAudioEnabled}
          isLocal={true}
          videoRef={localVideoRef}
          isTeacher={isLocalTeacher}
          isPeerConnected={true}
        />
      </div>
    </div>
  );
}
