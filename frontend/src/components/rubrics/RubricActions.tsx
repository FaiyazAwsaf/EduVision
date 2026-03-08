"use client";

import React from "react";
import { Save, Upload, FileText } from "lucide-react";

interface RubricActionsProps {
  isSubmitting: boolean;
  showTester: boolean;
  hasQuestions: boolean;
  onSaveDraft: (e: React.FormEvent) => void;
  onPublishClick: () => void;
  onToggleTester: () => void;
}

export default function RubricActions({
  isSubmitting,
  showTester,
  hasQuestions,
  onSaveDraft,
  onPublishClick,
  onToggleTester,
}: RubricActionsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onSaveDraft}
        disabled={isSubmitting}
        className="w-full px-4 py-2.5 bg-background text-primary-dark border border-secondary rounded-lg hover:bg-secondary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Save className="w-4 h-4" />
        {isSubmitting ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={onPublishClick}
        disabled={isSubmitting}
        className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Upload className="w-4 h-4" />
        {isSubmitting ? "Publishing..." : "Publish"}
      </button>
      {hasQuestions && (
        <button
          type="button"
          onClick={onToggleTester}
          className="w-full px-4 py-2.5 bg-secondary/20 text-primary-dark border border-secondary rounded-lg hover:bg-secondary/40 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          {showTester ? "Hide Tester" : "Test Rubric Set"}
        </button>
      )}
    </div>
  );
}
