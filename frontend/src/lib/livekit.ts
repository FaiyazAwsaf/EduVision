/**
 * LiveKit Media Manager - Multi-Party
 *
 * Manages LiveKit room connection and media tracks for tutoring sessions.
 * Supports multiple remote participants (teacher + N students).
 *
 * Key Principles:
 * - LiveKit handles all WebRTC negotiation, ICE, and track routing
 * - Backend remains the authority for session lifecycle
 * - Role metadata is passed via tokens (backend-generated)
 * - Video failure must NOT break audio
 * - Clean teardown on disconnect
 */

import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  RemoteParticipant,
  Track,
  ConnectionState,
  createLocalAudioTrack,
  createLocalVideoTrack,
  TrackPublication,
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
  screenShareTrack: LocalVideoTrack | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  audioError: string | null;
  videoError: string | null;
  screenShareError: string | null;
}

/** Per-participant track state for multi-party */
export interface ParticipantTrackState {
  identity: string;
  name: string;
  role: "teacher" | "student" | null;
  audioTrack: RemoteAudioTrack | null;
  videoTrack: RemoteVideoTrack | null;
  screenShareTrack: RemoteVideoTrack | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
}

/** Legacy single-participant state (kept for backward compat) */
export interface RemoteTrackState {
  audioTrack: RemoteAudioTrack | null;
  videoTrack: RemoteVideoTrack | null;
  screenShareTrack: RemoteVideoTrack | null;
  participantIdentity: string | null;
  participantName: string | null;
  participantRole: "teacher" | "student" | null;
}

export interface LiveKitEventHandlers {
  onConnectionStateChange?: (state: LiveKitConnectionState) => void;
  onLocalTracksReady?: (state: LocalTrackState) => void;
  onRemoteTracksChanged?: (state: RemoteTrackState) => void;
  onRemoteParticipantsChanged?: (participants: ParticipantTrackState[]) => void;
  onError?: (error: Error, context: string) => void;
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
}

// ==================== LiveKit Manager ====================

export class LiveKitManager {
  private room: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private localVideoTrack: LocalVideoTrack | null = null;
  private localScreenShareTrack: LocalVideoTrack | null = null;

  // Multi-party: per-participant state
  private remoteParticipantsMap: Map<string, ParticipantTrackState> = new Map();
  // Per-participant audio elements
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  private connectionState: LiveKitConnectionState = "disconnected";
  private handlers: LiveKitEventHandlers = {};

  private audioError: string | null = null;
  private videoError: string | null = null;
  private screenShareError: string | null = null;

  private role: "teacher" | "student" | null = null;

  constructor() {
    console.log("[LiveKit] Manager created");
  }

  // ==================== Public API ====================

  setEventHandlers(handlers: LiveKitEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  getConnectionState(): LiveKitConnectionState {
    return this.connectionState;
  }

  getLocalTrackState(): LocalTrackState {
    return {
      audioTrack: this.localAudioTrack,
      videoTrack: this.localVideoTrack,
      screenShareTrack: this.localScreenShareTrack,
      isAudioEnabled: this.localAudioTrack?.isMuted === false,
      isVideoEnabled: this.localVideoTrack?.isMuted === false,
      isScreenSharing:
        !!this.localScreenShareTrack &&
        this.localScreenShareTrack.isMuted === false,
      audioError: this.audioError,
      videoError: this.videoError,
      screenShareError: this.screenShareError,
    };
  }

  /** Get all remote participants as an array */
  getRemoteParticipants(): ParticipantTrackState[] {
    return Array.from(this.remoteParticipantsMap.values());
  }

  /** Legacy: Get first remote participant state (backward compat) */
  getRemoteTrackState(): RemoteTrackState {
    const first = this.remoteParticipantsMap.values().next().value as ParticipantTrackState | undefined;
    return {
      audioTrack: first?.audioTrack || null,
      videoTrack: first?.videoTrack || null,
      screenShareTrack: first?.screenShareTrack || null,
      participantIdentity: first?.identity || null,
      participantName: first?.name || null,
      participantRole: first?.role || null,
    };
  }

  async connect(wsUrl: string, token: string): Promise<void> {
    if (this.room) {
      await this.disconnect();
    }

    console.log("[LiveKit] Connecting to room...");
    this.setConnectionState("connecting");

    try {
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
      });

      this.setupRoomEventHandlers();
      await this.room.connect(wsUrl, token);

      console.log("[LiveKit] Connected to room:", this.room.name);
      this.setConnectionState("connected");

      this.role = this.getParticipantRole(this.room.localParticipant);
      console.log("[LiveKit] Local participant role:", this.role);

      await this.acquireAndPublishLocalTracks();
      this.handleExistingParticipants();
    } catch (error) {
      console.error("[LiveKit] Connection failed:", error);
      this.setConnectionState("disconnected");
      this.handlers.onError?.(error as Error, "connection");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log("[LiveKit] Disconnecting...");

    await this.cleanupLocalTracks();

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (error) {
        const err = error as Error;
        if (!err.message?.includes("Client initiated disconnect")) {
          console.error("[LiveKit] Unexpected disconnect error:", err);
        }
      }
      this.room = null;
    }

