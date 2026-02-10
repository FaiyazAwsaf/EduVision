/**
 * Screen Share Renderer Component - Professional UI
 *
 * Google Meet-inspired screen share display
 * Automatically attaches/detaches tracks with professional styling
 */

"use client";

import React, { useRef, useEffect, useState } from "react";
import { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { Monitor } from "lucide-react";

interface ScreenShareRendererProps {
  /** Screen share track to display */
  track: LocalVideoTrack | RemoteVideoTrack | null;
  /** Whether this is local screen share */
  isLocal?: boolean;
  /** Display name (for overlay) */
  participantName?: string;
  /** Attach screen share callback */
  attachScreenShare?: (element: HTMLVideoElement) => void;
  /** Detach screen share callback */
  detachScreenShare?: (element: HTMLVideoElement) => void;
}

export function ScreenShareRenderer({
  track,
  isLocal = false,
  participantName,
  attachScreenShare,
  detachScreenShare,
}: ScreenShareRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAttached, setIsAttached] = useState(false);

  // Attach/detach track when it changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !track) return;

    console.log(
      `[ScreenShare] Attaching ${isLocal ? "local" : "remote"} screen share`
    );

    // Use callback if provided, otherwise attach directly
    if (attachScreenShare && !isAttached) {
      attachScreenShare(videoElement);
      setIsAttached(true);
    } else if (!attachScreenShare) {
      track.attach(videoElement);
    }

    // Detach on cleanup
    return () => {
      console.log(
        `[ScreenShare] Detaching ${isLocal ? "local" : "remote"} screen share`
      );
      
      if (detachScreenShare && isAttached) {
        detachScreenShare(videoElement);
        setIsAttached(false);
      } else if (!detachScreenShare) {
        track.detach(videoElement);
      }
    };
  }, [track, isLocal, attachScreenShare, detachScreenShare, isAttached]);

  // Reset attachment state when track changes
  useEffect(() => {
    if (!track) {
      setIsAttached(false);
    }
  }, [track]);

  if (!track) {
    return (
      <div
        className="w-full h-full rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "var(--primary-dark)" }}
      >
        <div className="text-center">
          <Monitor className="w-16 h-16 text-white/40 mx-auto mb-3" />
          <div className="text-white/60 text-sm">
            {isLocal ? "Your screen" : "Remote screen"} not shared
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl" style={{ backgroundColor: "#000" }}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-contain"
      />

      {/* Top overlay label with screen share indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg" style={{ backgroundColor: "rgba(0, 106, 113, 0.95)" }}>
        <Monitor className="w-4 h-4 text-white" />
        <span className="text-white text-sm font-medium">
          {isLocal 
            ? "You're presenting" 
            : participantName 
            ? `${participantName} is presenting` 
            : "Screen presentation"}
        </span>
      </div>

      {/* Sharing indicator badge */}
      <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5" style={{ backgroundColor: "var(--primary)" }}>
        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
        <span className="text-white text-xs font-medium">Live</span>
      </div>
    </div>
  );
}
