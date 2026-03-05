"use client";

import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  PhoneOff,
  LogOut,
} from "lucide-react";

interface MeetControlBarProps {
  isAudioOn: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  hasVideoTrack: boolean;
  isConnected: boolean;
  role: "teacher" | "student";
  participantCount: number;
  isParticipantPanelOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleParticipants: () => void;
  onEndSession?: () => void;
  onLeaveSession?: () => void;
}

export function MeetControlBar({
  isAudioOn,
  isVideoOn,
  isScreenSharing,
  hasVideoTrack,
  isConnected,
  role,
  participantCount,
  isParticipantPanelOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleParticipants,
  onEndSession,
  onLeaveSession,
}: MeetControlBarProps) {
  return (
    <div
      className="flex items-center justify-center gap-3 px-6 py-3 border-t"
      style={{ backgroundColor: "#ffffff", borderColor: "#9ACBD0" }}
    >
      {/* Mic */}
      <button
        onClick={onToggleAudio}
        disabled={!isConnected}
        className={`p-3 rounded-full transition-colors duration-150 ${
          !isConnected
            ? "bg-gray-300 cursor-not-allowed"
            : !isAudioOn
              ? "bg-red-500 hover:bg-red-600"
              : ""
        }`}
        style={
          isConnected && isAudioOn
            ? { backgroundColor: "#9ACBD0" }
            : undefined
        }
        onMouseEnter={(e) => {
          if (isConnected && isAudioOn) e.currentTarget.style.backgroundColor = "#48A6A7";
        }}
        onMouseLeave={(e) => {
          if (isConnected && isAudioOn) e.currentTarget.style.backgroundColor = "#9ACBD0";
        }}
        title={isAudioOn ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioOn ? (
          <Mic className="w-5 h-5 text-white" />
        ) : (
          <MicOff className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Camera */}
      <button
        onClick={onToggleVideo}
        disabled={!isConnected || !hasVideoTrack}
        className={`p-3 rounded-full transition-colors duration-150 ${
          !isConnected || !hasVideoTrack
            ? "bg-gray-300 cursor-not-allowed"
            : !isVideoOn
              ? "bg-red-500 hover:bg-red-600"
              : ""
        }`}
        style={
          isConnected && hasVideoTrack && isVideoOn
            ? { backgroundColor: "#9ACBD0" }
            : undefined
        }
        onMouseEnter={(e) => {
          if (isConnected && hasVideoTrack && isVideoOn) e.currentTarget.style.backgroundColor = "#48A6A7";
        }}
        onMouseLeave={(e) => {
          if (isConnected && hasVideoTrack && isVideoOn) e.currentTarget.style.backgroundColor = "#9ACBD0";
        }}
        title={isVideoOn ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoOn ? (
          <Video className="w-5 h-5 text-white" />
        ) : (
          <VideoOff className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Screen Share */}
      <button
        onClick={onToggleScreenShare}
        disabled={!isConnected}
        className={`p-3 rounded-full transition-colors duration-150 ${
          !isConnected
            ? "bg-gray-300 cursor-not-allowed"
            : ""
        }`}
        style={
          isConnected
            ? { backgroundColor: isScreenSharing ? "#48A6A7" : "#9ACBD0" }
            : undefined
        }
        onMouseEnter={(e) => {
          if (isConnected) e.currentTarget.style.backgroundColor = isScreenSharing ? "#006A71" : "#48A6A7";
        }}
        onMouseLeave={(e) => {
          if (isConnected) e.currentTarget.style.backgroundColor = isScreenSharing ? "#48A6A7" : "#9ACBD0";
        }}
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
      >
        {isScreenSharing ? (
          <MonitorOff className="w-5 h-5 text-white" />
        ) : (
          <Monitor className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Participants toggle */}
      <button
        onClick={onToggleParticipants}
        className="p-3 rounded-full transition-colors duration-150 relative"
        style={{ backgroundColor: isParticipantPanelOpen ? "#48A6A7" : "#9ACBD0" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isParticipantPanelOpen ? "#006A71" : "#48A6A7")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isParticipantPanelOpen ? "#48A6A7" : "#9ACBD0")}
        title="Participants"
      >
        <Users className="w-5 h-5 text-white" />
        {/* Count badge */}
        <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#006A71" }}>
          {participantCount}
        </span>
      </button>

      {/* Separator */}
      <div className="w-px h-8 mx-1" style={{ backgroundColor: "#9ACBD0" }} />

      {/* End / Leave button */}
      {role === "teacher" && onEndSession ? (
        <button
          onClick={onEndSession}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-full transition-colors duration-150 font-medium text-sm"
          title="End session for all"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End</span>
        </button>
      ) : onLeaveSession ? (
        <button
          onClick={onLeaveSession}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-full transition-colors duration-150 font-medium text-sm"
          title="Leave session"
        >
          <LogOut className="w-5 h-5" />
          <span>Leave</span>
        </button>
      ) : null}
    </div>
  );
}
