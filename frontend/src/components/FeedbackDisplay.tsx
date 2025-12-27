/**
 * Feedback Display Component - Phase 3
 *
 * Shows submitted feedback in a read-only view.
 * Displayed after user has already submitted feedback.
 */

"use client";

import { DifficultyRating, type Feedback } from "@/types/content";

interface FeedbackDisplayProps {
  feedback: Feedback;
}

export default function FeedbackDisplay({ feedback }: FeedbackDisplayProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getDifficultyLabel = (rating: DifficultyRating) => {
    switch (rating) {
      case DifficultyRating.TOO_EASY:
        return "Too Easy";
      case DifficultyRating.APPROPRIATE:
        return "Appropriate";
      case DifficultyRating.TOO_HARD:
        return "Too Hard";
    }
  };

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#006A71]">
          ✅ Feedback Submitted
        </h3>
        <span className="text-xs text-[#48A6A7]">
          {formatDate(feedback.submitted_at)}
        </span>
      </div>

      <div className="space-y-3 text-sm">
        {/* Usefulness Rating */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#006A71]">Usefulness:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={
                  star <= feedback.usefulness_rating
                    ? "text-amber-500"
                    : "text-[#9ACBD0]"
                }
              >
                ★
              </span>
            ))}
          </div>
          <span className="text-[#48A6A7]">
            ({feedback.usefulness_rating}/5)
          </span>
        </div>

        {/* Difficulty Rating */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#006A71]">Difficulty:</span>
          <span className="text-[#48A6A7]">
            {getDifficultyLabel(feedback.difficulty_rating)}
          </span>
        </div>

        {/* Correctness */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#006A71]">Correctness:</span>
          <span
            className={
              feedback.correctness_flag ? "text-green-700" : "text-red-700"
            }
          >
            {feedback.correctness_flag ? "✓ Correct" : "✗ Incorrect"}
          </span>
        </div>

        {/* Missing Topics */}
        {feedback.missing_topics && (
          <div>
            <span className="font-medium text-[#006A71]">Missing Topics:</span>
            <p className="mt-1 text-[#48A6A7] bg-white rounded p-2 border border-[#9ACBD0]">
              {feedback.missing_topics}
            </p>
          </div>
        )}

        {/* Freeform Comment */}
        {feedback.freeform_comment && (
          <div>
            <span className="font-medium text-[#006A71]">Additional Comments:</span>
            <p className="mt-1 text-[#48A6A7] bg-white rounded p-2 border border-[#9ACBD0]">
              {feedback.freeform_comment}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-[#48A6A7] mt-4 italic">
        Thank you for your feedback! This helps us improve content generation.
      </p>
    </div>
  );
}
