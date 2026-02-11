"use client";

import React from "react";
import { ParticipantTile } from "./ParticipantTile";

export interface GridParticipant {
  identity: string;
  name: string;
  role?: "teacher" | "student" | null;
  isLocal: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  isSpeaking: boolean;
  isOwner?: boolean;
  onAttachVideo?: (element: HTMLVideoElement) => void;
  onDetachVideo?: (element: HTMLVideoElement) => void;
}

interface MeetGridProps {
  /** Sorted list of participants to display (max 9) */
  participants: GridParticipant[];
}

/**
 * Determine CSS grid template based on count:
 * 1 -> 1x1, 2 -> 1x2, 3-4 -> 2x2, 5-6 -> 2x3, 7-9 -> 3x3
 */
function getGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-2 grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  return "grid-cols-3 grid-rows-3";
}

export function MeetGrid({ participants }: MeetGridProps) {
  const visible = participants.slice(0, 9);
  const gridClass = getGridClass(visible.length);

  return (
    <div className={`w-full h-full grid gap-2 p-2 ${gridClass}`}>
      {visible.map((p) => (
        <ParticipantTile
          key={p.identity}
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
      ))}
    </div>
  );
}
