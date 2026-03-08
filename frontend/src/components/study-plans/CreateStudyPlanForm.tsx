/**
 * CreateStudyPlanForm Component
 *
 * Form for creating a new study plan in manual mode.
 * Phase 5: Manual mode only - no AI/analytics features.
 */

"use client";

import { useState } from "react";
import { createStudyPlan } from "@/api/contentRequests";
import type { StudyPlan } from "@/types/content";

interface CreateStudyPlanFormProps {
  onSuccess: (plan: StudyPlan) => void;
  onCancel?: () => void;
}

export default function CreateStudyPlanForm({
  onSuccess,
  onCancel,
}: CreateStudyPlanFormProps) {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Plan name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const plan = await createStudyPlan({
        name: name.trim(),
        user_id: userId.trim() || undefined,
      });
      onSuccess(plan);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create study plan"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-primary-dark mb-1"
        >
          Plan Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Calculus Study Plan"
          className="w-full px-3 py-2 border text-primary-dark border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-secondary"
          disabled={isSubmitting}
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="userId"
          className="block text-sm font-medium text-primary-dark mb-1"
        >
          User ID{" "}
          <span className="text-primary text-xs">
            (Optional - for future auth)
          </span>
        </label>
        <input
          id="userId"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Leave blank until authentication is implemented"
          className="w-full px-3 py-2 border text-primary-dark border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-secondary"
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="flex-1 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Creating..." : "Create Study Plan"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-secondary text-primary-dark rounded-md hover:bg-background disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
