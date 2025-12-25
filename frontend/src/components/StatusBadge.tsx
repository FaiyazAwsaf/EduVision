/**
 * Status Badge Component
 *
 * Visual indicator for request lifecycle states.
 * Maps backend status to user-friendly labels and colors.
 */

import { RequestStatus } from "@/types/content";

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

const STATUS_CONFIG = {
  [RequestStatus.PENDING]: {
    label: "Queued",
    className: "bg-gray-100 text-gray-800 border-gray-300",
  },
  [RequestStatus.PROCESSING]: {
    label: "Generating...",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  [RequestStatus.COMPLETED]: {
    label: "Ready",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  [RequestStatus.FAILED]: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-300",
  },
} as const;

export default function StatusBadge({
  status,
  className = "",
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${config.className} ${className}`}
    >
      {(status === RequestStatus.PENDING ||
        status === RequestStatus.PROCESSING) && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {status === RequestStatus.COMPLETED && (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {status === RequestStatus.FAILED && (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      {config.label}
    </span>
  );
}
