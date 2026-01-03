/**
 * Connection Status Indicator
 *
 * Visual indicator for WebSocket connection state.
 */

"use client";

import React from "react";
import { ConnectionState } from "@/lib/websocket";
import { useConnectionState } from "@/contexts/SessionContext";
import { GraduationCap, User } from "lucide-react";

interface ConnectionStatusProps {
  /** Show text label alongside indicator */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
}

const statusConfig: Record<
  ConnectionState,
  { color: string; bgColor: string; label: string; pulse: boolean }
> = {
  connected: {
    color: "bg-green-500",
    bgColor: "bg-green-100",
    label: "Connected",
    pulse: false,
  },
  connecting: {
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100",
    label: "Connecting...",
    pulse: true,
  },
  reconnecting: {
    color: "bg-orange-500",
    bgColor: "bg-orange-100",
    label: "Reconnecting...",
    pulse: true,
  },
  disconnected: {
    color: "bg-red-500",
    bgColor: "bg-red-100",
    label: "Disconnected",
    pulse: false,
  },
};

/**
 * Connection status indicator component.
 *
 * Shows a colored dot with optional label to indicate WebSocket connection status.
 */
export function ConnectionStatus({
  showLabel = true,
  className = "",
}: ConnectionStatusProps) {
  const { connectionState } = useConnectionState();
  const config = statusConfig[connectionState];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative flex h-3 w-3`}>
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${config.color}`}
        />
      </div>
      {showLabel && (
        <span
          className={`text-sm font-medium px-2 py-0.5 rounded-full ${config.bgColor}`}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Standalone connection status badge (doesn't require SessionContext).
 */
export function ConnectionStatusBadge({
  state,
  showLabel = true,
  className = "",
}: {
  state: ConnectionState;
  showLabel?: boolean;
  className?: string;
}) {
  const config = statusConfig[state];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative flex h-3 w-3`}>
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${config.color}`}
        />
      </div>
      {showLabel && (
        <span
          className={`text-sm font-medium px-2 py-0.5 rounded-full ${config.bgColor}`}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Participant presence indicator.
 */
export function ParticipantStatus({
  name,
  role,
  connected,
  className = "",
}: {
  name: string;
  role: "teacher" | "student";
  connected: boolean;
  className?: string;
}) {
  const RoleIcon = role === "teacher" ? User : GraduationCap;
  const statusColor = connected ? "bg-green-500" : "bg-gray-400";
  const bgColor = connected ? "bg-green-50" : "bg-gray-50";
  const borderColor = connected ? "border-green-200" : "border-gray-200";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${bgColor} ${borderColor} ${className}`}
    >
      <RoleIcon className="w-6 h-6" style={{ color: "#48A6A7" }} />
      <div className="flex-1">
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-500 capitalize">{role}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex h-2 w-2 rounded-full ${statusColor}`} />
        <span className="text-xs text-gray-600">
          {connected ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}
