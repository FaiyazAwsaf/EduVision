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
        <h3 className="text-lg font-semibold text-black">
          ✅ Feedback Submitted
        </h3>
        <span className="text-xs text-gray-600">
          {formatDate(feedback.submitted_at)}
        </span>
      </div>

      <div className="space-y-3 text-sm">
        {/* Usefulness Rating */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-black">Usefulness:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={
                  star <= feedback.usefulness_rating
                    ? "text-yellow-500"
                    : "text-gray-300"
                }
              >
                ★
              </span>
            ))}
          </div>
          <span className="text-gray-600">
            ({feedback.usefulness_rating}/5)
          </span>
        </div>

        {/* Difficulty Rating */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-black">Difficulty:</span>
          <span className="text-gray-700">
            {getDifficultyLabel(feedback.difficulty_rating)}
          </span>
        </div>

        {/* Correctness */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-black">Correctness:</span>
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
            <span className="font-medium text-black">Missing Topics:</span>
            <p className="mt-1 text-gray-700 bg-white rounded p-2 border border-gray-200">
              {feedback.missing_topics}
            </p>
          </div>
        )}

        {/* Freeform Comment */}
        {feedback.freeform_comment && (
          <div>
            <span className="font-medium text-black">Additional Comments:</span>
            <p className="mt-1 text-gray-700 bg-white rounded p-2 border border-gray-200">
              {feedback.freeform_comment}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-4 italic">
        Thank you for your feedback! This helps us improve content generation.
      </p>
    </div>
  );
}
