"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Home,
  FileText,
  Save,
  Upload,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
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
    if (!formData.question_text.trim())
      errors.push("Question text is required");
    if (!formData.reference_answer.trim())
      errors.push("Reference answer is required");
    if (formData.total_marks <= 0)
      errors.push("Total marks must be greater than 0");

    return errors;
  };

  // Validate form for publishing (strict validation)
  const validateForPublish = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.subject.trim()) errors.push("Subject is required");
    if (!formData.question_text.trim())
      errors.push("Question text is required");
    if (!formData.reference_answer.trim())
      errors.push("Reference answer is required");
    if (formData.total_marks <= 0)
      errors.push("Total marks must be greater than 0");

    if (formData.evaluation_rules.length === 0) {
      errors.push(
        "Cannot publish without evaluation rules. Add at least one rule."
      );
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
    <div className="min-h-screen bg-[#F2EFE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[#006A71]">
                Rubric Builder
              </h1>
              <p className="mt-1 text-sm text-[#48A6A7]">
                Create evaluation rubrics for automated grading
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isPublished && (
                <div className="px-3 py-1.5 bg-[#48A6A7]/10 border border-[#48A6A7] rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#006A71]" />
                  <span className="text-sm font-medium text-[#006A71]">
                    Published (Read-Only)
                  </span>
                </div>
              )}
              <Link
                href="/"
                className="text-[#48A6A7] hover:text-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </Link>
              <Link
                href="/evaluation"
                className="bg-[#48A6A7] text-white px-4 py-2 rounded-lg hover:bg-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Evaluation
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 bg-[#48A6A7]/10 border border-[#48A6A7] rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#006A71] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-[#006A71]">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-[#48A6A7] hover:text-[#006A71] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form className="space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
            <h2 className="text-xl font-semibold text-[#006A71] mb-6">
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-[#006A71] mb-2"
                >
                  Rubric Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  disabled={isPublished}
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  placeholder="e.g., Physics Newton's Laws - Question 5"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-[#006A71] mb-2"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    disabled={isPublished}
                    className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    placeholder="e.g., Physics"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="total_marks"
                    className="block text-sm font-medium text-[#006A71] mb-2"
                  >
                    Total Marks *
                  </label>
                  <input
                    type="number"
                    id="total_marks"
                    value={formData.total_marks}
                    onChange={(e) =>
                      updateField(
                        "total_marks",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    disabled={isPublished}
                    className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    min="0"
                    step="0.5"
                    required
                  />
                  <p className="mt-1.5 text-xs text-[#9ACBD0]">
                    Rules total: {calculateTotalMarks()} marks
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Question Section */}
          <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
            <h2 className="text-xl font-semibold text-[#006A71] mb-6">
              Question
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="question_text"
                  className="block text-sm font-medium text-[#006A71] mb-2"
                >
                  Question Text *
                </label>
                <textarea
                  id="question_text"
                  value={formData.question_text}
                  onChange={(e) => updateField("question_text", e.target.value)}
                  disabled={isPublished}
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors resize-none"
                  rows={4}
                  placeholder="Enter the question text here..."
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="reference_answer"
                  className="block text-sm font-medium text-[#006A71] mb-2"
                >
                  Reference Answer *
                </label>
                <textarea
                  id="reference_answer"
                  value={formData.reference_answer}
                  onChange={(e) =>
                    updateField("reference_answer", e.target.value)
                  }
                  disabled={isPublished}
                  className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] placeholder-[#9ACBD0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors resize-none"
                  rows={6}
                  placeholder="Enter the model/reference answer here..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Evaluation Rules Section */}
          <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#006A71]">
                Evaluation Rules ({formData.evaluation_rules.length})
              </h2>
              <button
                type="button"
                onClick={addRule}
                disabled={isPublished}
                className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            {formData.evaluation_rules.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-[#9ACBD0] rounded-xl">
                <FileText className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
                <h3 className="text-lg font-medium text-[#006A71] mb-2">
                  No evaluation rules yet
                </h3>
                <p className="text-[#48A6A7] text-sm mb-4">
                  Add evaluation rules to define how answers should be graded
                </p>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={isPublished}
                  className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
              <h2 className="text-xl font-semibold text-[#006A71] mb-6">
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
          <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting || isPublished}
                className="px-6 py-2.5 bg-[#F2EFE7] text-[#006A71] border border-[#9ACBD0] rounded-lg hover:bg-[#9ACBD0]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={isSubmitting || isPublished}
                className="px-6 py-2.5 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isSubmitting ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#9ACBD0] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#48A6A7]">
            EduVision AI Platform - Rubric Builder
          </p>
        </div>
      </footer>

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-[#006A71]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#9ACBD0] max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-[#006A71] mb-4">
                Confirm Publish
              </h3>
              <p className="text-[#48A6A7] mb-6">
                Are you sure you want to publish this rubric? Once published,
                the rubric will be read-only and cannot be edited.
              </p>

              <div className="bg-[#F2EFE7] border border-[#9ACBD0] rounded-lg p-4 mb-6">
                <div className="text-sm text-[#006A71]">
                  <p className="font-medium mb-2">Publishing will:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#48A6A7]" />
                      Lock the rubric for editing
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#48A6A7]" />
                      Create a version snapshot
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#48A6A7]" />
                      Make it available for grading
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 text-[#48A6A7] hover:text-[#006A71] hover:bg-[#F2EFE7] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPublish}
                  className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
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
