/**
 * Video Renderer Component - Phase 4
 *
 * Renders local and remote video tracks with role-aware layout.
 * Handles video element attachment/detachment lifecycle.
 *
 * Features:
 * - Role-based visual emphasis (teacher highlighted)
 * - Graceful handling when video is unavailable
 * - Audio-only fallback display
 * - Responsive layout
 */

"use client";

import React, { useRef, useEffect, useState } from "react";
import { LocalTrackState, RemoteTrackState } from "@/lib/livekit";

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
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: "teacher" | "student" | null): string {
  switch (role) {
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
    default:
      return "Participant";
  }
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
  error,
}: {
  label: string;
  name: string | null;
  role: "teacher" | "student" | null;
  hasVideo: boolean;
  hasAudio: boolean;
  isLocal: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTeacher: boolean;
  error?: string | null;
}) {
  const displayName = name || (isLocal ? "You" : "Waiting...");

  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-gray-900 ${
        isTeacher ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Local video should be muted to prevent echo
        className={`w-full h-full object-cover ${
          hasVideo ? "block" : "hidden"
        }`}
      />

      {/* Placeholder when no video */}
      {!hasVideo && (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            {/* Avatar */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                isTeacher ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              {getInitials(name)}
            </div>
            {/* Name */}
            <span className="text-gray-300 text-sm">{displayName}</span>
            {/* Error message */}
            {error && (
              <span className="text-red-400 text-xs max-w-[200px] text-center">
                {error}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Label overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Role badge */}
            {isTeacher && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                Teacher
              </span>
            )}
            <span className="text-white text-sm font-medium truncate">
              {label}
            </span>
          </div>

          {/* Media indicators */}
          <div className="flex items-center gap-1">
            {/* Audio indicator */}
            <span
              className={`text-sm ${hasAudio ? "text-green-400" : "text-red-400"}`}
              title={hasAudio ? "Audio active" : "Audio off"}
            >
              {hasAudio ? "🎤" : "🔇"}
            </span>
            {/* Video indicator */}
            <span
              className={`text-sm ${hasVideo ? "text-green-400" : "text-gray-400"}`}
              title={hasVideo ? "Video active" : "Video off"}
            >
              {hasVideo ? "📹" : "📷"}
            </span>
          </div>
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
  const localLabel = isLocalTeacher ? "You (Teacher)" : "You (Student)";
  const localName = isLocalTeacher ? "Teacher" : "Student";

  // Determine remote participant info
  const remoteName =
    remoteTracks.participantName ||
    (isPeerConnected
      ? isRemoteTeacher
        ? "Teacher"
        : "Student"
      : null);
  const remoteLabel = isPeerConnected
    ? isRemoteTeacher
      ? `${remoteName} (Teacher)`
      : `${remoteName} (Student)`
    : "Waiting for participant...";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Remote video (main/larger) */}
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
        />
      </div>

      {/* Local video (self-view) */}
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
          error={localTracks.videoError}
        />
      </div>
    </div>
  );
}
