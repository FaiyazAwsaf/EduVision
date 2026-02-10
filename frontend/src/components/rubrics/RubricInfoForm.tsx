"use client";

import React from "react";

interface RubricInfoFormProps {
  title: string;
  subject: string;
  totalMarks: number;
  questionsTotalMarks: number;
  onTitleChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onTotalMarksChange: (value: number) => void;
}

export default function RubricInfoForm({
  title,
  subject,
  totalMarks,
  questionsTotalMarks,
  onTitleChange,
  onSubjectChange,
  onTotalMarksChange,
}: RubricInfoFormProps) {
  return (
    <div className="bg-white rounded-xl border border-secondary p-6">
      <h2 className="text-lg font-semibold text-primary-dark mb-4">
        Assessment Info
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark text-sm"
            placeholder="Assessment Title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark text-sm"
            placeholder="e.g., Physics"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-dark mb-2">
            Total Marks *
          </label>
          <input
            type="number"
            value={totalMarks}
            onChange={(e) => onTotalMarksChange(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark text-sm"
            min="0"
            step="0.5"
          />
          <p className="mt-1 text-xs text-secondary">
            Questions total: {questionsTotalMarks} marks
          </p>
        </div>
      </div>
    </div>
  );
}
