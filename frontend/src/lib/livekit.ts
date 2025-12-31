/**
 * LiveKit Media Manager - Phase 4
 *
 * Manages LiveKit room connection and media tracks for tutoring sessions.
 * Extends existing audio-only implementation to support 1-to-1 video.
 *
 * Key Principles:
 * - LiveKit handles all WebRTC negotiation, ICE, and track routing
 * - Backend remains the authority for session lifecycle
 * - Role metadata is passed via tokens (backend-generated)
 * - Video failure must NOT break audio
 * - Clean teardown on disconnect
 *
 * This is a MEDIA layer, not an authority layer.
 */

import {
  Room,
  RoomEvent,
  LocalTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  RemoteParticipant,
  Track,
  ConnectionState,
  createLocalTracks,
  createLocalAudioTrack,
  createLocalVideoTrack,
  TrackPublication,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  DisconnectReason,
} from "livekit-client";

// ==================== Types ====================

export type LiveKitConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface LocalTrackState {
  audioTrack: LocalAudioTrack | null;
  videoTrack: LocalVideoTrack | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  audioError: string | null;
  videoError: string | null;
}

export interface RemoteTrackState {
  audioTrack: RemoteAudioTrack | null;
  videoTrack: RemoteVideoTrack | null;
  participantIdentity: string | null;
  participantName: string | null;
  participantRole: "teacher" | "student" | null;
}

export interface LiveKitEventHandlers {
  onConnectionStateChange?: (state: LiveKitConnectionState) => void;
  onLocalTracksReady?: (state: LocalTrackState) => void;
  onRemoteTracksChanged?: (state: RemoteTrackState) => void;
  onError?: (error: Error, context: string) => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
}

// ==================== LiveKit Manager ====================

/**
 * LiveKit Room Manager
 *
 * Manages a single LiveKit room connection with audio and video tracks.
 * Designed for 1-to-1 tutoring sessions.
 */
export class LiveKitManager {
  private room: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private localVideoTrack: LocalVideoTrack | null = null;
  private remoteAudioTrack: RemoteAudioTrack | null = null;
  private remoteVideoTrack: RemoteVideoTrack | null = null;
  private remoteParticipant: RemoteParticipant | null = null;

  private connectionState: LiveKitConnectionState = "disconnected";
  private handlers: LiveKitEventHandlers = {};

  // Error tracking (video fail should not affect audio)
  private audioError: string | null = null;
  private videoError: string | null = null;

  // Role from metadata
  private role: "teacher" | "student" | null = null;

  // Audio element for remote audio playback
  private audioElement: HTMLAudioElement | null = null;

  constructor() {
    console.log("[LiveKit] Manager created");
  }

