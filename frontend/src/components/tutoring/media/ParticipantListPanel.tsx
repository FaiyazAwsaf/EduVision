"use client";

import React from "react";
import { X, Mic, MicOff, Video, VideoOff, Crown } from "lucide-react";

export interface PanelParticipant {
  identity: string;
  name: string;
  role: "teacher" | "student" | null;
  isLocal: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  isSpeaking: boolean;
}

interface ParticipantListPanelProps {
  participants: PanelParticipant[];
  isOpen: boolean;
  onClose: () => void;
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

export function ParticipantListPanel({
  participants,
  isOpen,
  onClose,
}: ParticipantListPanelProps) {
  if (!isOpen) return null;

  const teachers = participants.filter((p) => p.role === "teacher");
  const students = participants.filter((p) => p.role !== "teacher");

  return (
    <div
      className="w-72 h-full flex flex-col border-l"
      style={{
        backgroundColor: "#ffffff",
        borderColor: "#9ACBD0",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#9ACBD0" }}>
        <span className="font-semibold text-sm" style={{ color: "#006A71" }}>
          Participants ({participants.length})
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: "#48A6A7" }} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Teachers section */}
        {teachers.length > 0 && (
          <div className="mb-2">
            <div className="px-4 py-1 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#48A6A7" }}>
              Teachers
            </div>
            {teachers.map((p) => (
              <ParticipantRow key={p.identity} participant={p} />
            ))}
          </div>
        )}

        {/* Students section */}
        {students.length > 0 && (
          <div>
            <div className="px-4 py-1 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#48A6A7" }}>
              Students ({students.length})
            </div>
            {students.map((p) => (
              <ParticipantRow key={p.identity} participant={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: PanelParticipant }) {
  const { name, role, isLocal, hasAudio, hasVideo, isSpeaking } = participant;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
        isSpeaking ? "bg-green-50" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
        style={{ backgroundColor: getAvatarColor(name) }}
      >
        {getInitials(name)}
      </div>

      {/* Name + badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate" style={{ color: "#006A71" }}>
            {name}
            {isLocal && (
              <span className="text-xs ml-1" style={{ color: "#9ACBD0" }}>(You)</span>
            )}
          </span>
          {role === "teacher" && (
            <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          )}
        </div>
      </div>

      {/* Audio / Video icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {hasAudio ? (
          <Mic className="w-3.5 h-3.5" style={{ color: "#48A6A7" }} />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-400" />
        )}
        {hasVideo ? (
          <Video className="w-3.5 h-3.5" style={{ color: "#48A6A7" }} />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-red-400" />
        )}
      </div>
    </div>
  );
}
