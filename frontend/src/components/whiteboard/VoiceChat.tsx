/**
 * VoiceChat — audio-only voice chat bar for the whiteboard.
 *
 * Self-contained: fetches its own LiveKit token, connects to an
 * audio-only LiveKit room, and renders a thin indicator bar showing
 * who is currently speaking plus a mic toggle.
 *
 * Uses its own LiveKitManager instance (not the singleton) so it
 * never conflicts with a tutoring session that may be open at the
 * same time.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import {
  LiveKitManager,
  LiveKitConnectionState,
  ParticipantTrackState,
} from "@/lib/livekit";
import { getVoiceToken } from "@/api/whiteboardService";

interface VoiceChatProps {
  sessionId: string;
  userId: string;
  role: "teacher" | "student";
}

export default function VoiceChat({ sessionId, userId, role }: VoiceChatProps) {
  const [connectionState, setConnectionState] =
    useState<LiveKitConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<
    ParticipantTrackState[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<LiveKitManager | null>(null);
  const mountedRef = useRef(true);

  // Create a dedicated LiveKitManager for whiteboard voice
  const getManager = useCallback((): LiveKitManager => {
    if (!managerRef.current) {
      managerRef.current = new LiveKitManager();
      managerRef.current.setEventHandlers({
        onConnectionStateChange: (state) => {
          if (mountedRef.current) setConnectionState(state);
        },
        onLocalTracksReady: (state) => {
          if (mountedRef.current) setIsMuted(!state.isAudioEnabled);
        },
        onRemoteParticipantsChanged: (participants) => {
          if (mountedRef.current) setRemoteParticipants([...participants]);
        },
        onError: (err, context) => {
          if (err.message?.includes("Client initiated disconnect")) return;
          if (mountedRef.current && (context === "audio" || context === "connection")) {
            setError(err.message);
          }
        },
      });
    }
    return managerRef.current;
  }, []);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const { livekit_token, livekit_ws_url } =
          await getVoiceToken(sessionId);
        if (cancelled) return;

        const manager = getManager();
        await manager.connect(livekit_ws_url, livekit_token, true);
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          console.error("[VoiceChat] Failed to connect:", err);
          setError(
            err instanceof Error ? err.message : "Voice chat unavailable",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      managerRef.current?.disconnect();
      managerRef.current = null;
    };
  }, [sessionId, getManager]);

  const toggleMic = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    const next = !isMuted;
    setIsMuted(next);
    await manager.setAudioEnabled(!next);
  }, [isMuted]);

  // Derive active speakers
  const activeSpeakers = remoteParticipants.filter((p) => p.isSpeaking);

  // Connection dot colour
  const dotColor =
    connectionState === "connected"
      ? "bg-green-500"
      : connectionState === "connecting" || connectionState === "reconnecting"
        ? "bg-yellow-500"
        : "bg-red-500";

  // Don't render anything while disconnected with no error (initial load)
  if (connectionState === "disconnected" && !error) {
    return null;
  }

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#1e1e1e]/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg select-none">
      {/* Connection dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

      {/* Mic toggle */}
      <button
        onClick={toggleMic}
        className={`p-1.5 rounded-full transition-colors ${
          isMuted
            ? "bg-red-500/80 hover:bg-red-500"
            : "bg-white/10 hover:bg-white/20"
        }`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {/* Speaker indicator */}
      <div className="flex items-center gap-1.5 text-sm max-w-[260px] truncate">
        {activeSpeakers.length > 0 ? (
          <>
            <Volume2 size={14} className="shrink-0 text-green-400 animate-pulse" />
            <span className="truncate">
              {activeSpeakers.map((p) => p.name || p.identity).join(", ")}
            </span>
          </>
        ) : (
          <span className="text-white/50 text-xs">
            {connectionState === "connected"
              ? remoteParticipants.length > 0
                ? "No one speaking"
                : "Waiting for others…"
              : error
                ? "Voice unavailable"
                : "Connecting…"}
          </span>
        )}
      </div>
    </div>
  );
}
