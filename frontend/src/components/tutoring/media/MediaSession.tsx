/**
 * MediaSession - Google Meet-style multi-party layout
 *
 * Composes MeetGrid, ScreenShareLayout, MeetControlBar, and ParticipantListPanel
 * into a single full-viewport component for tutoring sessions.
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useLiveKit } from "@/hooks/useLiveKit";
import { MeetGrid } from "./MeetGrid";
import { ScreenShareLayout } from "./ScreenShareLayout";
import { MeetControlBar } from "./MeetControlBar";
import { ParticipantListPanel } from "./ParticipantListPanel";
import type { GridParticipant } from "./MeetGrid";
import type { PanelParticipant } from "./ParticipantListPanel";
import { AlertCircle, Loader2 } from "lucide-react";

export interface MediaSessionProps {
  wsUrl: string | null;
  token: string | null;
  role: "teacher" | "student";
  /** Display name of the local user */
  userName: string;
  /** Session label displayed in participants panel */
  sessionLabel?: string;
  /** Called when teacher ends session */
  onEndSession?: () => void;
  /** Called when student leaves session */
  onLeaveSession?: () => void;
}

export function MediaSession({
  wsUrl,
  token,
  role,
  userName,
  sessionLabel,
  onEndSession,
  onLeaveSession,
}: MediaSessionProps) {
  const [isParticipantPanelOpen, setIsParticipantPanelOpen] = useState(false);

  const {
    connectionState,
    localTracks,
    remoteParticipants,
    isConnected,
    peerCount,
    error,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    attachLocalVideo,
    detachLocalVideo,
    attachLocalScreenShare,
    detachLocalScreenShare,
    attachParticipantVideo,
    detachParticipantVideo,
    attachParticipantScreenShare,
    detachParticipantScreenShare,
  } = useLiveKit({ wsUrl, token, role, autoConnect: true });

  // ─── Build unified participant list ─────────────────────────────────

  const localParticipant: GridParticipant = useMemo(
    () => ({
      identity: "local",
      name: userName,
      role,
      isLocal: true,
      hasVideo: localTracks.isVideoEnabled,
      hasAudio: localTracks.isAudioEnabled,
      isSpeaking: false, // Local speaking state not tracked in current implementation
      isOwner: true,
      onAttachVideo: attachLocalVideo,
      onDetachVideo: detachLocalVideo,
    }),
    [userName, role, localTracks.isVideoEnabled, localTracks.isAudioEnabled, attachLocalVideo, detachLocalVideo],
  );

  /** Sorted: owner first, then video-on before video-off */
  const sortedParticipants: GridParticipant[] = useMemo(() => {
    const remotes: GridParticipant[] = remoteParticipants.map((rp) => ({
      identity: rp.identity,
      name: rp.name,
      role: rp.role,
      isLocal: false,
      hasVideo: rp.isVideoEnabled,
      hasAudio: rp.isAudioEnabled,
      isSpeaking: rp.isSpeaking,
      isOwner: false,
      onAttachVideo: (el: HTMLVideoElement) =>
        attachParticipantVideo(rp.identity, el),
      onDetachVideo: (el: HTMLVideoElement) =>
        detachParticipantVideo(rp.identity, el),
    }));

    // Sort: video-on first, then video-off
    remotes.sort((a, b) => {
      if (a.hasVideo && !b.hasVideo) return -1;
      if (!a.hasVideo && b.hasVideo) return 1;
      return 0;
    });

    // Owner (local) always first
    return [localParticipant, ...remotes];
  }, [localParticipant, remoteParticipants, attachParticipantVideo, detachParticipantVideo]);

  // ─── Screen share detection ─────────────────────────────────────────

  const screenShareInfo = useMemo(() => {
    // Check local screen share first
    if (localTracks.isScreenSharing && localTracks.screenShareTrack) {
      return {
        presenterName: userName,
        isLocal: true,
        presenterIdentity: "local",
        onAttach: attachLocalScreenShare,
        onDetach: detachLocalScreenShare,
      };
    }
    // Check remote screen shares
    for (const rp of remoteParticipants) {
      if (rp.screenShareTrack) {
        return {
          presenterName: rp.name,
          isLocal: false,
          presenterIdentity: rp.identity,
          onAttach: (el: HTMLVideoElement) =>
            attachParticipantScreenShare(rp.identity, el),
          onDetach: (el: HTMLVideoElement) =>
            detachParticipantScreenShare(rp.identity, el),
        };
      }
    }
    return null;
  }, [
    localTracks.isScreenSharing,
    localTracks.screenShareTrack,
    userName,
    remoteParticipants,
    attachLocalScreenShare,
    detachLocalScreenShare,
    attachParticipantScreenShare,
    detachParticipantScreenShare,
  ]);

  // ─── Participants panel data ────────────────────────────────────────

  const allPanelParticipants: PanelParticipant[] = useMemo(() => {
    const local: PanelParticipant = {
      identity: "local",
      name: userName,
      role,
      isLocal: true,
      hasAudio: localTracks.isAudioEnabled,
      hasVideo: localTracks.isVideoEnabled,
      isSpeaking: false,
    };

    const remotes: PanelParticipant[] = remoteParticipants.map((rp) => ({
      identity: rp.identity,
      name: rp.name,
      role: rp.role,
      isLocal: false,
      hasAudio: rp.isAudioEnabled,
      hasVideo: rp.isVideoEnabled,
      isSpeaking: rp.isSpeaking,
    }));

    return [local, ...remotes];
  }, [userName, role, localTracks, remoteParticipants]);

  const toggleParticipants = useCallback(
    () => setIsParticipantPanelOpen((v) => !v),
    [],
  );

  // Filter out expected disconnect errors
  const shouldShowError =
    error && !error.includes("Client initiated disconnect");

  // ─── Loading / waiting state ────────────────────────────────────────

  if (!wsUrl || !token) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: "#F2EFE7" }}
      >
        <div className="text-center" style={{ color: "#006A71" }}>
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#48A6A7" }} />
          <p className="text-lg font-medium">Preparing session...</p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: "#F2EFE7" }}>
      {/* Error banner */}
      {shouldShowError && (
        <div className="mx-2 mt-2 px-4 py-2 rounded-lg flex items-center gap-2 bg-red-50 border border-red-300">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Warning banner for video/screenshare errors */}
      {(localTracks.videoError || localTracks.screenShareError) &&
        !shouldShowError && (
          <div className="mx-2 mt-2 px-4 py-2 rounded-lg flex items-center gap-2 bg-amber-50 border border-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              {localTracks.videoError || localTracks.screenShareError}
            </span>
          </div>
        )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Video area */}
        <div className="flex-1 min-w-0">
          {screenShareInfo ? (
            <ScreenShareLayout
              presenterName={screenShareInfo.presenterName}
              isLocalScreenShare={screenShareInfo.isLocal}
              onAttachScreenShare={screenShareInfo.onAttach}
              onDetachScreenShare={screenShareInfo.onDetach}
              participants={sortedParticipants.slice(0, 4)}
            />
          ) : (
            <MeetGrid participants={sortedParticipants.slice(0, 9)} />
          )}
        </div>

        {/* Participant list panel */}
        <ParticipantListPanel
          participants={allPanelParticipants}
          isOpen={isParticipantPanelOpen}
          onClose={() => setIsParticipantPanelOpen(false)}
        />
      </div>

      {/* Control bar */}
      <MeetControlBar
        isAudioOn={localTracks.isAudioEnabled}
        isVideoOn={localTracks.isVideoEnabled}
        isScreenSharing={localTracks.isScreenSharing}
        hasVideoTrack={!!localTracks.videoTrack}
        isConnected={isConnected}
        role={role}
        participantCount={peerCount + 1} // +1 for self
        isParticipantPanelOpen={isParticipantPanelOpen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleParticipants={toggleParticipants}
        onEndSession={onEndSession}
        onLeaveSession={onLeaveSession}
      />
    </div>
  );
}
