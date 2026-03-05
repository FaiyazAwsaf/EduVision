"use client";

import React, { useRef, useEffect } from "react";
import { ParticipantTile } from "./ParticipantTile";
import type { GridParticipant } from "./MeetGrid";
import { Monitor } from "lucide-react";

interface ScreenShareLayoutProps {
  /** Name of the presenter */
  presenterName: string;
  /** Whether the screen share is from local user */
  isLocalScreenShare: boolean;
  /** Attach screen share video callback */
  onAttachScreenShare: (element: HTMLVideoElement) => void;
  /** Detach screen share video callback */
  onDetachScreenShare: (element: HTMLVideoElement) => void;
  /** Sorted participant tiles (max 4) shown in the right sidebar */
  participants: GridParticipant[];
}

export function ScreenShareLayout({
  presenterName,
  isLocalScreenShare,
  onAttachScreenShare,
  onDetachScreenShare,
  participants,
}: ScreenShareLayoutProps) {
  const screenRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    onAttachScreenShare(el);
    return () => {
      if (el) onDetachScreenShare(el);
    };
  }, [onAttachScreenShare, onDetachScreenShare]);

  const visible = participants.slice(0, 4);

  return (
    <div className="w-full h-full flex gap-2 p-2">
      {/* Main screen share area */}
      <div
        className="flex-1 relative rounded-xl overflow-hidden"
        style={{ backgroundColor: "#e8e5dd" }}
      >
        <video
          ref={screenRef}
          autoPlay
          playsInline
          muted={isLocalScreenShare}
          className="w-full h-full object-contain"
        />
        {/* Presenter overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(0,106,113,0.85)", backdropFilter: "blur(4px)" }}>
          <Monitor className="w-4 h-4 text-green-300" />
          <span className="text-white text-sm font-medium">
            {presenterName}
            {isLocalScreenShare && " (You)"}
          </span>
        </div>
      </div>

      {/* Right sidebar: participant tiles */}
      {visible.length > 0 && (
        <div className="w-56 flex flex-col gap-2">
          {visible.map((p) => (
            <div key={p.identity} className="flex-1 min-h-0">
              <ParticipantTile
                identity={p.identity}
                name={p.name}
                role={p.role}
                isLocal={p.isLocal}
                hasVideo={p.hasVideo}
                hasAudio={p.hasAudio}
                isSpeaking={p.isSpeaking}
                isOwner={p.isOwner}
                onAttachVideo={p.onAttachVideo}
                onDetachVideo={p.onDetachVideo}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
