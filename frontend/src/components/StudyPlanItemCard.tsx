/**
 * StudyPlanItemCard Component
 *
 * Displays a single study plan item with status, priority, and actions.
 * Allows inline editing and status updates.
 */

"use client";

import { useState } from "react";
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
    1: "bg-red-100 text-red-800 border-red-300",
    2: "bg-orange-100 text-orange-800 border-orange-300",
    3: "bg-yellow-100 text-yellow-800 border-yellow-300",
    4: "bg-green-100 text-green-800 border-green-300",
    5: "bg-blue-100 text-blue-800 border-blue-300",
  };

  const statusColors: Record<StudyPlanItemStatus, string> = {
    [StudyPlanItemStatus.PENDING]: "bg-gray-100 text-gray-800",
    [StudyPlanItemStatus.IN_PROGRESS]: "bg-blue-100 text-blue-800",
    [StudyPlanItemStatus.COMPLETED]: "bg-green-100 text-green-800",
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
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
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
            <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={isUpdating}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={editedPriority}
              onChange={(e) => setEditedPriority(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md"
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
              className="px-3 py-2 border border-gray-300 rounded-md"
              disabled={isUpdating}
            />
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <h3 className="font-medium text-gray-900 mb-1">{item.topic}</h3>
          {item.scheduled_date && (
            <p className="text-sm text-gray-600">
              📅 Scheduled: {new Date(item.scheduled_date).toLocaleDateString()}
            </p>
          )}
          {item.linked_request_id && (
            <p className="text-sm text-blue-600 mt-1">
              🔗 Linked to content request
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
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
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
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
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
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                ✓ Complete
              </button>
            )}
            {item.status === StudyPlanItemStatus.PENDING && (
              <button
                onClick={() =>
                  handleStatusChange(StudyPlanItemStatus.IN_PROGRESS)
                }
                disabled={isUpdating}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Start
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              disabled={isUpdating}
              className="px-3 py-1 text-sm border text-black border-black rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isUpdating}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
