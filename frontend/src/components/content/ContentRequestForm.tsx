/**
 * Content Request Form Component
 *
 * Allows users to submit new AI content generation requests.
 * Validates input and delegates API calls to service layer.
 *
 * Phase 4: Two-step submission:
 * 1. Create content request
 * 2. Optionally submit learning context
 */

"use client";

import { useState } from "react";
import {
  createContentRequest,
  submitLearningContext,
} from "@/api/contentRequests";
import ErrorMessage from "@/components/shared/ErrorMessage";
import LearningContextForm from "./LearningContextForm";
import {
  ContentType,
  Style,
  Difficulty,
  OutputFormat,
  type CreateContentRequestPayload,
  type LearningContextPayload,
} from "@/types/content";

interface ContentRequestFormProps {
  onSuccess: (requestId: string) => void;
  userRole?: "student" | "teacher";
}

const STUDENT_CONTENT_TYPES = [
  { value: ContentType.SUMMARY, label: "Summary" },
  { value: ContentType.WORKED_EXAMPLES, label: "Worked Examples" },
  { value: ContentType.FORMULA_SHEET, label: "Formula Sheet" },
];

const TEACHER_CONTENT_TYPES = [
  { value: ContentType.SUMMARY, label: "Summary" },
  { value: ContentType.WORKED_EXAMPLES, label: "Worked Examples" },
  { value: ContentType.FORMULA_SHEET, label: "Formula Sheet" },
  { value: ContentType.LESSON_PLAN, label: "Lesson Plan" },
  { value: ContentType.QUIZ_GENERATOR, label: "Quiz Generator" },
  { value: ContentType.WORKSHEET_BUILDER, label: "Worksheet Builder" },
  { value: ContentType.TOPIC_EXPLANATION, label: "Topic Explanation" },
];

export default function ContentRequestForm({
  onSuccess,
  userRole = "student",
}: ContentRequestFormProps) {
  const contentTypes =
    userRole === "teacher" ? TEACHER_CONTENT_TYPES : STUDENT_CONTENT_TYPES;
  const [formData, setFormData] = useState<CreateContentRequestPayload>({
    topic: "",
    content_type: ContentType.SUMMARY,
    style: Style.DETAILED,
    output_format: OutputFormat.TEXT,
    difficulty: Difficulty.MEDIUM,
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learningContext, setLearningContext] =
    useState<LearningContextPayload | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.topic.trim()) {
      setError("Topic is required");
      return;
    }

    if (formData.topic.trim().length < 3) {
      setError("Topic must be at least 3 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create content request
      const payload: CreateContentRequestPayload = {
        ...formData,
        topic: formData.topic.trim(),
      };

      if (!payload.notes?.trim()) {
        delete payload.notes;
      }

      const response = await createContentRequest(payload);

      // Step 2: Submit learning context if provided
      if (learningContext) {
        try {
          await submitLearningContext(response.id, learningContext);
          console.log(
            "[Phase 4] Learning context submitted for personalization",
          );
        } catch (contextError) {
          console.warn(
            "[Phase 4] Failed to submit learning context:",
            contextError,
          );
          // Don't fail the entire request if context submission fails
          // The request will still be processed with default generation
        }
      }

      onSuccess(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      topic: "",
      content_type: ContentType.SUMMARY,
      style: Style.DETAILED,
      output_format: OutputFormat.TEXT,
      difficulty: Difficulty.MEDIUM,
      notes: "",
    });
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* Topic Input */}
      <div>
        <label
          htmlFor="topic"
          className="block text-sm font-medium text-primary-dark"
        >
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="topic"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder="e.g., Pythagorean Theorem"
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-secondary"
          required
        />
        <p className="mt-1 text-sm text-primary">
          The subject matter for content generation
        </p>
      </div>

      {/* Content Type */}
      <div>
        <label
          htmlFor="content_type"
          className="block text-sm font-medium text-primary-dark"
        >
          Content Type <span className="text-red-500">*</span>
        </label>
        <select
          id="content_type"
          value={formData.content_type}
          onChange={(e) =>
            setFormData({
              ...formData,
              content_type: e.target.value as ContentType,
            })
          }
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100 text-primary-dark"
          required
        >
          <option value={ContentType.SUMMARY}>Summary</option>
          <option value={ContentType.WORKED_EXAMPLES}>Worked Examples</option>
          <option value={ContentType.FORMULA_SHEET}>Formula Sheet</option>
          {userRole === "teacher" && (
            <>
              <option value={ContentType.LESSON_PLAN}>Lesson Plan</option>
              <option value={ContentType.QUIZ_GENERATOR}>Quiz Generator</option>
              <option value={ContentType.WORKSHEET_BUILDER}>
                Worksheet Builder
              </option>
              <option value={ContentType.TOPIC_EXPLANATION}>
                Topic Explanation
              </option>
            </>
          )}
        </select>
      </div>

      {/* Subject (optional, useful for teachers) */}
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-primary-dark"
        >
          Subject
        </label>
        <input
          type="text"
          id="subject"
          value={formData.subject || ""}
          onChange={(e) =>
            setFormData({ ...formData, subject: e.target.value })
          }
          placeholder="e.g., Mathematics, Physics"
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-secondary"
        />
        <p className="mt-1 text-sm text-primary">
          Academic subject for this content
        </p>
      </div>

      {/* Style */}
      <div>
        <label
          htmlFor="style"
          className="block text-sm font-medium text-primary-dark"
        >
          Style <span className="text-red-500">*</span>
        </label>
        <select
          id="style"
          value={formData.style}
          onChange={(e) =>
            setFormData({ ...formData, style: e.target.value as Style })
          }
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md text-primary-dark border border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
          required
        >
          <option value={Style.BRIEF}>Brief</option>
          <option value={Style.DETAILED}>Detailed</option>
          <option value={Style.STEP_BY_STEP}>Step by Step</option>
        </select>
      </div>

      {/* Difficulty */}
      <div>
        <label
          htmlFor="difficulty"
          className="block text-sm font-medium text-primary-dark"
        >
          Difficulty
        </label>
        <select
          id="difficulty"
          value={formData.difficulty || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              difficulty: e.target.value
                ? (e.target.value as Difficulty)
                : undefined,
            })
          }
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border text-primary-dark border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
        >
          <option value={Difficulty.EASY}>Easy</option>
          <option value={Difficulty.MEDIUM}>Medium</option>
          <option value={Difficulty.HARD}>Hard</option>
        </select>
      </div>

      {/* Output Format - Hidden, always TEXT */}

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-primary-dark"
        >
          Additional Notes
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Optional: Add any specific instructions or context..."
          rows={3}
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-secondary px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-secondary"
        />
        <p className="mt-1 text-sm text-primary">Maximum 2000 characters</p>
      </div>

      {/* Phase 4: Learning Context */}
      <LearningContextForm
        onContextChange={setLearningContext}
        disabled={isSubmitting}
      />

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
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
              Creating Request...
            </span>
          ) : (
            "Generate Content"
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isSubmitting}
          className="rounded-md border border-secondary bg-white px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-background disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
