/**
 * useLiveKit Hook - Multi-Party
 *
 * React hook for managing LiveKit room connection and media tracks.
 * Supports multiple remote participants for batch tutoring sessions.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitManager,
  LiveKitConnectionState,
  LocalTrackState,
  ParticipantTrackState,
  getLiveKitManager,
} from "@/lib/livekit";

export interface UseLiveKitOptions {
  wsUrl: string | null;
  token: string | null;
  role: "teacher" | "student";
  autoConnect?: boolean;
}

export interface UseLiveKitReturn {
  connectionState: LiveKitConnectionState;
  localTracks: LocalTrackState;
  /** All remote participants with their tracks */
  remoteParticipants: ParticipantTrackState[];
  isConnected: boolean;
  /** Number of remote participants connected */
  peerCount: number;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setAudioEnabled: (enabled: boolean) => Promise<void>;
  setVideoEnabled: (enabled: boolean) => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  attachLocalVideo: (element: HTMLVideoElement) => void;
  detachLocalVideo: (element: HTMLVideoElement) => void;
  attachLocalScreenShare: (element: HTMLVideoElement) => void;
  detachLocalScreenShare: (element: HTMLVideoElement) => void;
  attachParticipantVideo: (
    identity: string,
    element: HTMLVideoElement,
  ) => void;
  detachParticipantVideo: (
    identity: string,
    element: HTMLVideoElement,
  ) => void;
  attachParticipantScreenShare: (
    identity: string,
    element: HTMLVideoElement,
  ) => void;
  detachParticipantScreenShare: (
    identity: string,
    element: HTMLVideoElement,
  ) => void;
}

const initialLocalTracks: LocalTrackState = {
  audioTrack: null,
  videoTrack: null,
  screenShareTrack: null,
  isAudioEnabled: false,
  isVideoEnabled: false,
  isScreenSharing: false,
  audioError: null,
  videoError: null,
  screenShareError: null,
};

export function useLiveKit({
  wsUrl,
  token,
  role,
  autoConnect = true,
}: UseLiveKitOptions): UseLiveKitReturn {
  const [connectionState, setConnectionState] =
    useState<LiveKitConnectionState>("disconnected");
  const [localTracks, setLocalTracks] =
    useState<LocalTrackState>(initialLocalTracks);
  const [remoteParticipants, setRemoteParticipants] = useState<
    ParticipantTrackState[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<LiveKitManager | null>(null);
  const hasConnectedRef = useRef(false);

  const getManager = useCallback((): LiveKitManager => {
    if (!managerRef.current) {
      managerRef.current = getLiveKitManager();

      managerRef.current.setEventHandlers({
        onConnectionStateChange: (state) => {
          setConnectionState(state);
        },
        onLocalTracksReady: (state) => {
          setLocalTracks(state);
          if (state.audioError) {
            setError(state.audioError);
          }
        },
        onRemoteParticipantsChanged: (participants) => {
          setRemoteParticipants([...participants]);
        },
        onError: (err, context) => {
          if (err.message?.includes("Client initiated disconnect")) return;
          if (context === "audio" || context === "connection") {
            setError(err.message);
          }
        },
      });
    }
    return managerRef.current;
  }, []);

  const connect = useCallback(async () => {
    if (!wsUrl || !token) return;
    const manager = getManager();
    try {
      setError(null);
      await manager.connect(wsUrl, token);
      hasConnectedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [wsUrl, token, getManager]);

  const disconnect = useCallback(async () => {
    const manager = managerRef.current;
    if (manager) await manager.disconnect();
    hasConnectedRef.current = false;
  }, []);

  const toggleAudio = useCallback(async () => {
    const m = managerRef.current;
    if (m) await m.setAudioEnabled(m.isAudioMuted());
  }, []);

  const toggleVideo = useCallback(async () => {
    const m = managerRef.current;
    if (m) await m.setVideoEnabled(!m.isVideoEnabled());
  }, []);

  const setAudioEnabled = useCallback(async (enabled: boolean) => {
    await managerRef.current?.setAudioEnabled(enabled);
  }, []);

  const setVideoEnabled = useCallback(async (enabled: boolean) => {
    await managerRef.current?.setVideoEnabled(enabled);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      await managerRef.current?.startScreenShare();
    } catch {}
  }, []);

  const stopScreenShare = useCallback(async () => {
    await managerRef.current?.stopScreenShare();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    await managerRef.current?.toggleScreenShare();
  }, []);

  const attachLocalVideo = useCallback((el: HTMLVideoElement) => {
    managerRef.current?.attachLocalVideo(el);
  }, []);

  const detachLocalVideo = useCallback((el: HTMLVideoElement) => {
    managerRef.current?.detachLocalVideo(el);
  }, []);

  const attachLocalScreenShare = useCallback((el: HTMLVideoElement) => {
    managerRef.current?.attachLocalScreenShare(el);
  }, []);

  const detachLocalScreenShare = useCallback((el: HTMLVideoElement) => {
    managerRef.current?.detachLocalScreenShare(el);
  }, []);

  const attachParticipantVideo = useCallback(
    (identity: string, el: HTMLVideoElement) => {
      managerRef.current?.attachParticipantVideo(identity, el);
    },
    [],
  );

  const detachParticipantVideo = useCallback(
    (identity: string, el: HTMLVideoElement) => {
      managerRef.current?.detachParticipantVideo(identity, el);
    },
    [],
  );

  const attachParticipantScreenShare = useCallback(
    (identity: string, el: HTMLVideoElement) => {
      managerRef.current?.attachParticipantScreenShare(identity, el);
    },
    [],
  );

  const detachParticipantScreenShare = useCallback(
    (identity: string, el: HTMLVideoElement) => {
      managerRef.current?.detachParticipantScreenShare(identity, el);
    },
    [],
  );

  // Auto-connect
  useEffect(() => {
    if (autoConnect && wsUrl && token && !hasConnectedRef.current) {
      connect();
    }
  }, [autoConnect, wsUrl, token, role, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const manager = managerRef.current;
      if (manager && hasConnectedRef.current) {
        manager.disconnect();
      }
      managerRef.current = null;
    };
  }, []);

  return {
    connectionState,
    localTracks,
    remoteParticipants,
    isConnected: connectionState === "connected",
    peerCount: remoteParticipants.length,
    error,
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setAudioEnabled,
    setVideoEnabled,
    startScreenShare,
    stopScreenShare,
    attachLocalVideo,
    detachLocalVideo,
    attachLocalScreenShare,
    detachLocalScreenShare,
    attachParticipantVideo,
    detachParticipantVideo,
    attachParticipantScreenShare,
    detachParticipantScreenShare,
  };
}