    // Clean up all remote participants
    this.remoteParticipantsMap.clear();

    // Clean up audio elements
    for (const el of this.audioElements.values()) {
      el.pause();
      el.srcObject = null;
    }
    this.audioElements.clear();

    this.setConnectionState("disconnected");
    console.log("[LiveKit] Disconnected");
  }

  async setAudioEnabled(enabled: boolean): Promise<void> {
    if (this.localAudioTrack) {
      if (enabled) {
        await this.localAudioTrack.unmute();
      } else {
        await this.localAudioTrack.mute();
      }
      this.notifyLocalTracksChanged();
    }
  }

  async setVideoEnabled(enabled: boolean): Promise<void> {
    if (this.localVideoTrack) {
      if (enabled) {
        await this.localVideoTrack.unmute();
      } else {
        await this.localVideoTrack.mute();
      }
      this.notifyLocalTracksChanged();
    }
  }

  isAudioMuted(): boolean {
    return this.localAudioTrack?.isMuted ?? true;
  }

  isVideoEnabled(): boolean {
    return this.localVideoTrack?.isMuted === false;
  }

  isScreenSharing(): boolean {
    return (
      !!this.localScreenShareTrack &&
      this.localScreenShareTrack.isMuted === false
    );
  }

  async startScreenShare(): Promise<void> {
    if (!this.room) return;
    if (this.localScreenShareTrack) return;

    try {
      this.screenShareError = null;
      const { createLocalScreenTracks } = await import("livekit-client");

      const tracks = await createLocalScreenTracks({
        audio: true,
        resolution: { width: 1920, height: 1080, frameRate: 15 },
      });

      const screenTrack = tracks.find(
        (t) => t.kind === Track.Kind.Video,
      ) as LocalVideoTrack | undefined;

      if (!screenTrack) throw new Error("No screen track created");

      this.localScreenShareTrack = screenTrack;

      screenTrack.mediaStreamTrack.addEventListener("ended", () => {
        this.stopScreenShare();
      });

      await this.room.localParticipant.publishTrack(screenTrack, {
        name: "screen",
        source: Track.Source.ScreenShare,
      });

      this.notifyLocalTracksChanged();
    } catch (error) {
      const err = error as Error;
      this.screenShareError = this.getScreenShareErrorMessage(err);
      this.handlers.onError?.(err, "screen-share");
      if (this.localScreenShareTrack) {
        this.localScreenShareTrack.stop();
        this.localScreenShareTrack = null;
      }
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.localScreenShareTrack) return;

    try {
      if (this.room) {
        await this.room.localParticipant.unpublishTrack(
          this.localScreenShareTrack,
        );
      }
      this.localScreenShareTrack.stop();
      this.localScreenShareTrack = null;
      this.screenShareError = null;
      this.notifyLocalTracksChanged();
    } catch (error) {
      if (this.localScreenShareTrack) {
        this.localScreenShareTrack.stop();
        this.localScreenShareTrack = null;
      }
      this.notifyLocalTracksChanged();
    }
  }

  async toggleScreenShare(): Promise<void> {
    if (this.isScreenSharing()) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  // ─── Local track attach/detach ──────────────────────────────────────

  attachLocalVideo(element: HTMLVideoElement): void {
    this.localVideoTrack?.attach(element);
  }

  detachLocalVideo(element: HTMLVideoElement): void {
    this.localVideoTrack?.detach(element);
  }

  attachLocalScreenShare(element: HTMLVideoElement): void {
    this.localScreenShareTrack?.attach(element);
  }

  detachLocalScreenShare(element: HTMLVideoElement): void {
    this.localScreenShareTrack?.detach(element);
  }

  // ─── Per-participant attach/detach ──────────────────────────────────

  attachParticipantVideo(identity: string, element: HTMLVideoElement): void {
    const p = this.remoteParticipantsMap.get(identity);
    if (p?.videoTrack) {
      p.videoTrack.attach(element);
    }
  }

  detachParticipantVideo(identity: string, element: HTMLVideoElement): void {
    const p = this.remoteParticipantsMap.get(identity);
    if (p?.videoTrack) {
      p.videoTrack.detach(element);
    }
  }

  attachParticipantScreenShare(
    identity: string,
    element: HTMLVideoElement,
  ): void {
    const p = this.remoteParticipantsMap.get(identity);
    if (p?.screenShareTrack) {
      p.screenShareTrack.attach(element);
    }
  }

  detachParticipantScreenShare(
    identity: string,
    element: HTMLVideoElement,
  ): void {
    const p = this.remoteParticipantsMap.get(identity);
    if (p?.screenShareTrack) {
      p.screenShareTrack.detach(element);
    }
  }

  // ==================== Private Methods ====================

  private setupRoomEventHandlers(): void {
    if (!this.room) return;

    this.room.on(
      RoomEvent.ConnectionStateChanged,
      (state: ConnectionState) => {
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
      },
    );

    this.room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        console.log("[LiveKit] Participant connected:", participant.identity);
        this.upsertParticipant(participant);
        this.notifyRemoteParticipantsChanged();
        this.handlers.onParticipantConnected?.(participant);
      },
    );

    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (participant: RemoteParticipant) => {
        console.log("[LiveKit] Participant disconnected:", participant.identity);
        this.remoteParticipantsMap.delete(participant.identity);
        // Clean up audio element
        const audioEl = this.audioElements.get(participant.identity);
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
          this.audioElements.delete(participant.identity);
        }
        this.notifyRemoteParticipantsChanged();
        this.handlers.onParticipantDisconnected?.(participant);
      },
    );

    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        console.log(
          `[LiveKit] Track subscribed: ${track.kind} (source: ${publication.source}) from ${participant.identity}`,
        );
        this.handleRemoteTrack(track, publication, participant);
      },
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant,
      ) => {
        console.log(
          `[LiveKit] Track unsubscribed: ${track.kind} (source: ${publication.source}) from ${participant.identity}`,
        );
        const state = this.remoteParticipantsMap.get(participant.identity);
        if (state) {
          if (track.kind === Track.Kind.Audio && state.audioTrack === track) {
            state.audioTrack = null;
            state.isAudioEnabled = false;
          } else if (track.kind === Track.Kind.Video) {
            if (
              publication.source === Track.Source.ScreenShare &&
              state.screenShareTrack === track
            ) {
              state.screenShareTrack = null;
            } else if (state.videoTrack === track) {
              state.videoTrack = null;
              state.isVideoEnabled = false;
            }
          }
        }
        this.notifyRemoteParticipantsChanged();
      },
    );

    this.room.on(
      RoomEvent.TrackMuted,
      (publication: TrackPublication, participant: Participant) => {
        if (participant !== this.room?.localParticipant) {
          const state = this.remoteParticipantsMap.get(participant.identity);
          if (state) {
            if (publication.kind === Track.Kind.Audio)
              state.isAudioEnabled = false;
            if (
              publication.kind === Track.Kind.Video &&
              publication.source !== Track.Source.ScreenShare
            )
              state.isVideoEnabled = false;
          }
          this.notifyRemoteParticipantsChanged();
        }
      },
    );

    this.room.on(
      RoomEvent.TrackUnmuted,
      (publication: TrackPublication, participant: Participant) => {
        if (participant !== this.room?.localParticipant) {
          const state = this.remoteParticipantsMap.get(participant.identity);
          if (state) {
            if (publication.kind === Track.Kind.Audio)
              state.isAudioEnabled = true;
            if (
              publication.kind === Track.Kind.Video &&
              publication.source !== Track.Source.ScreenShare
            )
              state.isVideoEnabled = true;
          }
          this.notifyRemoteParticipantsChanged();
        }
      },
    );

    this.room.on(
      RoomEvent.ActiveSpeakersChanged,
      (speakers: Participant[]) => {
        const speakerIds = new Set(speakers.map((s) => s.identity));
        for (const [id, state] of this.remoteParticipantsMap) {
          state.isSpeaking = speakerIds.has(id);
        }
        this.notifyRemoteParticipantsChanged();
      },
    );

    this.room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log("[LiveKit] Disconnected from room, reason:", reason);
      this.setConnectionState("disconnected");
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.log("[LiveKit] Reconnected to room");
      this.setConnectionState("connected");
    });
  }

  private async acquireAndPublishLocalTracks(): Promise<void> {
    if (!this.room) return;

    this.audioError = null;
    this.videoError = null;

    // Audio (required)
    try {
      this.localAudioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      await this.room.localParticipant.publishTrack(this.localAudioTrack);
    } catch (error) {
      const err = error as Error;
      this.audioError = this.getMediaErrorMessage(err, "microphone");
      this.handlers.onError?.(err, "audio");
    }

    // Video (optional - failure is non-critical)
    try {
      this.localVideoTrack = await createLocalVideoTrack({
        resolution: { width: 1280, height: 720, frameRate: 30 },
      });
      await this.room.localParticipant.publishTrack(this.localVideoTrack);
    } catch (error) {
      const err = error as Error;
      this.videoError = this.getMediaErrorMessage(err, "camera");
      console.log("[LiveKit] Continuing with audio-only session");
    }

    this.notifyLocalTracksChanged();
  }

  private handleExistingParticipants(): void {
    if (!this.room) return;
    for (const participant of this.room.remoteParticipants.values()) {
      console.log(
        "[LiveKit] Found existing participant:",
        participant.identity,
      );
      this.upsertParticipant(participant);
      // Subscribe to existing tracks
      for (const publication of participant.trackPublications.values()) {
        if (publication.track && publication.isSubscribed) {
          this.handleRemoteTrack(
            publication.track as RemoteTrack,
            publication as RemoteTrackPublication,
            participant,
          );
        }
      }
    }
    this.notifyRemoteParticipantsChanged();
  }

  /** Upsert a participant into the map */
  private upsertParticipant(participant: RemoteParticipant): void {
    const existing = this.remoteParticipantsMap.get(participant.identity);
    if (!existing) {
      this.remoteParticipantsMap.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        role: this.getParticipantRole(participant),
        audioTrack: null,
        videoTrack: null,
        screenShareTrack: null,
        isAudioEnabled: false,
        isVideoEnabled: false,
        isSpeaking: false,
      });
    } else {
      existing.name = participant.name || participant.identity;
      existing.role = this.getParticipantRole(participant);
    }
  }

  private handleRemoteTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): void {
    this.upsertParticipant(participant);
    const state = this.remoteParticipantsMap.get(participant.identity)!;

    if (track.kind === Track.Kind.Audio) {
      state.audioTrack = track as RemoteAudioTrack;
      state.isAudioEnabled = !publication.isMuted;
      this.attachRemoteAudio(participant.identity, track as RemoteAudioTrack);
    } else if (track.kind === Track.Kind.Video) {
      if (publication.source === Track.Source.ScreenShare) {
        state.screenShareTrack = track as RemoteVideoTrack;
      } else {
        state.videoTrack = track as RemoteVideoTrack;
        state.isVideoEnabled = !publication.isMuted;
      }
    }

    this.notifyRemoteParticipantsChanged();
  }

  private attachRemoteAudio(
    identity: string,
    track: RemoteAudioTrack,
  ): void {
    let el = this.audioElements.get(identity);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      this.audioElements.set(identity, el);
    }
    track.attach(el);
    el.play().catch(() => {});
  }

  private async cleanupLocalTracks(): Promise<void> {
    if (this.localAudioTrack) {
      try {
        await this.room?.localParticipant.unpublishTrack(this.localAudioTrack);
      } catch {}
      this.localAudioTrack.stop();
      this.localAudioTrack = null;
    }

    if (this.localVideoTrack) {
      try {
        await this.room?.localParticipant.unpublishTrack(this.localVideoTrack);
      } catch {}
      this.localVideoTrack.stop();
      this.localVideoTrack = null;
    }

    if (this.localScreenShareTrack) {
      try {
        await this.room?.localParticipant.unpublishTrack(
          this.localScreenShareTrack,
        );
      } catch {}
      this.localScreenShareTrack.stop();
      this.localScreenShareTrack = null;
    }
  }

  private getMediaErrorMessage(
    error: Error,
    device: "microphone" | "camera",
  ): string {
    const name = error.name;
    const label = device === "microphone" ? "Microphone" : "Camera";

    if (name === "NotAllowedError" || name === "PermissionDeniedError")
      return `${label} permission denied. Please allow access.`;
    if (name === "NotFoundError" || name === "DevicesNotFoundError")
      return `No ${device} found. Please connect a ${device}.`;
    if (name === "NotReadableError" || name === "TrackStartError")
      return `${label} is in use by another application.`;
    if (name === "OverconstrainedError")
      return `${label} doesn't support required settings.`;
    return `Failed to access ${device}: ${error.message}`;
  }

  private getScreenShareErrorMessage(error: Error): string {
    const name = error.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError")
      return "Screen sharing permission denied or cancelled.";
    if (name === "NotFoundError") return "No screen available to share.";
    if (name === "NotReadableError")
      return "Cannot access screen. It may be in use.";
    if (name === "AbortError") return "Screen sharing was cancelled.";
    return `Failed to share screen: ${error.message}`;
  }

  private getParticipantRole(
    participant: Participant | null | undefined,
  ): "teacher" | "student" | null {
    if (!participant?.metadata) return null;
    try {
      const metadata = JSON.parse(participant.metadata);
      const role = metadata.role?.toLowerCase();
      if (role === "teacher" || role === "student") return role;
    } catch {}
    return null;
  }

  private setConnectionState(state: LiveKitConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.handlers.onConnectionStateChange?.(state);
    }
  }

  private notifyLocalTracksChanged(): void {
    this.handlers.onLocalTracksReady?.(this.getLocalTrackState());
  }

  private notifyRemoteParticipantsChanged(): void {
    const participants = this.getRemoteParticipants();
    this.handlers.onRemoteParticipantsChanged?.(participants);
    // Legacy compat
    this.handlers.onRemoteTracksChanged?.(this.getRemoteTrackState());
  }
}

// ==================== Singleton ====================

let managerInstance: LiveKitManager | null = null;

export function getLiveKitManager(): LiveKitManager {
  if (!managerInstance) {
    managerInstance = new LiveKitManager();
  }
  return managerInstance;
}

export async function destroyLiveKitManager(): Promise<void> {
  if (managerInstance) {
    await managerInstance.disconnect();
    managerInstance = null;
  }
}
