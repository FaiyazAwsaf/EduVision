"use client";

import React, { useRef, useEffect } from "react";
import { MicOff } from "lucide-react";

export interface ParticipantTileProps {
  /** Participant identity (LiveKit identity for remote, "local" for self) */
  identity: string;
  /** Display name */
  name: string;
  /** Role badge */
  role?: "teacher" | "student" | null;
  /** Whether this is the local user */
  isLocal: boolean;
  /** Whether video is on */
  hasVideo: boolean;
  /** Whether audio is on */
  hasAudio: boolean;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Is this the session owner (shown first) */
  isOwner?: boolean;
  /** Attach video to element callback */
  onAttachVideo?: (element: HTMLVideoElement) => void;
  /** Detach video from element callback */
  onDetachVideo?: (element: HTMLVideoElement) => void;
}

/** Generate initials from name */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Generate a deterministic pastel color from name */
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

export function ParticipantTile({
  identity,
  name,
  role,
  isLocal,
  hasVideo,
  hasAudio,
  isSpeaking,
  isOwner,
  onAttachVideo,
  onDetachVideo,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (hasVideo && onAttachVideo) {
      onAttachVideo(el);
    }

    return () => {
      if (el && onDetachVideo) {
        onDetachVideo(el);
      }
    };
  }, [hasVideo, onAttachVideo, onDetachVideo]);

  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden transition-shadow duration-200 ${
        isSpeaking
          ? "ring-[3px] ring-green-400 shadow-lg shadow-green-400/20"
          : ""
      }`}
      style={{ backgroundColor: "#e8e5dd", border: isSpeaking ? undefined : "1px solid #9ACBD0" }}
    >
      {/* Video */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback */
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="rounded-full flex items-center justify-center text-white font-semibold"
            style={{
              backgroundColor: getAvatarColor(name),
              width: "min(40%, 96px)",
              height: "min(40%, 96px)",
              fontSize: "min(5vw, 36px)",
            }}
          >
            {getInitials(name)}
          </div>
        </div>
      )}

      {/* Bottom overlay: name + mic status */}
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/50 to-transparent px-3 py-2 flex items-center gap-2">
        {!hasAudio && (
          <span className="bg-red-500 rounded-full p-1 shrink-0">
            <MicOff className="w-3 h-3 text-white" />
          </span>
        )}
        <span className="text-white text-xs font-medium truncate">
          {name}
          {isLocal && " (You)"}
        </span>
        {role === "teacher" && (
          <span className="text-[10px] text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#006A71" }}>
            Teacher
          </span>
        )}
      </div>

      {/* Owner badge */}
      {isOwner && isLocal && (
        <div className="absolute top-2 left-2 text-[10px] text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(72,166,167,0.7)", backdropFilter: "blur(4px)" }}>
          You
        </div>
      )}
    </div>
  );
}
