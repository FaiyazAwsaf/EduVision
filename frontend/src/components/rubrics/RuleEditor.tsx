"use client";

import React, { useState } from "react";

// Types for rubric rule configuration
type RuleType = "keyword" | "numeric" | "stepwise";

interface KeywordConfig {
  required_keywords: string[];
  scoring_mode: "proportional" | "all_or_nothing";
}

interface NumericConfig {
  expected_value: number;
  tolerance: number;
}

interface StepwiseConfig {
  step_description: string;
  expected_patterns: string[];
  allow_partial_credit: boolean;
}

interface RuleFeedback {
  on_success: string;
  on_partial?: string;
  on_failure: string;
}

export interface EvaluationRule {
  id: string;
  type: RuleType;
  marks: number;
  config: KeywordConfig | NumericConfig | StepwiseConfig;
  feedback: RuleFeedback;
}

interface RuleEditorProps {
  rule: EvaluationRule;
  ruleNumber: number;
  onChange: (updatedRule: EvaluationRule) => void;
  onDelete: () => void;
}

export default function RuleEditor({
  rule,
  ruleNumber,
  onChange,
  onDelete,
}: RuleEditorProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newPattern, setNewPattern] = useState("");

  // Update rule field
  const updateField = (field: keyof EvaluationRule, value: any) => {
    onChange({ ...rule, [field]: value });
  };

  // Update rule config
  const updateConfig = (configField: string, value: any) => {
    onChange({
      ...rule,
      config: { ...rule.config, [configField]: value },
    });
  };

  // Update rule feedback
  const updateFeedback = (feedbackField: keyof RuleFeedback, value: string) => {
    onChange({
      ...rule,
      feedback: { ...rule.feedback, [feedbackField]: value },
    });
  };

  // Handle rule type change
  const handleTypeChange = (newType: RuleType) => {
    let newConfig: KeywordConfig | NumericConfig | StepwiseConfig;

    switch (newType) {
      case "keyword":
        newConfig = {
          required_keywords: [],
          scoring_mode: "proportional",
        } as KeywordConfig;
        break;
      case "numeric":
        newConfig = {
          expected_value: 0,
          tolerance: 0,
        } as NumericConfig;
        break;
      case "stepwise":
        newConfig = {
          step_description: "",
          expected_patterns: [],
          allow_partial_credit: false,
        } as StepwiseConfig;
        break;
    }

    onChange({
      ...rule,
      type: newType,
      config: newConfig,
    });
  };

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim() && rule.type === "keyword") {
      const config = rule.config as KeywordConfig;
      updateConfig("required_keywords", [
        ...config.required_keywords,
        newKeyword.trim(),
      ]);
      setNewKeyword("");
    }
  };

  // Remove keyword
  const removeKeyword = (index: number) => {
    if (rule.type === "keyword") {
      const config = rule.config as KeywordConfig;
      updateConfig(
        "required_keywords",
        config.required_keywords.filter((_, i) => i !== index)
      );
    }
  };

  // Add pattern
  const addPattern = () => {
    if (newPattern.trim() && rule.type === "stepwise") {
      const config = rule.config as StepwiseConfig;
      updateConfig("expected_patterns", [
        ...config.expected_patterns,
        newPattern.trim(),
      ]);
      setNewPattern("");
    }
  };

  // Remove pattern
  const removePattern = (index: number) => {
    if (rule.type === "stepwise") {
      const config = rule.config as StepwiseConfig;
      updateConfig(
        "expected_patterns",
        config.expected_patterns.filter((_, i) => i !== index)
      );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      {/* Rule Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
            Rule {ruleNumber}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {rule.marks} {rule.marks === 1 ? "mark" : "marks"}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors p-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Rule Configuration */}
      <div className="space-y-4">
        {/* Rule Type and Marks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rule Type
            </label>
            <select
              value={rule.type}
              onChange={(e) => handleTypeChange(e.target.value as RuleType)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="keyword">Keyword Matching</option>
              <option value="numeric">Numeric Value</option>
              <option value="stepwise">Stepwise Evaluation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Marks
            </label>
            <input
              type="number"
              value={rule.marks}
              onChange={(e) => updateField("marks", parseFloat(e.target.value) || 0)}
              min={0}
              step={0.5}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Keyword Rule Configuration */}
        {rule.type === "keyword" && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scoring Mode
              </label>
              <select
                value={(rule.config as KeywordConfig).scoring_mode}
                onChange={(e) => updateConfig("scoring_mode", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="proportional">Proportional (partial credit)</option>
                <option value="all_or_nothing">All or Nothing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Required Keywords
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder="Add a keyword..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {(rule.config as KeywordConfig).required_keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(rule.config as KeywordConfig).required_keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="hover:text-blue-900 dark:hover:text-blue-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Numeric Rule Configuration */}
        {rule.type === "numeric" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Value
              </label>
              <input
                type="number"
                value={(rule.config as NumericConfig).expected_value}
                onChange={(e) => updateConfig("expected_value", parseFloat(e.target.value) || 0)}
                step="any"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tolerance (±)
              </label>
              <input
                type="number"
                value={(rule.config as NumericConfig).tolerance}
                onChange={(e) => updateConfig("tolerance", parseFloat(e.target.value) || 0)}
                step="any"
                min={0}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Stepwise Rule Configuration */}
        {rule.type === "stepwise" && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Step Description
              </label>
              <input
                type="text"
                value={(rule.config as StepwiseConfig).step_description}
                onChange={(e) => updateConfig("step_description", e.target.value)}
                placeholder="e.g., Formula shown correctly"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(rule.config as StepwiseConfig).allow_partial_credit}
                  onChange={(e) => updateConfig("allow_partial_credit", e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow Partial Credit</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Patterns (Regex)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addPattern())}
                  placeholder="e.g., F\s*=\s*ma"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={addPattern}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {(rule.config as StepwiseConfig).expected_patterns.length > 0 && (
                <div className="mt-2 space-y-2">
                  {(rule.config as StepwiseConfig).expected_patterns.map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <code className="text-sm text-gray-800 dark:text-gray-200">{pattern}</code>
                      <button
                        type="button"
                        onClick={() => removePattern(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback Configuration */}
        <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Feedback Messages
          </h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Success Feedback
            </label>
            <input
              type="text"
              value={rule.feedback.on_success}
              onChange={(e) => updateFeedback("on_success", e.target.value)}
              placeholder="Message when rule is fully satisfied"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {rule.type === "keyword" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Partial Match Feedback
              </label>
              <input
                type="text"
                value={rule.feedback.on_partial || ""}
                onChange={(e) => updateFeedback("on_partial", e.target.value)}
                placeholder="Message for partial matches"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Failure Feedback
            </label>
            <input
              type="text"
              value={rule.feedback.on_failure}
              onChange={(e) => updateFeedback("on_failure", e.target.value)}
              placeholder="Message when rule is not satisfied"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
