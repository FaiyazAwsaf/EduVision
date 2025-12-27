/**
 * Learning Context Form Component
 *
 * Optional form for users to provide personalization context for AI generation.
 * Supports target goals, self-reported weaknesses, depth preferences, and time constraints.
 *
 * Design principles:
 * - OPTIONAL: Users can skip and use default generation
 * - COLLAPSIBLE: Minimizes UI clutter when not in use
 * - VALIDATING: Enforces max 10 weaknesses, 1000 char notes
 */

"use client";

import { useState, useEffect } from "react";
import type {
  LearningContextPayload,
  TargetGoal,
  PreferredDepth,
  TimeConstraint,
} from "@/types/content";
import { TargetGoal as TargetGoalEnum } from "@/types/content";
import { PreferredDepth as PreferredDepthEnum } from "@/types/content";
import { TimeConstraint as TimeConstraintEnum } from "@/types/content";

interface LearningContextFormProps {
  onContextChange: (context: LearningContextPayload | null) => void;
  disabled?: boolean;
}

export default function LearningContextForm({
  onContextChange,
  disabled = false,
}: LearningContextFormProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [targetGoal, setTargetGoal] = useState<TargetGoal | undefined>(
    undefined
  );
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [currentWeakness, setCurrentWeakness] = useState("");
  const [preferredDepth, setPreferredDepth] = useState<
    PreferredDepth | undefined
  >(undefined);
  const [timeConstraint, setTimeConstraint] = useState<
    TimeConstraint | undefined
  >(undefined);
  const [notes, setNotes] = useState("");

  // Notify parent of context changes
  useEffect(() => {
    if (!isEnabled) {
      onContextChange(null);
      return;
    }

    const context: LearningContextPayload = {};
    if (targetGoal) context.target_goal = targetGoal;
    if (weaknesses.length > 0) context.self_reported_weaknesses = weaknesses;
    if (preferredDepth) context.preferred_depth = preferredDepth;
    if (timeConstraint) context.time_constraint = timeConstraint;
    if (notes.trim()) context.notes = notes.trim();

    // Only send if at least one field is filled
    if (Object.keys(context).length > 0) {
      onContextChange(context);
    } else {
      onContextChange(null);
    }
  }, [
    isEnabled,
    targetGoal,
    weaknesses,
    preferredDepth,
    timeConstraint,
    notes,
    onContextChange,
  ]);

  const handleAddWeakness = () => {
    const trimmed = currentWeakness.trim();
    if (trimmed && weaknesses.length < 10 && !weaknesses.includes(trimmed)) {
      setWeaknesses([...weaknesses, trimmed]);
      setCurrentWeakness("");
    }
  };

  const handleRemoveWeakness = (index: number) => {
    setWeaknesses(weaknesses.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddWeakness();
    }
  };

  if (!isEnabled) {
    return (
      <div className="bg-[#9ACBD0]/10 border border-[#9ACBD0] rounded-md p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#006A71]">
              Personalize Your Content (Optional)
            </h3>
            <p className="text-xs text-[#48A6A7] mt-1">
              Help the AI understand your learning goals and adapt the content
              to your needs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEnabled(true)}
            disabled={disabled}
            className="text-sm font-medium text-[#48A6A7] hover:text-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#9ACBD0]/10 border border-[#9ACBD0] rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#006A71]">
          Learning Context (Optional)
        </h3>
        <button
          type="button"
          onClick={() => {
            setIsEnabled(false);
            setTargetGoal(undefined);
            setWeaknesses([]);
            setCurrentWeakness("");
            setPreferredDepth(undefined);
            setTimeConstraint(undefined);
            setNotes("");
          }}
          disabled={disabled}
          className="text-xs text-[#48A6A7] hover:text-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear & Disable
        </button>
      </div>

      {/* Target Goal */}
      <div>
        <label
          htmlFor="target-goal"
          className="block text-xs font-medium text-[#006A71] mb-1"
        >
          What&apos;s your main goal?
        </label>
        <select
          id="target-goal"
          value={targetGoal || ""}
          onChange={(e) =>
            setTargetGoal(
              e.target.value ? (e.target.value as TargetGoal) : undefined
            )
          }
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] disabled:opacity-50 disabled:cursor-not-allowed text-[#006A71]"
        >
          <option value="">Select a goal (optional)</option>
          <option value={TargetGoalEnum.REVISION}>Quick Revision</option>
          <option value={TargetGoalEnum.CONCEPT_CLARITY}>
            Understand Concepts
          </option>
          <option value={TargetGoalEnum.EXAM_PREP}>Exam Preparation</option>
          <option value={TargetGoalEnum.PRACTICE}>
            Practice & Application
          </option>
        </select>
      </div>

      {/* Weaknesses */}
      <div>
        <label className="block text-xs font-medium text-[#006A71] mb-1">
          Topics You Find Challenging (Max 10)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={currentWeakness}
            onChange={(e) => setCurrentWeakness(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., quadratic equations"
            disabled={disabled || weaknesses.length >= 10}
            className="flex-1 px-3 py-2 text-sm border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] disabled:opacity-50 disabled:cursor-not-allowed text-[#006A71] placeholder:text-[#9ACBD0]"
          />
          <button
            type="button"
            onClick={handleAddWeakness}
            disabled={
              disabled || !currentWeakness.trim() || weaknesses.length >= 10
            }
            className="px-4 py-2 text-sm font-medium text-white bg-[#48A6A7] rounded-md hover:bg-[#006A71] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
        {weaknesses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {weaknesses.map((weakness, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-[#9ACBD0] rounded-md text-[#006A71]"
              >
                {weakness}
                <button
                  type="button"
                  onClick={() => handleRemoveWeakness(index)}
                  disabled={disabled}
                  className="text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {weaknesses.length >= 10 && (
          <p className="text-xs text-amber-600 mt-1">
            Maximum 10 topics reached
          </p>
        )}
      </div>

      {/* Preferred Depth */}
      <div>
        <label
          htmlFor="preferred-depth"
          className="block text-xs font-medium text-[#006A71] mb-1"
        >
          How deep should we go?
        </label>
        <select
          id="preferred-depth"
          value={preferredDepth || ""}
          onChange={(e) =>
            setPreferredDepth(
              e.target.value ? (e.target.value as PreferredDepth) : undefined
            )
          }
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] disabled:opacity-50 disabled:cursor-not-allowed text-[#006A71]"
        >
          <option value="">Normal depth (default)</option>
          <option value={PreferredDepthEnum.SHALLOW}>
            Shallow - Quick overview
          </option>
          <option value={PreferredDepthEnum.NORMAL}>
            Normal - Balanced depth
          </option>
          <option value={PreferredDepthEnum.DEEP}>
            Deep - Comprehensive detail
          </option>
        </select>
      </div>

      {/* Time Constraint */}
      <div>
        <label
          htmlFor="time-constraint"
          className="block text-xs font-medium text-[#006A71] mb-1"
        >
          How much time do you have?
        </label>
        <select
          id="time-constraint"
          value={timeConstraint || ""}
          onChange={(e) =>
            setTimeConstraint(
              e.target.value ? (e.target.value as TimeConstraint) : undefined
            )
          }
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] disabled:opacity-50 disabled:cursor-not-allowed text-[#006A71]"
        >
          <option value="">Normal time (default)</option>
          <option value={TimeConstraintEnum.QUICK}>
            Quick - 10-15 minutes
          </option>
          <option value={TimeConstraintEnum.NORMAL}>
            Normal - 30-45 minutes
          </option>
          <option value={TimeConstraintEnum.EXTENSIVE}>
            Extensive - 1+ hour
          </option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="context-notes"
          className="block text-xs font-medium text-[#006A71] mb-1"
        >
          Additional Notes (Max 1000 chars)
        </label>
        <textarea
          id="context-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
          placeholder="Any other context that might help personalize the content..."
          disabled={disabled}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-[#9ACBD0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#48A6A7] disabled:opacity-50 disabled:cursor-not-allowed resize-none text-[#006A71] placeholder:text-[#9ACBD0]"
        />
        <p className="text-xs text-[#48A6A7] mt-1">
          {notes.length}/1000 characters
        </p>
      </div>

      <div className="pt-2 border-t border-[#9ACBD0]">
        <p className="text-xs text-[#48A6A7]">
          💡 This information helps the AI adapt content to your specific needs,
          but all fields are optional.
        </p>
      </div>
    </div>
  );
}
