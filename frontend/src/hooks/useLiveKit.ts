/**
 * useLiveKit Hook - Phase 4
 *
 * React hook for managing LiveKit room connection and media tracks.
 * Provides state management for audio and video in tutoring sessions.
 *
 * Features:
 * - Automatic connection when token is available
 * - Local and remote track state management
 * - Mute/unmute controls for audio and video
 * - Graceful handling of video permission failures
 * - Clean teardown on unmount
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitManager,
  LiveKitConnectionState,
  LocalTrackState,
  RemoteTrackState,
  getLiveKitManager,
  destroyLiveKitManager,
} from "@/lib/livekit";
import { RemoteParticipant } from "livekit-client";

export interface UseLiveKitOptions {
  /** LiveKit WebSocket URL */
  wsUrl: string | null;
  /** LiveKit access token */
  token: string | null;
  /** User's role in the session */
  role: "teacher" | "student";
  /** Whether to auto-connect when token is available */
  autoConnect?: boolean;
}

export interface UseLiveKitReturn {
  /** Current connection state */
  connectionState: LiveKitConnectionState;
  /** Local track state */
  localTracks: LocalTrackState;
  /** Remote track state */
  remoteTracks: RemoteTrackState;
  /** Whether currently connected */
  isConnected: boolean;
  /** Whether peer is connected */
  isPeerConnected: boolean;
  /** Error message if any */
  error: string | null;
  /** Connect to room */
  connect: () => Promise<void>;
  /** Disconnect from room */
  disconnect: () => Promise<void>;
  /** Toggle audio mute */
  toggleAudio: () => Promise<void>;
  /** Toggle video */
  toggleVideo: () => Promise<void>;
  /** Set audio enabled state */
  setAudioEnabled: (enabled: boolean) => Promise<void>;
  /** Set video enabled state */
  setVideoEnabled: (enabled: boolean) => Promise<void>;
  /** Attach local video to element */
  attachLocalVideo: (element: HTMLVideoElement) => void;
  /** Detach local video from element */
  detachLocalVideo: (element: HTMLVideoElement) => void;
  /** Attach remote video to element */
  attachRemoteVideo: (element: HTMLVideoElement) => void;
  /** Detach remote video from element */
  detachRemoteVideo: (element: HTMLVideoElement) => void;
}

const initialLocalTracks: LocalTrackState = {
  audioTrack: null,
  videoTrack: null,
  isAudioEnabled: false,
  isVideoEnabled: false,
  audioError: null,
  videoError: null,
};

