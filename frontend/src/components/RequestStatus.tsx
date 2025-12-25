/**
 * Request Status Component
 *
 * Monitors and displays the status of a content generation request.
 * Polls backend until request reaches terminal state (COMPLETED or FAILED).
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { getRequestStatus, getGeneratedContent } from "@/api/contentRequests";
import { POLLING_CONFIG } from "@/config/api";
import StatusBadge from "./StatusBadge";
import GeneratedContentView from "./GeneratedContentView";
import ErrorMessage from "./ErrorMessage";
import {
  RequestStatus,
  type ContentRequest,
  type GeneratedContent,
  type RequestLifecycleState,
} from "@/types/content";

interface RequestStatusProps {
  requestId: string;
  onCreateNew: () => void;
}

export default function RequestStatusComponent({
  requestId,
  onCreateNew,
}: RequestStatusProps) {
  const [request, setRequest] = useState<ContentRequest | null>(null);
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedContent | null>(null);
  const [lifecycleState, setLifecycleState] =
    useState<RequestLifecycleState>("polling");
  const [error, setError] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for request status
  useEffect(() => {
    let isMounted = true;
    let attempts = 0;

    const poll = async () => {
      attempts++;

      if (attempts > POLLING_CONFIG.MAX_ATTEMPTS) {
        if (isMounted) {
          setError("Request timed out. Please try again or contact support.");
          setLifecycleState("failed");
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        return;
      }

      try {
        const status = await getRequestStatus(requestId);

        if (!isMounted) return;

        setRequest(status);
        setPollAttempts(attempts);

        // Check terminal states
        if (status.status === RequestStatus.COMPLETED) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }

          // Fetch generated content
          try {
            const content = await getGeneratedContent(requestId);
            if (isMounted) {
              setGeneratedContent(content);
              setLifecycleState("completed");
              setError(null); // Clear any previous errors
            }
          } catch (err) {
            if (isMounted) {
              const errorMessage =
                err instanceof Error ? err.message : "Failed to fetch content";
              setError(errorMessage);
              setLifecycleState("failed");
              console.error("Failed to fetch generated content:", err);
            }
          }
        } else if (status.status === RequestStatus.FAILED) {
          setLifecycleState("failed");
          setError("Content generation failed. Please try again.");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to check status"
          );
          setLifecycleState("failed");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, POLLING_CONFIG.INTERVAL_MS);

    // Cleanup
    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [requestId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getElapsedTime = () => {
    if (!request) return null;
    const start = new Date(request.created_at);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (!request && !error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg
            className="h-6 w-6 animate-spin text-blue-600"
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
          <span className="text-gray-600">Loading request details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && !generatedContent && (
        <ErrorMessage
          message={error}
          onRetry={() => {
            setError(null);
            // Re-trigger polling
            window.location.reload();
          }}
        />
      )}

      {/* Request Header */}
      {request && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {request.topic}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Request ID: {requestId.slice(0, 8)}...
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Content Type</dt>
              <dd className="text-gray-900">
                {request.content_type.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Style</dt>
              <dd className="text-gray-900">
                {request.style.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Difficulty</dt>
              <dd className="text-gray-900">
                {request.difficulty || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Output Format</dt>
              <dd className="text-gray-900">{request.output_format}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="text-gray-900">
                {formatDate(request.created_at)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Elapsed Time</dt>
              <dd className="text-gray-900">
                {getElapsedTime() || "Calculating..."}
              </dd>
            </div>
          </dl>

          {request.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dt className="text-sm font-medium text-gray-500 mb-1">
                Additional Notes
              </dt>
              <dd className="text-sm text-gray-700">{request.notes}</dd>
            </div>
          )}
        </div>
      )}

      {/* Generated Content */}
      {lifecycleState === "completed" && generatedContent && (
        <GeneratedContentView content={generatedContent} />
      )}

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={onCreateNew}
          className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Create Another Request
        </button>
      </div>
    </div>
  );
}
