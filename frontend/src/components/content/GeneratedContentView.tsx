/**
 * Generated Content View Component
 *
 * Displays generated content based on output format:
 * - TEXT: Renders inline with formatting
 * - PDF/WORKSHEET: Shows download button
 *
 * Phase 3: Includes feedback collection UI
 */

"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { BookOpen, CheckCircle } from "lucide-react";
import {
  downloadGeneratedContent,
  submitFeedback,
  getFeedback,
} from "@/api/contentRequests";
import ErrorMessage from "@/components/shared/ErrorMessage";
import { formatDate } from "@/utils/formatters";
import FeedbackForm from "@/components/feedback/FeedbackForm";
import FeedbackDisplay from "@/components/feedback/FeedbackDisplay";
import AddToStudyPlanModal from "@/components/study-plans/AddToStudyPlanModal";
import type {
  GeneratedContent,
  OutputFormat,
  FeedbackPayload,
  Feedback,
} from "@/types/content";
import { OutputFormat as OutputFormatEnum } from "@/types/content";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

interface GeneratedContentViewProps {
  content: GeneratedContent;
}

export default function GeneratedContentView({
  content,
}: GeneratedContentViewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<Feedback | null>(
    null,
  );
  const [isFeedbackLoading, setIsFeedbackLoading] = useState<boolean>(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Option B: Add to Study Plan modal state
  const [showAddToStudyPlanModal, setShowAddToStudyPlanModal] = useState(false);
  const [addToStudyPlanSuccess, setAddToStudyPlanSuccess] = useState<
    string | null
  >(null);

  // Check if feedback already exists
  useEffect(() => {
    const checkFeedback = async () => {
      try {
        const feedback = await getFeedback(content.id);
        setExistingFeedback(feedback);
      } catch (error) {
        console.error("Failed to check feedback:", error);
      } finally {
        setIsFeedbackLoading(false);
      }
    };

    checkFeedback();
  }, [content.id]);

  const handleFeedbackSubmit = async (feedback: FeedbackPayload) => {
    const submitted = await submitFeedback(content.id, feedback);
    setExistingFeedback(submitted);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);

    try {
      await downloadGeneratedContent(
        content.request_id,
        OutputFormatEnum.PDF as Extract<
          OutputFormat,
          OutputFormatEnum.PDF | OutputFormatEnum.WORKSHEET
        >,
      );
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="rounded-lg border border-secondary bg-background p-4">
        <h3 className="text-sm font-semibold text-primary-dark mb-3">
          Content Details
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="font-medium text-primary">Topic</dt>
            <dd className="text-primary-dark">{content.topic}</dd>
          </div>
          <div>
            <dt className="font-medium text-primary">Content Type</dt>
            <dd className="text-primary-dark">
              {content.content_type.replace("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-primary">Style</dt>
            <dd className="text-primary-dark">
              {content.style.replace("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-primary">Format</dt>
            <dd className="text-primary-dark">{content.output_format}</dd>
          </div>
          <div>
            <dt className="font-medium text-primary">Generated</dt>
            <dd className="text-primary-dark">
              {formatDate(content.created_at)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-primary">AI Model</dt>
            <dd className="text-primary-dark">{content.metadata.model}</dd>
          </div>
        </dl>
      </div>

      {/* Option B: Add to Study Plan CTA */}
      {/* This provides an alternative entry point to link content to study plans
          without requiring users to navigate to study plan view first.
          Reuses existing study_plan_items API - NO new backend endpoints. */}
      <div className="rounded-lg border border-secondary bg-secondary/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary-dark mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Study Plan Integration</span>
            </h3>
            <p className="text-sm text-primary">
              Add this generated content to your study plan for better
              organization and tracking.
            </p>
          </div>
          <button
            onClick={() => setShowAddToStudyPlanModal(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add to Study Plan
          </button>
        </div>

        {/* Success message */}
        {addToStudyPlanSuccess && (
          <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{addToStudyPlanSuccess}</span>
          </div>
        )}
      </div>

      {/* Content Display */}
      {/* Always show text content with download option */}
      <div className="rounded-lg border border-secondary bg-white p-8 text-primary-dark">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-secondary">
          <h3 className="text-lg font-semibold text-primary-dark">
            Generated Content
          </h3>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download as PDF
              </>
            )}
          </button>
        </div>

        {downloadError && (
          <div className="mb-4">
            <ErrorMessage
              message={downloadError}
              onRetry={() => setDownloadError(null)}
            />
          </div>
        )}

        <article
          className="prose prose-slate prose-lg max-w-none 
          prose-headings:font-bold prose-headings:text-black
          prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-8
          prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-6
          prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-5
          prose-p:text-black prose-p:leading-relaxed prose-p:my-4
          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-black prose-strong:font-semibold
          prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
          prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
          prose-li:my-2 prose-li:text-black
          prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-black
          prose-code:bg-black prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-black prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-gray-900 prose-pre:text-black prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
          prose-hr:my-8 prose-hr:border-gray-300
          prose-table:border-collapse prose-table:w-full
          prose-th:bg-black prose-th:p-2 prose-th:text-left prose-th:font-semibold prose-th:text-black
          prose-td:border prose-td:border-black prose-td:p-2 prose-td:text-black"
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight]}
            components={{
              // Custom rendering for better styling
              h1: ({ children, ...props }) => (
                <h1 className="scroll-mt-20" {...props}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 className="scroll-mt-20" {...props}>
                  {children}
                </h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 className="scroll-mt-20" {...props}>
                  {children}
                </h3>
              ),
            }}
          >
            {content.content_text}
          </ReactMarkdown>
        </article>
        <div className="mt-8 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Character count: {content.content_text.length.toLocaleString()}
          </p>
        </div>
      </div>

      {/* AI Metadata (collapsible section) */}
      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 font-medium text-gray-700 hover:bg-gray-50">
          AI Generation Details
        </summary>
        <div className="border-t border-gray-200 px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Provider</dt>
              <dd className="text-gray-900">{content.metadata.provider}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Model</dt>
              <dd className="text-gray-900">{content.metadata.model}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Temperature</dt>
              <dd className="text-gray-900">{content.metadata.temperature}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Prompt Length</dt>
              <dd className="text-gray-900">
                {content.metadata.prompt_length} chars
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Response Length</dt>
              <dd className="text-gray-900">
                {content.metadata.response_length} chars
              </dd>
            </div>
          </dl>
        </div>
      </details>

      {/* Feedback Section (Phase 3) - Collapsible */}
      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 font-medium text-gray-700 hover:bg-gray-50">
          Share Your Feedback
        </summary>
        <div className="border-t border-gray-200 px-4 py-4">
          {isFeedbackLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 animate-spin text-blue-600"
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
                <span className="text-sm text-gray-600">
                  Loading feedback status...
                </span>
              </div>
            </div>
          ) : existingFeedback ? (
            <FeedbackDisplay feedback={existingFeedback} />
          ) : (
            <FeedbackForm
              contentId={content.id}
              onSubmit={handleFeedbackSubmit}
            />
          )}
        </div>
      </details>

      {/* Option B: Add to Study Plan Modal */}
      {/* Modal allows selecting existing plan or creating new one,
          then adds current content as a study plan item with linked_request_id.
          This is purely UX wiring - uses existing APIs, no schema changes. */}
      <AddToStudyPlanModal
        contentRequestId={content.request_id}
        contentTopic={content.topic}
        isOpen={showAddToStudyPlanModal}
        onClose={() => setShowAddToStudyPlanModal(false)}
        onSuccess={(item) => {
          setAddToStudyPlanSuccess(
            `Added "${item.topic}" to study plan successfully!`,
          );
          setShowAddToStudyPlanModal(false);
          // Clear success message after 5 seconds
          setTimeout(() => setAddToStudyPlanSuccess(null), 5000);
        }}
      />
    </div>
  );
}
