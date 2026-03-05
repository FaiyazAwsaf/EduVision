"use client";

import React from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import type { QuestionRubric } from "@/types/rubrics";

interface QuestionsListProps {
  questions: QuestionRubric[];
  selectedIndex: number | null;
  isPublished: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export default function QuestionsList({
  questions,
  selectedIndex,
  isPublished,
  onSelect,
  onAdd,
  onRemove,
}: QuestionsListProps) {
  return (
    <div className="bg-white rounded-xl border border-secondary p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary-dark">
          Questions ({questions.length})
        </h2>
        <button
          type="button"
          onClick={onAdd}
          disabled={isPublished}
          className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-8 text-secondary text-sm">
          <FileText className="w-8 h-8 mx-auto mb-2" />
          No questions yet
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((question, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedIndex === index
                  ? "border-primary-dark bg-primary-dark/5"
                  : "border-secondary hover:border-primary"
              }`}
              onClick={() => onSelect(index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary-dark text-sm">
                      Q{question.question_number}
                    </span>
                    <span className="text-xs text-primary">
                      {question.max_marks} marks
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1 truncate">
                    {question.question_text || "No text"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="ml-2 p-1 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
