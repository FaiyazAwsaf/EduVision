/**
 * useWebRTC Hook - Phase 3
 *
 * React hook for managing WebRTC audio connection in tutoring sessions.
 * Integrates with SessionContext for role-aware connection management.
 *
 * Features:
 * - Automatic WebRTC initialization when both participants are connected
 * - Role-based offer/answer flow (teacher offers, student answers)
 * - Handles participant join/leave/rejoin
 * - Mute/unmute controls
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TutoringWebSocketManager, WebRTCSignalEvent } from "@/lib/websocket";
import { WebRTCManager, WebRTCConnectionState } from "@/lib/webrtc";

export interface UseWebRTCOptions {
  /** Session ID */
  sessionId: string;
  /** Room ID */
  roomId: string;
  /** User's role in the session */
  role: "teacher" | "student";
  /** WebSocket manager for signaling */
  wsManager: TutoringWebSocketManager | null;
  /** Whether both participants are connected */
  peerConnected: boolean;
}

export interface UseWebRTCReturn {
  /** Current WebRTC connection state */
  connectionState: WebRTCConnectionState;
  /** Whether local audio is active */
  hasLocalAudio: boolean;
  /** Whether remote audio is being received */
  hasRemoteAudio: boolean;
  /** Whether local audio is muted */
  isMuted: boolean;
  /** Error message if any */
  error: string | null;
  /** Toggle local audio mute */
  toggleMute: () => void;
  /** Initialize WebRTC connection manually */
  initialize: () => Promise<void>;
  /** Clean up WebRTC connection */
  cleanup: () => void;
}

export function useWebRTC({
  sessionId,
  roomId,
  role,
  wsManager,
  peerConnected,
}: UseWebRTCOptions): UseWebRTCReturn {
  const [connectionState, setConnectionState] =
    useState<WebRTCConnectionState>("new");
  const [hasLocalAudio, setHasLocalAudio] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable references
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const wasInitializedRef = useRef(false);
  const previousPeerConnectedRef = useRef(false);

  /**
   * Handle WebRTC signal from WebSocket
   */
  const handleWebRTCSignal = useCallback(async (event: WebRTCSignalEvent) => {
    const manager = webrtcManagerRef.current;
    if (!manager) {
      console.log("[useWebRTC] Received signal but no manager - ignoring");
      return;
    }

    await manager.handleSignal(
      event.signal_type,
      event.signal_data,
      event.sender_role,
    );
  }, []);

  /**
   * Initialize WebRTC manager
   */
  const initialize = useCallback(async () => {
    if (!wsManager) {
      console.log("[useWebRTC] Cannot initialize - no WebSocket manager");
      return;
    }

    // Create new manager if needed
    if (!webrtcManagerRef.current) {
      console.log(`[useWebRTC] Creating WebRTC manager for room ${roomId}`);
      webrtcManagerRef.current = new WebRTCManager(roomId, role, wsManager);

      // Set up event handlers
      webrtcManagerRef.current.setEventHandlers({
        onConnectionStateChange: (state) => {
          console.log(`[useWebRTC] Connection state: ${state}`);
          setConnectionState(state);
        },
        onRemoteStream: (stream) => {
          console.log("[useWebRTC] Remote audio received");
          setHasRemoteAudio(true);
        },
        onRemoteStreamEnded: () => {
          console.log("[useWebRTC] Remote audio ended");
          setHasRemoteAudio(false);
        },
        onLocalAudioReady: (stream) => {
          console.log("[useWebRTC] Local audio ready");
          setHasLocalAudio(true);
        },
        onError: (err) => {
          console.error("[useWebRTC] Error:", err);
          setError(err.message);
        },
      });
    }

    try {
      setError(null);
      await webrtcManagerRef.current.initialize();
      wasInitializedRef.current = true;
    } catch (err) {
      const errMessage =
        err instanceof Error ? err.message : "Failed to initialize WebRTC";
      setError(errMessage);
    }
  }, [wsManager, roomId, role]);

  /**
   * Clean up WebRTC connection
   */
  const cleanup = useCallback(() => {
    console.log("[useWebRTC] Cleaning up");
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }
    wasInitializedRef.current = false;
    setConnectionState("closed");
    setHasLocalAudio(false);
    setHasRemoteAudio(false);
    setIsMuted(false);
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (webrtcManagerRef.current) {
      const newMuted = !isMuted;
      webrtcManagerRef.current.setLocalAudioEnabled(!newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  /**
   * Set up WebSocket signal handler
   */
  useEffect(() => {
    if (!wsManager) return;

    // Register handler for WebRTC signals
    wsManager.on("webrtcSignal", handleWebRTCSignal);

    return () => {
      wsManager.off("webrtcSignal");
    };
  }, [wsManager, handleWebRTCSignal]);

  // Track if we've ever been connected to peer (for rejoin detection)
  const hadPeerConnectionRef = useRef(false);

  /**
   * Handle peer connection/disconnection
   */
  useEffect(() => {
    const wasPeerConnected = previousPeerConnectedRef.current;
    previousPeerConnectedRef.current = peerConnected;

    // Peer just connected (transition from false to true)
    if (peerConnected && !wasPeerConnected) {
      console.log("[useWebRTC] Peer connected");

      // If we haven't initialized yet, do so now
      if (!wasInitializedRef.current) {
        console.log("[useWebRTC] Initializing on peer connect");
        initialize();
      } else if (role === "teacher") {
        // Teacher is already initialized - give student a moment to initialize
        // then send offer
        const sendOfferWithDelay = async () => {
          // Small delay to allow student to initialize
          await new Promise((resolve) => setTimeout(resolve, 500));

          if (hadPeerConnectionRef.current) {
            // This is a rejoin - peer disconnected and reconnected
            console.log("[useWebRTC] Teacher handling peer rejoin");
            webrtcManagerRef.current?.handlePeerRejoined();
          } else {
            // First time peer connects - just send offer
            console.log("[useWebRTC] Teacher sending offer to connected peer");
            webrtcManagerRef.current?.sendOffer();
          }
          hadPeerConnectionRef.current = true;
        };
        sendOfferWithDelay();
      } else {
        // Student side - just mark that we've had a peer connection
        hadPeerConnectionRef.current = true;
      }
    }

    // Peer disconnected (transition from true to false)
    if (!peerConnected && wasPeerConnected) {
      console.log("[useWebRTC] Peer disconnected");
      webrtcManagerRef.current?.handlePeerLeft();
    }
  }, [peerConnected, initialize, role]);

  /**
   * Auto-initialize for BOTH roles when component mounts
   * Both sides need their manager ready to handle signals.
   * Teacher creates offer, Student waits for offer.
   */
  useEffect(() => {
    if (wsManager && !wasInitializedRef.current) {
      console.log(`[useWebRTC] ${role} auto-initializing`);
      initialize();
    }
  }, [role, wsManager, initialize]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionState,
    hasLocalAudio,
    hasRemoteAudio,
    isMuted,
    error,
    toggleMute,
    initialize,
    cleanup,
  };
}
