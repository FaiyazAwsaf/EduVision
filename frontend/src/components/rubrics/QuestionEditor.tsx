"use client";

import React from "react";
import { Plus, FileText, FileUp } from "lucide-react";
import { RuleEditor } from "@/components/rubrics";
import type { EvaluationRule } from "@/components/rubrics";
import type { QuestionRubric } from "@/types/rubrics";

interface QuestionEditorProps {
  question: QuestionRubric;
  questionIndex: number;
  questionRuleMarks: number;
  onUpdateField: (field: keyof QuestionRubric, value: string | number) => void;
  onAddRule: () => void;
  onRemoveRule: (ruleIndex: number) => void;
  onUpdateRule: (ruleIndex: number, updatedRule: EvaluationRule) => void;
}

interface QuestionEditorPanelProps extends QuestionEditorProps {}

interface EmptyStatePanelProps {
  onAddQuestion: () => void;
  onUploadDocument: () => void;
}

export function QuestionEditorPanel({
  question,
  questionIndex,
  questionRuleMarks,
  onUpdateField,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
}: QuestionEditorPanelProps) {
  return (
    <>
      {/* Question Details */}
      <div className="bg-white rounded-xl border border-secondary p-6">
        <h2 className="text-xl font-semibold text-primary-dark mb-4">
          Question {question.question_number}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Question Text *
            </label>
            <textarea
              value={question.question_text}
              onChange={(e) => onUpdateField("question_text", e.target.value)}
              className="w-full px-4 py-2.5 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark resize-none"
              rows={4}
              placeholder="Enter the question text..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-dark mb-2">
              Max Marks *
            </label>
            <input
              type="number"
              value={question.max_marks}
              onChange={(e) =>
                onUpdateField("max_marks", parseFloat(e.target.value) || 0)
              }
              className="w-full px-4 py-2.5 border border-secondary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white text-primary-dark"
              min="0"
              step="0.5"
            />
            <p className="mt-1.5 text-xs text-secondary">
              Rules total: {questionRuleMarks} marks
            </p>
          </div>
        </div>
      </div>

      {/* Evaluation Rules */}
      <div className="bg-white rounded-xl border border-secondary p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-primary-dark">
            Evaluation Rules ({question.evaluation_rules.length})
          </h2>
          <button
            type="button"
            onClick={onAddRule}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {question.evaluation_rules.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-secondary rounded-xl">
            <FileText className="w-12 h-12 mx-auto text-secondary mb-4" />
            <h3 className="text-lg font-medium text-primary-dark mb-2">
              No evaluation rules yet
            </h3>
            <p className="text-primary text-sm mb-4">
              Add rules to define how this question should be graded
            </p>
            <button
              type="button"
              onClick={onAddRule}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Add First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {question.evaluation_rules.map((rule, ruleIndex) => (
              <RuleEditor
                key={rule.id || `rule-${ruleIndex}`}
                rule={rule}
                ruleNumber={ruleIndex + 1}
                onChange={(updatedRule) => onUpdateRule(ruleIndex, updatedRule)}
                onDelete={() => onRemoveRule(ruleIndex)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function EmptyStatePanel({
  onAddQuestion,
  onUploadDocument,
}: EmptyStatePanelProps) {
  return (
    <div className="bg-white rounded-xl border border-secondary p-12 text-center">
      <FileText className="w-16 h-16 mx-auto text-secondary mb-4" />
      <h3 className="text-xl font-medium text-primary-dark mb-2">
        No question selected
      </h3>
      <p className="text-primary mb-6">
        Select a question from the list or add a new one to get started
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onAddQuestion}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Add First Question
        </button>
        <button
          type="button"
          onClick={onUploadDocument}
          className="px-6 py-2 border border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors flex items-center gap-2"
        >
          <FileUp className="w-4 h-4" />
          Upload Document
        </button>
      </div>
    </div>
  );
}
