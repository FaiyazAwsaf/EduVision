/**
 * StudyPlanItemCard Component
 *
 * Displays a single study plan item with status, priority, and actions.
 * Allows inline editing and status updates.
 */

"use client";

import { useState } from "react";
import { Calendar, Link as LinkIcon, Check } from "lucide-react";
import {
  updateStudyPlanItem,
  deleteStudyPlanItem,
} from "@/api/contentRequests";
import { StudyPlanItemStatus } from "@/types/content";
import type { StudyPlanItem } from "@/types/content";

interface StudyPlanItemCardProps {
  item: StudyPlanItem;
  onUpdate: (updatedItem: StudyPlanItem) => void;
  onDelete: (itemId: string) => void;
}

export default function StudyPlanItemCard({
  item,
  onUpdate,
  onDelete,
}: StudyPlanItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTopic, setEditedTopic] = useState(item.topic);
  const [editedPriority, setEditedPriority] = useState(item.priority);
  const [editedDate, setEditedDate] = useState(item.scheduled_date || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priorityColors: Record<number, string> = {
    1: "bg-red-50 text-red-800 border-red-200",
    2: "bg-orange-50 text-orange-800 border-orange-200",
    3: "bg-amber-50 text-amber-800 border-amber-200",
    4: "bg-secondary/20 text-primary-dark border-secondary",
    5: "bg-background text-primary border-secondary",
  };

  const statusColors: Record<StudyPlanItemStatus, string> = {
    [StudyPlanItemStatus.PENDING]: "bg-background text-primary-dark",
    [StudyPlanItemStatus.IN_PROGRESS]: "bg-secondary/30 text-primary-dark",
    [StudyPlanItemStatus.COMPLETED]: "bg-green-50 text-green-800",
  };

  const statusLabels: Record<StudyPlanItemStatus, string> = {
    [StudyPlanItemStatus.PENDING]: "Pending",
    [StudyPlanItemStatus.IN_PROGRESS]: "In Progress",
    [StudyPlanItemStatus.COMPLETED]: "Completed",
  };

  const handleStatusChange = async (newStatus: StudyPlanItemStatus) => {
    setError(null);
    setIsUpdating(true);

    try {
      const updated = await updateStudyPlanItem(item.id, { status: newStatus });
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    setError(null);
    setIsUpdating(true);

    try {
      const updated = await updateStudyPlanItem(item.id, {
        topic: editedTopic.trim(),
        priority: editedPriority,
        scheduled_date: editedDate || undefined,
      });
      onUpdate(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    setIsUpdating(true);
    try {
      await deleteStudyPlanItem(item.id);
      onDelete(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
      setIsUpdating(false);
    }
  };

  return (
    <div className="border border-secondary rounded-lg p-4 bg-white hover:border-primary transition-colors">
      {/* Header with status and priority */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              statusColors[item.status]
            }`}
          >
            {statusLabels[item.status]}
          </span>
          <span
            className={`px-2 py-1 text-xs font-medium rounded border ${
              priorityColors[item.priority]
            }`}
          >
            Priority {item.priority}
          </span>
          {item.source === "manual" && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-secondary/20 text-primary-dark">
              Manual
            </span>
          )}
        </div>
      </div>

      {/* Topic and details */}
      {isEditing ? (
        <div className="space-y-3 mb-3">
          <input
            type="text"
            value={editedTopic}
            onChange={(e) => setEditedTopic(e.target.value)}
            className="w-full px-3 py-2 border border-secondary rounded-md text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isUpdating}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={editedPriority}
              onChange={(e) => setEditedPriority(parseInt(e.target.value))}
              className="px-3 py-2 border border-secondary rounded-md text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isUpdating}
            >
              <option value={1}>Priority 1 (Highest)</option>
              <option value={2}>Priority 2</option>
              <option value={3}>Priority 3</option>
              <option value={4}>Priority 4</option>
              <option value={5}>Priority 5 (Lowest)</option>
            </select>
            <input
              type="date"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              className="px-3 py-2 border border-secondary rounded-md text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isUpdating}
            />
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <h3 className="font-medium text-primary-dark mb-1">{item.topic}</h3>
          {item.scheduled_date && (
            <p className="text-sm text-primary flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Scheduled: {new Date(item.scheduled_date).toLocaleDateString()}
            </p>
          )}
          {item.linked_request_id && (
            <p className="text-sm text-primary mt-1 flex items-center gap-1">
              <LinkIcon className="w-4 h-4" /> Linked to content request
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSaveEdit}
              disabled={isUpdating || !editedTopic.trim()}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedTopic(item.topic);
                setEditedPriority(item.priority);
                setEditedDate(item.scheduled_date || "");
                setError(null);
              }}
              disabled={isUpdating}
              className="px-3 py-1 text-sm border border-secondary text-primary-dark rounded hover:bg-background disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {item.status !== StudyPlanItemStatus.COMPLETED && (
              <button
                onClick={() =>
                  handleStatusChange(StudyPlanItemStatus.COMPLETED)
                }
                disabled={isUpdating}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Complete
              </button>
            )}
            {item.status === StudyPlanItemStatus.PENDING && (
              <button
                onClick={() =>
                  handleStatusChange(StudyPlanItemStatus.IN_PROGRESS)
                }
                disabled={isUpdating}
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                Start
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              disabled={isUpdating}
              className="px-3 py-1 text-sm border text-primary-dark border-secondary rounded hover:bg-background disabled:opacity-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isUpdating}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
