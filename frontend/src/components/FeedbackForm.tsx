/**
 * Feedback Form Component - Phase 3
 *
 * Captures structured user feedback on AI-generated content.
 * Displays only after content generation is complete.
 *
 * Features:
 * - Star rating for usefulness (1-5)
 * - Difficulty level assessment
 * - Correctness verification
 * - Optional text feedback
 * - One-time submission (disabled after submit)
 */

"use client";

import { useState } from "react";
import { DifficultyRating, type FeedbackPayload } from "@/types/content";

interface FeedbackFormProps {
  contentId: string;
  onSubmit: (feedback: FeedbackPayload) => Promise<void>;
  disabled?: boolean;
}

export default function FeedbackForm({
  contentId,
  onSubmit,
  disabled = false,
}: FeedbackFormProps) {
  const [usefulnessRating, setUsefulnessRating] = useState<number>(0);
  const [difficultyRating, setDifficultyRating] = useState<DifficultyRating>(
    DifficultyRating.APPROPRIATE
  );
  const [correctnessFlag, setCorrectnessFlag] = useState<boolean>(true);
  const [missingTopics, setMissingTopics] = useState<string>("");
  const [freeformComment, setFreeformComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (usefulnessRating === 0) {
      alert("Please select a usefulness rating (1-5 stars)");
      return;
    }

    setIsSubmitting(true);

    try {
      const feedback: FeedbackPayload = {
        usefulness_rating: usefulnessRating,
        difficulty_rating: difficultyRating,
        correctness_flag: correctnessFlag,
        missing_topics: missingTopics.trim() || undefined,
        freeform_comment: freeformComment.trim() || undefined,
      };

      await onSubmit(feedback);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert(
        error instanceof Error ? error.message : "Failed to submit feedback"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = disabled || isSubmitting;

  return (
    <div className="rounded-lg border border-[#9ACBD0] bg-[#F2EFE7] p-6">
      <h3 className="text-lg font-semibold text-[#006A71] mb-4">
        📝 Share Your Feedback
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Usefulness Rating */}
        <div>
          <label className="block text-sm font-medium text-[#006A71] mb-2">
            How useful was this content? <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={isFormDisabled}
                onClick={() => setUsefulnessRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className={`text-3xl transition-colors ${
                  isFormDisabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                } ${
                  star <= (hoveredStar || usefulnessRating)
                    ? "text-amber-500"
                    : "text-[#9ACBD0]"
                }`}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
            {usefulnessRating > 0 && (
              <span className="ml-2 text-sm text-[#48A6A7] self-center">
                ({usefulnessRating}/5)
              </span>
            )}
          </div>
        </div>

        {/* Difficulty Rating */}
        <div>
          <label className="block text-sm font-medium text-[#006A71] mb-2">
            Was the difficulty level appropriate?{" "}
            <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="difficulty"
                value={DifficultyRating.TOO_EASY}
                checked={difficultyRating === DifficultyRating.TOO_EASY}
                onChange={(e) =>
                  setDifficultyRating(e.target.value as DifficultyRating)
                }
                disabled={isFormDisabled}
                className="mr-2 accent-[#48A6A7]"
              />
              <span className="text-sm text-[#006A71]">Too Easy</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="difficulty"
                value={DifficultyRating.APPROPRIATE}
                checked={difficultyRating === DifficultyRating.APPROPRIATE}
                onChange={(e) =>
                  setDifficultyRating(e.target.value as DifficultyRating)
                }
                disabled={isFormDisabled}
                className="mr-2 accent-[#48A6A7]"
              />
              <span className="text-sm text-[#006A71]">Appropriate</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="difficulty"
                value={DifficultyRating.TOO_HARD}
                checked={difficultyRating === DifficultyRating.TOO_HARD}
                onChange={(e) =>
                  setDifficultyRating(e.target.value as DifficultyRating)
                }
                disabled={isFormDisabled}
                className="mr-2 accent-[#48A6A7]"
              />
              <span className="text-sm text-[#006A71]">Too Hard</span>
            </label>
          </div>
        </div>

        {/* Correctness Flag */}
        <div>
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={correctnessFlag}
              onChange={(e) => setCorrectnessFlag(e.target.checked)}
              disabled={isFormDisabled}
              className="mt-1 mr-2 accent-[#48A6A7]"
            />
            <span className="text-sm text-[#006A71]">
              The content was factually correct{" "}
              <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* Missing Topics (Optional) */}
        <div>
          <label className="block text-sm font-medium text-[#006A71] mb-2">
            Missing topics or concepts (optional)
          </label>
          <textarea
            value={missingTopics}
            onChange={(e) => setMissingTopics(e.target.value)}
            disabled={isFormDisabled}
            rows={2}
            maxLength={2000}
            placeholder="e.g., Could have included more examples on..."
            className="w-full rounded-md border border-[#9ACBD0] px-3 py-2 text-[#006A71] placeholder-[#9ACBD0] focus:border-[#48A6A7] focus:ring-[#48A6A7] disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-[#48A6A7] mt-1">
            {missingTopics.length}/2000 characters
          </p>
        </div>

        {/* Freeform Comment (Optional) */}
        <div>
          <label className="block text-sm font-medium text-[#006A71] mb-2">
            Additional comments (optional)
          </label>
          <textarea
            value={freeformComment}
            onChange={(e) => setFreeformComment(e.target.value)}
            disabled={isFormDisabled}
            rows={3}
            maxLength={5000}
            placeholder="Any other feedback or suggestions..."
            className="w-full rounded-md border border-[#9ACBD0] px-3 py-2 text-[#006A71] placeholder-[#9ACBD0] focus:border-[#48A6A7] focus:ring-[#48A6A7] disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-[#48A6A7] mt-1">
            {freeformComment.length}/5000 characters
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isFormDisabled}
            className={`w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors ${
              isFormDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#48A6A7] hover:bg-[#006A71]"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
}
