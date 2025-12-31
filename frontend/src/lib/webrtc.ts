/**
 * WebRTC Manager for Tutoring Sessions - Phase 3
 *
 * Audio-only WebRTC with strict role-based determinism:
 * - Teacher ALWAYS creates the offer
 * - Student NEVER creates an offer
 * - Student ALWAYS answers
 * - Backend only relays signaling messages
 *
 * Non-Negotiable Rules:
 * - One peer per session (keyed by room_id)
 * - Explicit lifecycle: create → use → close → destroy
 * - Media lifecycle tied to session presence
 * - Reconnect works without page reload
 */

import { TutoringWebSocketManager } from "./websocket";

export type WebRTCConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface WebRTCEventHandlers {
  onConnectionStateChange?: (state: WebRTCConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onRemoteStreamEnded?: () => void;
  onError?: (error: Error) => void;
  onLocalAudioReady?: (stream: MediaStream) => void;
}

// PeerConnection storage keyed by room_id
const peerConnections: Map<string, RTCPeerConnection> = new Map();

// ICE servers configuration (STUN only, no TURN as per scope)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * WebRTC Manager Class
 *
 * Manages audio-only WebRTC connection for a tutoring session.
 * Strictly enforces role-based offer/answer flow.
 */
export class WebRTCManager {
  private roomId: string;
  private role: "teacher" | "student";
  private wsManager: TutoringWebSocketManager;
  private handlers: WebRTCEventHandlers = {};

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private connectionState: WebRTCConnectionState = "new";

  // Pending ICE candidates (received before peer connection is ready)
  private pendingIceCandidates: RTCIceCandidate[] = [];

  // Flag to track if we're in the process of setting remote description
  private isSettingRemoteDescription = false;

  constructor(
    roomId: string,
    role: "teacher" | "student",
    wsManager: TutoringWebSocketManager
  ) {
    this.roomId = roomId;
    this.role = role;
    this.wsManager = wsManager;

    console.log(`[WebRTC] Created manager for room ${roomId} as ${role}`);
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: WebRTCEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): WebRTCConnectionState {
    return this.connectionState;
  }

  /**
   * Check if peer connection exists
   */
  hasPeerConnection(): boolean {
    return this.peerConnection !== null;
  }

  /**
   * Check if local audio is active
   */
  hasLocalAudio(): boolean {
    return (
      this.localStream !== null && this.localStream.getAudioTracks().length > 0
    );
  }

  /**
   * Check if remote audio is active
   */
  hasRemoteAudio(): boolean {
    return (
      this.remoteStream !== null &&
      this.remoteStream.getAudioTracks().length > 0
    );
  }

  /**
   * Initialize media and peer connection
   *
   * For teacher: Acquires audio and prepares peer connection
   * For student: Acquires audio and prepares peer connection, waits for offer
   *
   * NOTE: Teacher does NOT send offer here. Offer is sent when student connects
   * (via handlePeerRejoined or sendOffer method)
   */
  async initialize(): Promise<void> {
    console.log(`[WebRTC] Initializing as ${this.role}`);

    // Clean up any existing peer connection for this room
    this.destroyExistingPeer();

    try {
      // Acquire audio-only media
      await this.acquireLocalAudio();

      // Create peer connection
      this.createPeerConnection();

      // Both roles just wait after initialization
      // Teacher will send offer when student connects (handlePeerRejoined)
      // Student will receive offer from teacher
      console.log(`[WebRTC] ${this.role} initialized and ready`);
    } catch (error) {
      console.error("[WebRTC] Initialization failed:", error);
      this.setConnectionState("failed");
      this.handlers.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Handle incoming WebRTC signal from the other participant
   */
  async handleSignal(
    signalType: string,
    signalData: unknown,
    senderRole: "teacher" | "student"
  ): Promise<void> {
    console.log(`[WebRTC] Received signal: ${signalType} from ${senderRole}`);

    switch (signalType) {
      case "offer":
        await this.handleOffer(
          signalData as RTCSessionDescriptionInit,
          senderRole
        );
        break;
      case "answer":
        await this.handleAnswer(
          signalData as RTCSessionDescriptionInit,
          senderRole
        );
        break;
      case "ice_candidate":
        await this.handleIceCandidate(signalData as RTCIceCandidateInit);
        break;
      default:
        console.warn(`[WebRTC] Unknown signal type: ${signalType}`);
    }
  }

  /**
   * Handle peer leaving - clean up connection
   */
  handlePeerLeft(): void {
    console.log("[WebRTC] Peer left - cleaning up connection");

    // Close and clean up peer connection
    this.closePeerConnection();

    // Notify about remote stream ending
    this.handlers.onRemoteStreamEnded?.();

    // Keep local stream active for reconnection
    // Don't destroy local audio - will be reused when peer rejoins
  }

  /**
   * Handle peer rejoining - teacher re-initiates offer
   */
  async handlePeerRejoined(): Promise<void> {
    console.log(`[WebRTC] Peer rejoined - ${this.role} handling reconnection`);

    // Clean up any stale peer connection
    this.closePeerConnection();

    // Re-create peer connection
    this.createPeerConnection();

    // Teacher always re-initiates
    if (this.role === "teacher") {
      console.log("[WebRTC] Teacher re-creating offer for rejoined peer");
      await this.createAndSendOffer();
    }
    // Student waits for new offer
  }

  /**
   * Send offer to peer (teacher only)
   * Called when student connects for the first time
   */
  async sendOffer(): Promise<void> {
    if (this.role !== "teacher") {
      console.error("[WebRTC] Only teacher can send offer");
      return;
    }

    if (!this.peerConnection) {
      console.error("[WebRTC] No peer connection to send offer");
      return;
    }

    // Check if we already have a local description (offer already sent)
    if (this.peerConnection.localDescription) {
      console.log("[WebRTC] Offer already sent, re-creating...");
      // Close and re-create peer connection for clean slate
      this.closePeerConnection();
      this.createPeerConnection();
    }

    await this.createAndSendOffer();
  }

  /**
   * Mute/unmute local audio
   */
  setLocalAudioEnabled(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
        console.log(`[WebRTC] Local audio ${enabled ? "unmuted" : "muted"}`);
      });
    }
  }

  /**
   * Check if local audio is muted
   */
  isLocalAudioMuted(): boolean {
    if (!this.localStream) return true;
    const track = this.localStream.getAudioTracks()[0];
    return track ? !track.enabled : true;
  }

  /**
   * Clean up and destroy
   */
  destroy(): void {
    console.log("[WebRTC] Destroying manager");

    // Close peer connection
    this.closePeerConnection();

    // Stop local media
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    // Remove from global map
    peerConnections.delete(this.roomId);

    this.setConnectionState("closed");
  }

  // ==================== Private Methods ====================

  /**
   * Acquire local audio stream (audio only, no video)
   */
  private async acquireLocalAudio(): Promise<void> {
    console.log("[WebRTC] Acquiring local audio...");

    // Check for secure context (required for getUserMedia)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw new Error(
        "Microphone access requires a secure context (HTTPS or localhost). " +
          "Please access this page via HTTPS."
      );
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false, // Explicitly no video
      });

      console.log(
        "[WebRTC] Local audio acquired:",
        this.localStream.getAudioTracks().map((t) => t.label)
      );

      this.handlers.onLocalAudioReady?.(this.localStream);
    } catch (error) {
      const err = error as Error;
      if (err.name === "NotAllowedError") {
        throw new Error(
          "Microphone permission denied. Please allow microphone access."
        );
      } else if (err.name === "NotFoundError") {
        throw new Error("No microphone found. Please connect a microphone.");
      } else {
        throw new Error(`Failed to access microphone: ${err.message}`);
      }
    }
  }

  /**
   * Create RTCPeerConnection with event handlers
   */
  private createPeerConnection(): void {
    console.log("[WebRTC] Creating peer connection");

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Store in global map
    peerConnections.set(this.roomId, this.peerConnection);

    // Add local audio track to connection
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        console.log("[WebRTC] Adding local audio track:", track.label);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Sending ICE candidate");
        this.wsManager.sendWebRTCSignal(
          "ice_candidate",
          event.candidate.toJSON()
        );
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log("[WebRTC] ICE connection state:", state);

      switch (state) {
        case "checking":
          this.setConnectionState("connecting");
          break;
        case "connected":
        case "completed":
          this.setConnectionState("connected");
          break;
        case "disconnected":
          this.setConnectionState("disconnected");
          break;
        case "failed":
          this.setConnectionState("failed");
          this.handlers.onError?.(new Error("ICE connection failed"));
          break;
        case "closed":
          this.setConnectionState("closed");
          break;
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log("[WebRTC] Connection state:", state);
    };

    // Handle remote track
    this.peerConnection.ontrack = (event) => {
      console.log("[WebRTC] Remote track received:", event.track.kind);

      if (event.track.kind === "audio") {
        this.remoteStream = event.streams[0] || new MediaStream([event.track]);
        this.attachRemoteAudio();
        this.handlers.onRemoteStream?.(this.remoteStream);
      }
    };

    this.setConnectionState("new");
  }

  /**
   * Create and send offer (teacher only)
   */
  private async createAndSendOffer(): Promise<void> {
    // Explicit role check - teacher ALWAYS creates offer
    if (this.role !== "teacher") {
      console.error("[WebRTC] VIOLATION: Only teacher can create offer");
      return;
    }

    if (!this.peerConnection) {
      console.error("[WebRTC] No peer connection");
      return;
    }

    try {
      console.log("[WebRTC] Creating offer...");
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false, // Explicitly no video
      });

      console.log("[WebRTC] Setting local description (offer)");
      await this.peerConnection.setLocalDescription(offer);

      console.log("[WebRTC] Sending offer via WebSocket");
      this.wsManager.sendWebRTCSignal("offer", offer);

      this.setConnectionState("connecting");
    } catch (error) {
      console.error("[WebRTC] Failed to create offer:", error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Handle incoming offer (student only)
   */
  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    senderRole: "teacher" | "student"
  ): Promise<void> {
    // Explicit role check - only teacher can send offers
    if (senderRole !== "teacher") {
      console.error("[WebRTC] VIOLATION: Offer received from non-teacher");
      return;
    }

    // Explicit role check - only student handles offers
    if (this.role !== "student") {
      console.log("[WebRTC] Ignoring offer - not a student");
      return;
    }

    if (!this.peerConnection) {
      console.log("[WebRTC] Creating peer connection to handle offer");
      this.createPeerConnection();
    }

    try {
      this.isSettingRemoteDescription = true;

      console.log("[WebRTC] Setting remote description (offer)");
      await this.peerConnection!.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      this.isSettingRemoteDescription = false;

      // Process any pending ICE candidates
      await this.processPendingIceCandidates();

      // Create and send answer
      await this.createAndSendAnswer();
    } catch (error) {
      this.isSettingRemoteDescription = false;
      console.error("[WebRTC] Failed to handle offer:", error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Create and send answer (student only)
   */
  private async createAndSendAnswer(): Promise<void> {
    // Explicit role check - student ALWAYS answers
    if (this.role !== "student") {
      console.error("[WebRTC] VIOLATION: Only student can create answer");
      return;
    }

    if (!this.peerConnection) {
      console.error("[WebRTC] No peer connection");
      return;
    }

    try {
      console.log("[WebRTC] Creating answer...");
      const answer = await this.peerConnection.createAnswer();

      console.log("[WebRTC] Setting local description (answer)");
      await this.peerConnection.setLocalDescription(answer);

      console.log("[WebRTC] Sending answer via WebSocket");
      this.wsManager.sendWebRTCSignal("answer", answer);

      this.setConnectionState("connecting");
    } catch (error) {
      console.error("[WebRTC] Failed to create answer:", error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Handle incoming answer (teacher only)
   */
  private async handleAnswer(
    answer: RTCSessionDescriptionInit,
    senderRole: "teacher" | "student"
  ): Promise<void> {
    // Explicit role check - only student can send answers
    if (senderRole !== "student") {
      console.error("[WebRTC] VIOLATION: Answer received from non-student");
      return;
    }

    // Explicit role check - only teacher handles answers
    if (this.role !== "teacher") {
      console.log("[WebRTC] Ignoring answer - not a teacher");
      return;
    }

    if (!this.peerConnection) {
      console.error("[WebRTC] No peer connection to set answer");
      return;
    }

    try {
      this.isSettingRemoteDescription = true;

      console.log("[WebRTC] Setting remote description (answer)");
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      this.isSettingRemoteDescription = false;

      // Process any pending ICE candidates
      await this.processPendingIceCandidates();
    } catch (error) {
      this.isSettingRemoteDescription = false;
      console.error("[WebRTC] Failed to handle answer:", error);
      this.handlers.onError?.(error as Error);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    if (!this.peerConnection) {
      console.log("[WebRTC] Queuing ICE candidate - no peer connection yet");
      this.pendingIceCandidates.push(new RTCIceCandidate(candidate));
      return;
    }

    // If we're still setting remote description, queue the candidate
    if (
      this.isSettingRemoteDescription ||
      !this.peerConnection.remoteDescription
    ) {
      console.log(
        "[WebRTC] Queuing ICE candidate - remote description not set"
      );
      this.pendingIceCandidates.push(new RTCIceCandidate(candidate));
      return;
    }

    try {
      console.log("[WebRTC] Adding ICE candidate");
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("[WebRTC] Failed to add ICE candidate:", error);
    }
  }

  /**
   * Process any pending ICE candidates
   */
  private async processPendingIceCandidates(): Promise<void> {
    if (this.pendingIceCandidates.length === 0) return;

    console.log(
      `[WebRTC] Processing ${this.pendingIceCandidates.length} pending ICE candidates`
    );

    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.peerConnection?.addIceCandidate(candidate);
      } catch (error) {
        console.error("[WebRTC] Failed to add pending ICE candidate:", error);
      }
    }

    this.pendingIceCandidates = [];
  }

  /**
   * Attach remote audio stream to audio element for playback
   */
  private attachRemoteAudio(): void {
    if (!this.remoteStream) return;

    console.log("[WebRTC] Attaching remote audio");

    // Create audio element if not exists
    if (!this.audioElement) {
      this.audioElement = document.createElement("audio");
      this.audioElement.autoplay = true;
      // Don't append to DOM - not needed for playback
    }

    this.audioElement.srcObject = this.remoteStream;

    // Handle autoplay policy
    this.audioElement.play().catch((error) => {
      console.warn("[WebRTC] Autoplay blocked:", error);
      // User interaction may be required
    });
  }

  /**
   * Close peer connection without destroying local media
   */
  private closePeerConnection(): void {
    if (this.peerConnection) {
      console.log("[WebRTC] Closing peer connection");

      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.ontrack = null;

      this.peerConnection.close();
      this.peerConnection = null;

      peerConnections.delete(this.roomId);
    }

    // Clean up remote stream
    this.remoteStream = null;

    // Clear pending candidates
    this.pendingIceCandidates = [];
  }

  /**
   * Destroy any existing peer connection for this room
   */
  private destroyExistingPeer(): void {
    const existing = peerConnections.get(this.roomId);
    if (existing) {
      console.log("[WebRTC] Destroying existing peer connection for room");
      existing.close();
      peerConnections.delete(this.roomId);
    }
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: WebRTCConnectionState): void {
    if (this.connectionState !== state) {
      console.log(`[WebRTC] State change: ${this.connectionState} → ${state}`);
      this.connectionState = state;
      this.handlers.onConnectionStateChange?.(state);
    }
  }
}

/**
 * Get existing peer connection for a room
 */
export function getPeerConnection(roomId: string): RTCPeerConnection | null {
  return peerConnections.get(roomId) || null;
}

/**
 * Check if a peer connection exists for a room
 */
export function hasPeerConnection(roomId: string): boolean {
  return peerConnections.has(roomId);
}

/**
 * Destroy all peer connections (cleanup)
 */
export function destroyAllPeerConnections(): void {
  console.log("[WebRTC] Destroying all peer connections");
  peerConnections.forEach((pc, roomId) => {
    pc.close();
  });
  peerConnections.clear();
}
