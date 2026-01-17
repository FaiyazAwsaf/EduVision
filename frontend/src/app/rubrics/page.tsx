"use client";

import React, { useState } from "react";
import { RuleEditor, SampleAnswerTester } from "@/components/rubrics";
import type { EvaluationRule } from "@/components/rubrics";
import { createRubric, updateRubric, publishRubric } from "@/lib/api/rubrics";

interface RubricFormData {
  title: string;
  subject: string;
  question_text: string;
  reference_answer: string;
  total_marks: number;
  evaluation_rules: EvaluationRule[];
}

export default function RubricBuilderPage() {
  const [formData, setFormData] = useState<RubricFormData>({
    title: "",
    subject: "",
    question_text: "",
    reference_answer: "",
    total_marks: 10,
    evaluation_rules: [],
  });
  const [rubricId, setRubricId] = useState<string | null>(null);
  const [rubricVersion, setRubricVersion] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [activeRuleIndex, setActiveRuleIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Update form field
  const updateField = (field: keyof RubricFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Add new evaluation rule
  const addRule = () => {
    const newRule: EvaluationRule = {
      id: crypto.randomUUID(),
      type: "keyword",
      marks: 0,
      config: {
        required_keywords: [],
        scoring_mode: "proportional",
      },
      feedback: {
        on_success: "",
        on_partial: "",
        on_failure: "",
      },
    };
    setFormData((prev) => ({
      ...prev,
      evaluation_rules: [...prev.evaluation_rules, newRule],
    }));
    setActiveRuleIndex(formData.evaluation_rules.length);
  };

  // Remove evaluation rule
  const removeRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      evaluation_rules: prev.evaluation_rules.filter((_, i) => i !== index),
    }));
    if (activeRuleIndex === index) {
      setActiveRuleIndex(null);
    }
  };

  // Update rule
  const updateRule = (index: number, updatedRule: EvaluationRule) => {
    setFormData((prev) => ({
      ...prev,
      evaluation_rules: prev.evaluation_rules.map((rule, i) =>
        i === index ? updatedRule : rule
      ),
    }));
  };

  // Calculate total marks from rules
  const calculateTotalMarks = () => {
    return formData.evaluation_rules.reduce((sum, rule) => sum + rule.marks, 0);
  };

  // Validate form for drafts (basic validation)
  const validateDraft = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.subject.trim()) errors.push("Subject is required");
    if (!formData.question_text.trim()) errors.push("Question text is required");
    if (!formData.reference_answer.trim()) errors.push("Reference answer is required");
    if (formData.total_marks <= 0) errors.push("Total marks must be greater than 0");

    return errors;
  };

  // Validate form for publishing (strict validation)
  const validateForPublish = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.subject.trim()) errors.push("Subject is required");
    if (!formData.question_text.trim()) errors.push("Question text is required");
    if (!formData.reference_answer.trim()) errors.push("Reference answer is required");
    if (formData.total_marks <= 0) errors.push("Total marks must be greater than 0");
    
    if (formData.evaluation_rules.length === 0) {
      errors.push("Cannot publish without evaluation rules. Add at least one rule.");
    }

    const rulesTotal = calculateTotalMarks();
    if (Math.abs(rulesTotal - formData.total_marks) > 0.01) {
      errors.push(
        `Cannot publish: Sum of rule marks (${rulesTotal}) must equal total marks (${formData.total_marks})`
      );
    }

    return errors;
  };

  // Save as draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const errors = validateDraft();
    if (errors.length > 0) {
      setError(errors.join(", "));
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      
      if (rubricId) {
        // Update existing rubric
        result = await updateRubric(rubricId, formData);
        setSuccess(`Draft updated successfully! (Version ${result.version})`);
      } else {
        // Create new rubric
        result = await createRubric(formData);
        setRubricId(result.id);
        setSuccess("Draft saved successfully!");
      }
      
      // Update version from response
      setRubricVersion(result.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show publish confirmation modal
  const handlePublishClick = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const errors = validateForPublish();
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }

    // Show confirmation modal
    setShowPublishModal(true);
  };

  // Publish rubric after confirmation
  const confirmPublish = async () => {
    setShowPublishModal(false);
    
    // Check if rubric has been saved first
    if (!rubricId) {
      setError("Please save the rubric as a draft before publishing");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await publishRubric(rubricId);
      
      // Update local state with published rubric data
      setRubricVersion(result.version);
      setIsPublished(true);
      
      setSuccess(`Rubric published successfully! (Version ${result.version})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish rubric");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Rubric Builder
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Create evaluation rubrics for automated grading
              </p>
            </div>
            {isPublished && (
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  ✓ Published (Read-Only)
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-800 dark:text-red-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="mt-2 text-sm text-green-800 dark:text-green-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <form className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Basic Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Rubric Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    disabled={isPublished}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="e.g., Physics Newton's Laws - Question 5"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    disabled={isPublished}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="e.g., Physics"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="total_marks"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Total Marks *
                  </label>
                  <input
                    type="number"
                    id="total_marks"
                    value={formData.total_marks}
                    onChange={(e) => updateField("total_marks", parseFloat(e.target.value) || 0)}
                    disabled={isPublished}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    min="0"
                    step="0.5"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Rules total: {calculateTotalMarks()} marks
                  </p>
                </div>
              </div>
            </div>

            {/* Question Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Question
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="question_text"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Question Text *
                  </label>
                  <textarea
                    id="question_text"
                    value={formData.question_text}
                    onChange={(e) => updateField("question_text", e.target.value)}
                    disabled={isPublished}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    rows={4}
                    placeholder="Enter the question text here..."
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="reference_answer"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Reference Answer *
                  </label>
                  <textarea
                    id="reference_answer"
                    value={formData.reference_answer}
                    onChange={(e) => updateField("reference_answer", e.target.value)}
                    disabled={isPublished}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    rows={6}
                    placeholder="Enter the model/reference answer here..."
                    required
                  />
                </div>
              </div>
            </div>

            {/* Evaluation Rules Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Evaluation Rules ({formData.evaluation_rules.length})
                </h2>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={isPublished}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Rule
                </button>
              </div>

              {formData.evaluation_rules.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No evaluation rules yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Add evaluation rules to define how answers should be graded
                  </p>
                  <button
                    type="button"
                    onClick={addRule}
                    disabled={isPublished}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add First Rule
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.evaluation_rules.map((rule, index) => (
                    <RuleEditor
                      key={rule.id}
                      rule={rule}
                      ruleNumber={index + 1}
                      onChange={(updatedRule) => updateRule(index, updatedRule)}
                      onDelete={() => removeRule(index)}
                      disabled={isPublished}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sample Answer Tester */}
            {formData.evaluation_rules.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Test Your Rubric
                </h2>
                <SampleAnswerTester
                  rubricId={rubricId || undefined}
                  evaluationRules={formData.evaluation_rules}
                  totalMarks={formData.total_marks}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting || isPublished}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handlePublishClick}
                  disabled={isSubmitting || isPublished}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Publishing..." : "Publish"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Publish
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to publish this rubric? Once published, the rubric will
                be read-only and cannot be edited.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Publishing will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lock the rubric for editing</li>
                    <li>Create a version snapshot</li>
                    <li>Make it available for grading</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPublish}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Confirm Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