  // ==================== Public API ====================

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: LiveKitEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): LiveKitConnectionState {
    return this.connectionState;
  }

  /**
   * Get local track state
   */
  getLocalTrackState(): LocalTrackState {
    return {
      audioTrack: this.localAudioTrack,
      videoTrack: this.localVideoTrack,
      isAudioEnabled: this.localAudioTrack?.isMuted === false,
      isVideoEnabled: this.localVideoTrack?.isMuted === false,
      audioError: this.audioError,
      videoError: this.videoError,
    };
  }

  /**
   * Get remote track state
   */
  getRemoteTrackState(): RemoteTrackState {
    return {
      audioTrack: this.remoteAudioTrack,
      videoTrack: this.remoteVideoTrack,
      participantIdentity: this.remoteParticipant?.identity || null,
      participantName: this.remoteParticipant?.name || null,
      participantRole: this.getParticipantRole(this.remoteParticipant),
    };
  }

  /**
   * Connect to LiveKit room and publish local tracks
   *
   * @param wsUrl LiveKit WebSocket URL
   * @param token LiveKit access token (contains role metadata)
   */
  async connect(wsUrl: string, token: string): Promise<void> {
    if (this.room) {
      console.log("[LiveKit] Already connected, disconnecting first");
      await this.disconnect();
    }

    console.log("[LiveKit] Connecting to room...");
    this.setConnectionState("connecting");

    try {
      // Create room instance
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Audio processing options
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // Video defaults (720p for 1-to-1)
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        },
      });

      // Set up event handlers BEFORE connecting
      this.setupRoomEventHandlers();

      // Connect to room
      await this.room.connect(wsUrl, token);

      console.log("[LiveKit] Connected to room:", this.room.name);
      this.setConnectionState("connected");

      // Parse role from local participant metadata
      this.role = this.getParticipantRole(this.room.localParticipant);
      console.log("[LiveKit] Local participant role:", this.role);

      // Acquire and publish local tracks
      await this.acquireAndPublishLocalTracks();

      // Check for existing remote participants
      this.handleExistingParticipants();

    } catch (error) {
      console.error("[LiveKit] Connection failed:", error);
      this.setConnectionState("disconnected");
      this.handlers.onError?.(error as Error, "connection");
      throw error;
    }
  }

  /**
   * Disconnect from room and clean up all resources
   */
  async disconnect(): Promise<void> {
    console.log("[LiveKit] Disconnecting...");

    // Stop and unpublish local tracks
    await this.cleanupLocalTracks();

    // Disconnect from room
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    // Clean up remote track references
    this.remoteAudioTrack = null;
    this.remoteVideoTrack = null;
    this.remoteParticipant = null;

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    this.setConnectionState("disconnected");
    console.log("[LiveKit] Disconnected");
  }

  /**
   * Toggle local audio mute
   */
  async setAudioEnabled(enabled: boolean): Promise<void> {
    if (this.localAudioTrack) {
      if (enabled) {
        await this.localAudioTrack.unmute();
      } else {
        await this.localAudioTrack.mute();
      }
      console.log(`[LiveKit] Audio ${enabled ? "unmuted" : "muted"}`);
      this.notifyLocalTracksChanged();
    }
  }

  /**
   * Toggle local video
   */
  async setVideoEnabled(enabled: boolean): Promise<void> {
    if (this.localVideoTrack) {
      if (enabled) {
        await this.localVideoTrack.unmute();
      } else {
        await this.localVideoTrack.mute();
      }
      console.log(`[LiveKit] Video ${enabled ? "enabled" : "disabled"}`);
      this.notifyLocalTracksChanged();
    }
  }

  /**
   * Check if audio is muted
   */
  isAudioMuted(): boolean {
    return this.localAudioTrack?.isMuted ?? true;
  }

  /**
   * Check if video is enabled
   */
  isVideoEnabled(): boolean {
    return this.localVideoTrack?.isMuted === false;
  }

  /**
   * Attach local video to element
   */
  attachLocalVideo(element: HTMLVideoElement): void {
    if (this.localVideoTrack) {
      this.localVideoTrack.attach(element);
      console.log("[LiveKit] Local video attached to element");
    }
  }

  /**
   * Detach local video from element
   */
  detachLocalVideo(element: HTMLVideoElement): void {
    if (this.localVideoTrack) {
      this.localVideoTrack.detach(element);
      console.log("[LiveKit] Local video detached from element");
    }
  }

  /**
   * Attach remote video to element
   */
  attachRemoteVideo(element: HTMLVideoElement): void {
    if (this.remoteVideoTrack) {
      this.remoteVideoTrack.attach(element);
      console.log("[LiveKit] Remote video attached to element");
    }
  }

  /**
   * Detach remote video from element
   */
  detachRemoteVideo(element: HTMLVideoElement): void {
    if (this.remoteVideoTrack) {
      this.remoteVideoTrack.detach(element);
      console.log("[LiveKit] Remote video detached from element");
    }
  }

  // ==================== Private Methods ====================

  /**
   * Set up LiveKit room event handlers
   */
  private setupRoomEventHandlers(): void {
    if (!this.room) return;

    // Connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log("[LiveKit] Connection state changed:", state);

      switch (state) {
        case ConnectionState.Connecting:
          this.setConnectionState("connecting");
          break;
        case ConnectionState.Connected:
          this.setConnectionState("connected");
          break;
        case ConnectionState.Reconnecting:
          this.setConnectionState("reconnecting");
          break;
        case ConnectionState.Disconnected:
          this.setConnectionState("disconnected");
          break;
      }
    });

    // Participant connected
    this.room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        console.log("[LiveKit] Participant connected:", participant.identity);
        this.handleRemoteParticipant(participant);
        this.handlers.onParticipantConnected?.(participant);
      }
    );

    // Participant disconnected
    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (participant: RemoteParticipant) => {
        console.log("[LiveKit] Participant disconnected:", participant.identity);

        if (this.remoteParticipant?.identity === participant.identity) {
          this.remoteParticipant = null;
          this.remoteAudioTrack = null;
          this.remoteVideoTrack = null;
          this.notifyRemoteTracksChanged();
        }

        this.handlers.onParticipantDisconnected?.(participant);
      }
    );

    // Track subscribed (remote track available)
    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log(
          `[LiveKit] Track subscribed: ${track.kind} from ${participant.identity}`
        );
        this.handleRemoteTrack(track, participant);
      }
    );

    // Track unsubscribed
    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log(
          `[LiveKit] Track unsubscribed: ${track.kind} from ${participant.identity}`
        );

        if (track.kind === Track.Kind.Audio) {
          if (this.remoteAudioTrack === track) {
            this.remoteAudioTrack = null;
          }
        } else if (track.kind === Track.Kind.Video) {
          if (this.remoteVideoTrack === track) {
            this.remoteVideoTrack = null;
          }
        }

        this.notifyRemoteTracksChanged();
      }
    );

    // Track muted/unmuted
    this.room.on(
      RoomEvent.TrackMuted,
      (publication: TrackPublication, participant: Participant) => {
        console.log(
          `[LiveKit] Track muted: ${publication.kind} by ${participant.identity}`
        );
        if (participant !== this.room?.localParticipant) {
          this.notifyRemoteTracksChanged();
        }
      }
    );

    this.room.on(
      RoomEvent.TrackUnmuted,
      (publication: TrackPublication, participant: Participant) => {
        console.log(
          `[LiveKit] Track unmuted: ${publication.kind} by ${participant.identity}`
        );
        if (participant !== this.room?.localParticipant) {
          this.notifyRemoteTracksChanged();
        }
      }
    );

    // Disconnected
    this.room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log("[LiveKit] Disconnected from room, reason:", reason);
      this.setConnectionState("disconnected");
    });

    // Reconnected
    this.room.on(RoomEvent.Reconnected, () => {
      console.log("[LiveKit] Reconnected to room");
      this.setConnectionState("connected");
    });
  }

  /**
   * Acquire local audio and video tracks, then publish them
   *
   * CRITICAL: Video failure must NOT prevent audio from working
   */
  private async acquireAndPublishLocalTracks(): Promise<void> {
    if (!this.room) return;

    // Reset errors
    this.audioError = null;
    this.videoError = null;

    // Try to acquire audio first (required)
    try {
      console.log("[LiveKit] Acquiring audio track...");
      this.localAudioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      console.log("[LiveKit] Audio track acquired, publishing...");
      await this.room.localParticipant.publishTrack(this.localAudioTrack);
      console.log("[LiveKit] Audio track published");
    } catch (error) {
      const err = error as Error;
      console.error("[LiveKit] Failed to acquire/publish audio:", err);
      this.audioError = this.getMediaErrorMessage(err, "microphone");
      this.handlers.onError?.(err, "audio");
      // Audio failure is critical - notify but continue
    }

    // Try to acquire video (optional - failure should not break session)
    try {
      console.log("[LiveKit] Acquiring video track...");
      this.localVideoTrack = await createLocalVideoTrack({
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
      });

      console.log("[LiveKit] Video track acquired, publishing...");
      await this.room.localParticipant.publishTrack(this.localVideoTrack);
      console.log("[LiveKit] Video track published");
    } catch (error) {
      const err = error as Error;
      console.warn("[LiveKit] Failed to acquire/publish video:", err);
      this.videoError = this.getMediaErrorMessage(err, "camera");
      // Video failure is NOT critical - session continues with audio only
      // Do NOT call onError for video failure - it's expected in some cases
      console.log("[LiveKit] Continuing with audio-only session");
    }

    // Notify handlers of local track state
    this.notifyLocalTracksChanged();
  }

  /**
   * Handle existing participants when joining a room
   */
  private handleExistingParticipants(): void {
    if (!this.room) return;

    // In 1-to-1, there should be at most one other participant
    for (const participant of this.room.remoteParticipants.values()) {
      console.log(
        "[LiveKit] Found existing participant:",
        participant.identity
      );
      this.handleRemoteParticipant(participant);
    }
  }

  /**
   * Handle a remote participant (subscribe to their tracks)
   */
  private handleRemoteParticipant(participant: RemoteParticipant): void {
    this.remoteParticipant = participant;

    // Subscribe to existing tracks
    for (const publication of participant.trackPublications.values()) {
      if (publication.track && publication.isSubscribed) {
        this.handleRemoteTrack(
          publication.track as RemoteTrack,
          participant
        );
      }
    }

    this.notifyRemoteTracksChanged();
  }

  /**
   * Handle a remote track
   */
  private handleRemoteTrack(
    track: RemoteTrack,
    participant: RemoteParticipant
  ): void {
    if (track.kind === Track.Kind.Audio) {
      this.remoteAudioTrack = track as RemoteAudioTrack;
      this.attachRemoteAudio(track as RemoteAudioTrack);
    } else if (track.kind === Track.Kind.Video) {
      this.remoteVideoTrack = track as RemoteVideoTrack;
    }

    this.remoteParticipant = participant;
    this.notifyRemoteTracksChanged();
  }

  /**
   * Attach remote audio for playback
   */
  private attachRemoteAudio(track: RemoteAudioTrack): void {
    console.log("[LiveKit] Attaching remote audio for playback");

    // Create audio element if not exists
    if (!this.audioElement) {
      this.audioElement = document.createElement("audio");
      this.audioElement.autoplay = true;
    }

    track.attach(this.audioElement);

    // Handle autoplay policy
    this.audioElement.play().catch((error) => {
      console.warn("[LiveKit] Autoplay blocked:", error);
    });
  }

  /**
   * Clean up local tracks
   */
  private async cleanupLocalTracks(): Promise<void> {
    console.log("[LiveKit] Cleaning up local tracks...");

    // Stop and unpublish audio track
    if (this.localAudioTrack) {
      try {
        await this.room?.localParticipant.unpublishTrack(this.localAudioTrack);
      } catch (e) {
        // Ignore unpublish errors during cleanup
      }
      this.localAudioTrack.stop();
      this.localAudioTrack = null;
    }

    // Stop and unpublish video track
    if (this.localVideoTrack) {
      try {
        await this.room?.localParticipant.unpublishTrack(this.localVideoTrack);
      } catch (e) {
        // Ignore unpublish errors during cleanup
      }
      this.localVideoTrack.stop();
      this.localVideoTrack = null;
    }

    console.log("[LiveKit] Local tracks cleaned up");
  }

  /**
   * Get user-friendly media error message
   */
  private getMediaErrorMessage(
    error: Error,
    device: "microphone" | "camera"
  ): string {
    const name = error.name;

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return `${device === "microphone" ? "Microphone" : "Camera"} permission denied. Please allow access.`;
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return `No ${device} found. Please connect a ${device}.`;
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      return `${device === "microphone" ? "Microphone" : "Camera"} is in use by another application.`;
    } else if (name === "OverconstrainedError") {
      return `${device === "microphone" ? "Microphone" : "Camera"} doesn't support required settings.`;
    }

    return `Failed to access ${device}: ${error.message}`;
  }

  /**
   * Get participant role from metadata
   */
  private getParticipantRole(
    participant: Participant | null | undefined
  ): "teacher" | "student" | null {
    if (!participant?.metadata) return null;

    try {
      const metadata = JSON.parse(participant.metadata);
      const role = metadata.role?.toLowerCase();
      if (role === "teacher" || role === "student") {
        return role;
      }
    } catch {
      // Invalid metadata
    }

    return null;
  }

  /**
   * Set connection state and notify handlers
   */
  private setConnectionState(state: LiveKitConnectionState): void {
    if (this.connectionState !== state) {
      console.log(
        `[LiveKit] Connection state: ${this.connectionState} → ${state}`
      );
      this.connectionState = state;
      this.handlers.onConnectionStateChange?.(state);
    }
  }

  /**
   * Notify handlers of local track changes
   */
  private notifyLocalTracksChanged(): void {
    this.handlers.onLocalTracksReady?.(this.getLocalTrackState());
  }

  /**
   * Notify handlers of remote track changes
   */
  private notifyRemoteTracksChanged(): void {
    this.handlers.onRemoteTracksChanged?.(this.getRemoteTrackState());
  }
}

// ==================== Singleton Instance ====================

let managerInstance: LiveKitManager | null = null;

/**
 * Get or create the LiveKit manager instance
 */
export function getLiveKitManager(): LiveKitManager {
  if (!managerInstance) {
    managerInstance = new LiveKitManager();
  }
  return managerInstance;
}

/**
 * Destroy the LiveKit manager instance
 */
export async function destroyLiveKitManager(): Promise<void> {
  if (managerInstance) {
    await managerInstance.disconnect();
    managerInstance = null;
  }
}
