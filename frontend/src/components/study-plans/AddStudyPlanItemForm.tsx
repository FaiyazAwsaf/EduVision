/**
 * AddStudyPlanItemForm Component
 *
 * Form for manually adding an item to a study plan.
 * Phase 5: Manual mode only - source is automatically set to 'manual'.
 */

"use client";

import { useState } from "react";
import { addStudyPlanItem } from "@/api/contentRequests";
import { StudyPlanItemStatus } from "@/types/content";
import type { StudyPlanItem } from "@/types/content";

interface AddStudyPlanItemFormProps {
  planId: string;
  onSuccess: (item: StudyPlanItem) => void;
  onCancel?: () => void;
}

export default function AddStudyPlanItemForm({
  planId,
  onSuccess,
  onCancel,
}: AddStudyPlanItemFormProps) {
  const [topic, setTopic] = useState("");
  const [priority, setPriority] = useState<number>(3);
  const [scheduledDate, setScheduledDate] = useState("");
  const [status, setStatus] = useState<StudyPlanItemStatus>(
    StudyPlanItemStatus.PENDING
  );
  const [linkedRequestId, setLinkedRequestId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!topic.trim()) {
      setError("Topic is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const item = await addStudyPlanItem(planId, {
        topic: topic.trim(),
        priority,
        scheduled_date: scheduledDate || undefined,
        status,
        linked_request_id: linkedRequestId.trim() || undefined,
      });
      onSuccess(item);
      // Reset form
      setTopic("");
      setPriority(3);
      setScheduledDate("");
      setStatus(StudyPlanItemStatus.PENDING);
      setLinkedRequestId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="topic"
          className="block text-sm font-medium text-primary-dark mb-1"
        >
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Quadratic Equations"
          className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-primary-dark placeholder:text-secondary"
          disabled={isSubmitting}
          maxLength={500}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="priority"
            className="block text-sm font-medium text-primary-dark mb-1"
          >
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-primary-dark"
            disabled={isSubmitting}
          >
            <option value={1}>1 - Highest</option>
            <option value={2}>2 - High</option>
            <option value={3}>3 - Medium</option>
            <option value={4}>4 - Low</option>
            <option value={5}>5 - Lowest</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-primary-dark mb-1"
          >
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudyPlanItemStatus)}
            className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-primary-dark"
            disabled={isSubmitting}
          >
            <option value={StudyPlanItemStatus.PENDING}>Pending</option>
            <option value={StudyPlanItemStatus.IN_PROGRESS}>In Progress</option>
            <option value={StudyPlanItemStatus.COMPLETED}>Completed</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="scheduledDate"
          className="block text-sm font-medium text-primary-dark mb-1"
        >
          Scheduled Date{" "}
          <span className="text-primary text-xs">(Optional)</span>
        </label>
        <input
          id="scheduledDate"
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-primary-dark"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label
          htmlFor="linkedRequestId"
          className="block text-sm font-medium text-primary-dark mb-1"
        >
          Linked Content Request ID{" "}
          <span className="text-primary text-xs">(Optional)</span>
        </label>
        <input
          id="linkedRequestId"
          type="text"
          value={linkedRequestId}
          onChange={(e) => setLinkedRequestId(e.target.value)}
          placeholder="UUID of content request"
          className="w-full px-3 py-2 border border-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-primary-dark placeholder:text-secondary"
          disabled={isSubmitting}
        />
        <p className="text-xs text-primary mt-1">
          Link this study item to a generated content request
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !topic.trim()}
          className="flex-1 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Adding..." : "Add Item"}
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