const initialRemoteTracks: RemoteTrackState = {
  audioTrack: null,
  videoTrack: null,
  participantIdentity: null,
  participantName: null,
  participantRole: null,
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
  const [remoteTracks, setRemoteTracks] =
    useState<RemoteTrackState>(initialRemoteTracks);
  const [error, setError] = useState<string | null>(null);
  const [isPeerConnected, setIsPeerConnected] = useState(false);

  // Manager ref
  const managerRef = useRef<LiveKitManager | null>(null);
  const hasConnectedRef = useRef(false);

  /**
   * Get or create manager instance
   */
  const getManager = useCallback((): LiveKitManager => {
    if (!managerRef.current) {
      managerRef.current = getLiveKitManager();

      // Set up event handlers
      managerRef.current.setEventHandlers({
        onConnectionStateChange: (state) => {
          console.log(`[useLiveKit] Connection state: ${state}`);
          setConnectionState(state);
        },
        onLocalTracksReady: (state) => {
          console.log("[useLiveKit] Local tracks updated:", {
            hasAudio: !!state.audioTrack,
            hasVideo: !!state.videoTrack,
            audioEnabled: state.isAudioEnabled,
            videoEnabled: state.isVideoEnabled,
          });
          setLocalTracks(state);

          // Set error if audio failed (critical)
          if (state.audioError) {
            setError(state.audioError);
          }
        },
        onRemoteTracksChanged: (state) => {
          console.log("[useLiveKit] Remote tracks updated:", {
            hasAudio: !!state.audioTrack,
            hasVideo: !!state.videoTrack,
            participant: state.participantName,
          });
          setRemoteTracks(state);
          setIsPeerConnected(!!state.participantIdentity);
        },
        onError: (err, context) => {
          console.error(`[useLiveKit] Error in ${context}:`, err);
          // Only set error for critical failures (audio, connection)
          if (context === "audio" || context === "connection") {
            setError(err.message);
          }
        },
        onParticipantConnected: (participant) => {
          console.log(`[useLiveKit] Peer connected: ${participant.name}`);
          setIsPeerConnected(true);
        },
        onParticipantDisconnected: (participant) => {
          console.log(`[useLiveKit] Peer disconnected: ${participant.name}`);
          setIsPeerConnected(false);
        },
      });
    }

    return managerRef.current;
  }, []);

  /**
   * Connect to LiveKit room
   */
  const connect = useCallback(async () => {
    if (!wsUrl || !token) {
      console.log("[useLiveKit] Cannot connect - missing wsUrl or token");
      return;
    }

    const manager = getManager();

    try {
      setError(null);
      await manager.connect(wsUrl, token);
      hasConnectedRef.current = true;
    } catch (err) {
      const errMessage =
        err instanceof Error ? err.message : "Failed to connect";
      setError(errMessage);
    }
  }, [wsUrl, token, getManager]);

  /**
   * Disconnect from room
   */
  const disconnect = useCallback(async () => {
    const manager = managerRef.current;
    if (manager) {
      await manager.disconnect();
    }
    hasConnectedRef.current = false;
  }, []);

  /**
   * Toggle audio mute
   */
  const toggleAudio = useCallback(async () => {
    const manager = managerRef.current;
    if (manager) {
      const isCurrentlyMuted = manager.isAudioMuted();
      await manager.setAudioEnabled(isCurrentlyMuted);
    }
  }, []);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(async () => {
    const manager = managerRef.current;
    if (manager) {
      const isCurrentlyEnabled = manager.isVideoEnabled();
      await manager.setVideoEnabled(!isCurrentlyEnabled);
    }
  }, []);

  /**
   * Set audio enabled state
   */
  const setAudioEnabled = useCallback(async (enabled: boolean) => {
    const manager = managerRef.current;
    if (manager) {
      await manager.setAudioEnabled(enabled);
    }
  }, []);

  /**
   * Set video enabled state
   */
  const setVideoEnabled = useCallback(async (enabled: boolean) => {
    const manager = managerRef.current;
    if (manager) {
      await manager.setVideoEnabled(enabled);
    }
  }, []);

  /**
   * Attach local video to element
   */
  const attachLocalVideo = useCallback((element: HTMLVideoElement) => {
    const manager = managerRef.current;
    if (manager) {
      manager.attachLocalVideo(element);
    }
  }, []);

  /**
   * Detach local video from element
   */
  const detachLocalVideo = useCallback((element: HTMLVideoElement) => {
    const manager = managerRef.current;
    if (manager) {
      manager.detachLocalVideo(element);
    }
  }, []);

  /**
   * Attach remote video to element
   */
  const attachRemoteVideo = useCallback((element: HTMLVideoElement) => {
    const manager = managerRef.current;
    if (manager) {
      manager.attachRemoteVideo(element);
    }
  }, []);

  /**
   * Detach remote video from element
   */
  const detachRemoteVideo = useCallback((element: HTMLVideoElement) => {
    const manager = managerRef.current;
    if (manager) {
      manager.detachRemoteVideo(element);
    }
  }, []);

  /**
   * Auto-connect when token becomes available
   */
  useEffect(() => {
    if (autoConnect && wsUrl && token && !hasConnectedRef.current) {
      console.log(`[useLiveKit] Auto-connecting as ${role}...`);
      connect();
    }
  }, [autoConnect, wsUrl, token, role, connect]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      console.log("[useLiveKit] Unmounting, cleaning up...");
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
    remoteTracks,
    isConnected: connectionState === "connected",
    isPeerConnected,
    error,
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    setAudioEnabled,
    setVideoEnabled,
    attachLocalVideo,
    detachLocalVideo,
    attachRemoteVideo,
    detachRemoteVideo,
  };
}
