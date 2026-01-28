/**
 * Add to Study Plan Modal Component
 *
 * Option B: Add Generated Content to Study Plan
 *
 * This modal allows users to add already-generated content to a study plan
 * directly from the content view. This is an alternative entry point to
 * Option A (manually adding topics in study plan view).
 *
 * IMPORTANT: This reuses existing study_plan_items logic and APIs.
 * - NO new database models
 * - NO new backend endpoints
 * - Uses existing POST /study-plans/{id}/items/ endpoint
 * - Sets linked_request_id to the current content's request_id
 * - Always sets source='manual' (Phase 5 constraint)
 *
 * [MODULE 3 HOOK] When Module 3 is integrated:
 * - This same flow will be used by analytics to suggest adding content
 * - source='analytics' may be set by AI recommendations
 * - Priority may be auto-calculated based on weakness detection
 */

"use client";

import { useState, useEffect } from "react";
import {
  listStudyPlans,
  addStudyPlanItem,
  createStudyPlan,
} from "@/api/contentRequests";
import type { StudyPlan, StudyPlanItem } from "@/types/content";

interface AddToStudyPlanModalProps {
  contentRequestId: string;
  contentTopic: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (item: StudyPlanItem) => void;
}

export default function AddToStudyPlanModal({
  contentRequestId,
  contentTopic,
  isOpen,
  onClose,
  onSuccess,
}: AddToStudyPlanModalProps) {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [topic, setTopic] = useState(contentTopic);
  const [priority, setPriority] = useState<number>(3);
  const [scheduledDate, setScheduledDate] = useState("");
  const [newPlanName, setNewPlanName] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      // Reset form when modal opens
      setTopic(contentTopic);
      setPriority(3);
      setScheduledDate("");
      setSelectedPlanId("");
      setShowCreateNew(false);
      setError(null);
    }
  }, [isOpen, contentTopic]);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      const loadedPlans = await listStudyPlans();
      setPlans(loadedPlans);

      // Auto-select first plan if available
      if (loadedPlans.length > 0) {
        setSelectedPlanId(loadedPlans[0].id);
      } else {
        // No plans exist, show create form
        setShowCreateNew(true);
      }
    } catch (err) {
      setError("Failed to load study plans");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!topic.trim()) {
      setError("Topic is required");
      return;
    }

    setIsSubmitting(true);

    try {
      let planId = selectedPlanId;

      // Create new plan if needed
      if (showCreateNew) {
        if (!newPlanName.trim()) {
          setError("Plan name is required");
          setIsSubmitting(false);
          return;
        }

        const newPlan = await createStudyPlan({
          name: newPlanName.trim(),
        });
        planId = newPlan.id;
      }

      if (!planId) {
        setError("Please select or create a study plan");
        setIsSubmitting(false);
        return;
      }

      // Option B: Add item to study plan with linked_request_id
      // This reuses existing Option A logic but provides alternative entry point
      // The content is linked via linked_request_id, NOT duplicated
      const item = await addStudyPlanItem(planId, {
        topic: topic.trim(),
        priority,
        scheduled_date: scheduledDate || undefined,
        linked_request_id: contentRequestId, // Link this generated content
      });

      // Success!
      if (onSuccess) {
        onSuccess(item);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add to study plan"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#006A71]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto border border-[#9ACBD0]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#006A71]">Add to Study Plan</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#9ACBD0] hover:text-[#006A71] transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block rounded-full h-8 w-8 border-4 border-[#48A6A7] border-t-transparent animate-spin"></div>
            <p className="text-[#48A6A7] mt-4">Loading study plans...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Plan Selection or Creation */}
            {!showCreateNew && plans.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-[#006A71] mb-1">
                  Select Study Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 border text-[#006A71] border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7]"
                  disabled={isSubmitting}
                  required
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.items.length} items)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateNew(true)}
                  className="text-sm text-[#48A6A7] hover:text-[#006A71] mt-2 transition-colors"
                  disabled={isSubmitting}
                >
                  + Create new plan instead
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[#006A71] mb-1">
                  New Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g., Math Final Exam"
                  className="w-full px-3 py-2 border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] text-[#006A71] placeholder:text-[#9ACBD0]"
                  disabled={isSubmitting}
                  required
                  maxLength={200}
                />
                {plans.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateNew(false);
                      setSelectedPlanId(plans[0].id);
                    }}
                    className="text-sm text-[#48A6A7] hover:text-[#006A71] mt-2 transition-colors"
                    disabled={isSubmitting}
                  >
                    ← Use existing plan instead
                  </button>
                )}
              </div>
            )}

            {/* Topic (pre-filled, editable) */}
            <div>
              <label className="block text-sm font-medium text-[#006A71] mb-1">
                Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 border text-[#006A71] border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7]"
                disabled={isSubmitting}
                required
                maxLength={500}
              />
              <p className="text-xs text-[#48A6A7] mt-1">
                Pre-filled from generated content, you can edit
              </p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-[#006A71] mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="w-full px-3 py-2 border text-[#006A71] border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7]"
                disabled={isSubmitting}
              >
                <option value={1}>1 - Highest (Urgent)</option>
                <option value={2}>2 - High</option>
                <option value={3}>3 - Medium</option>
                <option value={4}>4 - Low</option>
                <option value={5}>5 - Lowest (Optional)</option>
              </select>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-[#006A71] mb-1">
                Scheduled Date{" "}
                <span className="text-[#48A6A7] text-xs">(Optional)</span>
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border text-[#006A71] border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7]"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !topic.trim()}
                className="flex-1 bg-[#48A6A7] text-white px-4 py-2 rounded-md hover:bg-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Adding..." : "Add to Study Plan"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border text-[#006A71] border-[#9ACBD0] rounded-md hover:bg-[#F2EFE7] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
