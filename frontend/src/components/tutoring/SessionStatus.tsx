"use client";

/**
 * Session Status Component
 *
 * Displays the current status of a tutoring session with
 * appropriate styling based on status.
 */

import React from "react";

interface SessionStatusProps {
  status: "WAITING" | "ACTIVE" | "GRACE" | "ENDED";
  className?: string;
}

export default function SessionStatus({
  status,
  className = "",
}: SessionStatusProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "WAITING":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          border: "border-yellow-200",
          label: "Waiting for student",
          icon: "⏳",
        };
      case "ACTIVE":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-200",
          label: "Session active",
          icon: "🟢",
        };
      case "GRACE":
        return {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
          label: "Grace period",
          icon: "⚠️",
        };
      case "ENDED":
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          border: "border-gray-200",
          label: "Session ended",
          icon: "⏹️",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          border: "border-gray-200",
          label: "Unknown",
          icon: "❓",
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      <span>{styles.icon}</span>
      <span className="text-sm font-medium">{styles.label}</span>
    </div>
  );
}
