"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Trash2,
  Edit,
  Loader2,
  FileUp,
} from "lucide-react";
import { RuleEditor, MultiQuestionTester } from "@/components/rubrics";
import type { EvaluationRule } from "@/components/rubrics";
import {
  createRubricSet,
  updateRubricSet,
  publishRubricSet,
  getRubricSet,
  parseRubricDocument,
  type QuestionRubric,
} from "@/lib/api/rubrics";

interface RubricSetFormData {
  title: string;
  subject: string;
  total_marks: number;
  metadata: Record<string, any>;
  questions: QuestionRubric[];
}

function RubricSetBuilderContent() {
  const searchParams = useSearchParams();
  const rubricIdParam = searchParams.get("id");

  const [formData, setFormData] = useState<RubricSetFormData>({
    title: "",
    subject: "",
    total_marks: 0,
    metadata: {},
    questions: [],
  });
  const [rubricSetId, setRubricSetId] = useState<string | null>(null);
  const [rubricVersion, setRubricVersion] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<
    number | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRubric, setIsLoadingRubric] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Load existing rubric if ID is provided in URL
  useEffect(() => {
    if (rubricIdParam) {
      loadRubric(rubricIdParam);
    }
  }, [rubricIdParam]);

  const loadRubric = async (id: string) => {
    setIsLoadingRubric(true);
    setError(null);

    try {
      const rubric = await getRubricSet(id);

      setFormData({
        title: rubric.title,
        subject: rubric.subject,
        total_marks: rubric.total_marks,
        metadata: rubric.metadata || {},
        questions: rubric.questions,
      });

      setRubricSetId(rubric.id);
      setRubricVersion(rubric.version);
      setIsPublished(rubric.state === "published");

      if (rubric.questions.length > 0) {
        setSelectedQuestionIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubric");
    } finally {
      setIsLoadingRubric(false);
    }
  };

  // Update form field
  const updateField = (field: keyof RubricSetFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Add new question
  const addQuestion = () => {
    const newQuestion: QuestionRubric = {
      question_number: formData.questions.length + 1,
      question_text: "",
      max_marks: 0,
      evaluation_rules: [],
    };
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setSelectedQuestionIndex(formData.questions.length);
  };

  // Remove question
  const removeQuestion = (index: number) => {
    setFormData((prev) => {
      const newQuestions = prev.questions.filter((_, i) => i !== index);
      // Renumber questions
      return {
        ...prev,
        questions: newQuestions.map((q, i) => ({
          ...q,
          question_number: i + 1,
        })),
      };
    });
    if (selectedQuestionIndex === index) {
      setSelectedQuestionIndex(null);
    } else if (
      selectedQuestionIndex !== null &&
      selectedQuestionIndex > index
    ) {
      setSelectedQuestionIndex(selectedQuestionIndex - 1);
    }
  };

  // Update question
  const updateQuestion = (
    index: number,
    field: keyof QuestionRubric,
    value: any,
  ) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q,
      ),
    }));
  };

  // Add rule to selected question
  const addRuleToQuestion = () => {
    if (selectedQuestionIndex === null) return;

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

    updateQuestion(selectedQuestionIndex, "evaluation_rules", [
      ...formData.questions[selectedQuestionIndex].evaluation_rules,
      newRule,
    ]);
  };

  // Remove rule from question
  const removeRuleFromQuestion = (ruleIndex: number) => {
    if (selectedQuestionIndex === null) return;

    const question = formData.questions[selectedQuestionIndex];
    const newRules = question.evaluation_rules.filter(
      (_, i) => i !== ruleIndex,
    );
    updateQuestion(selectedQuestionIndex, "evaluation_rules", newRules);
  };

  // Update rule in question
  const updateRuleInQuestion = (
    ruleIndex: number,
    updatedRule: EvaluationRule,
  ) => {
    if (selectedQuestionIndex === null) return;

    const question = formData.questions[selectedQuestionIndex];
    const newRules = question.evaluation_rules.map((rule, i) =>
      i === ruleIndex ? updatedRule : rule,
    );
    updateQuestion(selectedQuestionIndex, "evaluation_rules", newRules);
  };

  // Calculate total marks from questions
  const calculateTotalMarks = () => {
    return formData.questions.reduce(
      (sum, q) => sum + (Number(q.max_marks) || 0),
      0,
    );
  };

  // Calculate rule marks for a question
  const calculateQuestionRuleMarks = (questionIndex: number) => {
    const question = formData.questions[questionIndex];
    return question.evaluation_rules.reduce(
      (sum, rule) => sum + (Number(rule.marks) || 0),
      0,
    );
  };

  // Validate for publishing
  const validateForPublish = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.subject.trim()) errors.push("Subject is required");
    if (formData.total_marks <= 0)
      errors.push("Total marks must be greater than 0");

    if (formData.questions.length === 0) {
      errors.push("At least one question is required");
    }

    const questionsTotal = calculateTotalMarks();
    if (Math.abs(questionsTotal - formData.total_marks) > 0.01) {
      errors.push(
        `Sum of question marks (${questionsTotal}) must equal total marks (${formData.total_marks})`,
      );
    }

    formData.questions.forEach((question, index) => {
      if (!question.question_text.trim()) {
        errors.push(`Question ${question.question_number}: Text is required`);
      }
      if (question.max_marks <= 0) {
        errors.push(
          `Question ${question.question_number}: Marks must be greater than 0`,
        );
      }
      if (question.evaluation_rules.length === 0) {
        errors.push(
          `Question ${question.question_number}: At least one rule is required`,
        );
      }

      const ruleMarks = calculateQuestionRuleMarks(index);
      if (Math.abs(ruleMarks - question.max_marks) > 0.01) {
        errors.push(
          `Question ${question.question_number}: Rule marks (${ruleMarks}) must equal max marks (${question.max_marks})`,
        );
      }
    });

    return errors;
  };

  // Save as draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (rubricSetId) {
        // Update existing
        const result = await updateRubricSet(rubricSetId, formData);
        setRubricVersion(result.version);
        setSuccess(
          `Rubric set updated successfully! (Version ${result.version})`,
        );
      } else {
        // Create new
        const result = await createRubricSet(formData);
        setRubricSetId(result.id);
        setRubricVersion(result.version);
        setSuccess("Rubric set created successfully!");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save rubric set",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Publish handler
  const handlePublishClick = () => {
    const errors = validateForPublish();
    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }

    setShowPublishModal(true);
  };

  // Confirm publish
  const confirmPublish = async () => {
    setShowPublishModal(false);

    if (!rubricSetId) {
      setError("Please save the rubric set as a draft before publishing");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await publishRubricSet(rubricSetId);
      setRubricVersion(result.version);
      setIsPublished(true);
      setSuccess(
        `Rubric set published successfully! (Version ${result.version})`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish rubric set",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".pdf")) {
        setError("Please upload a PDF file");
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleParseDocument = async () => {
    if (!uploadedFile) {
      setError("Please select a file to upload");
      return;
    }

    setIsParsingDocument(true);
    setError(null);

    try {
      const parsedData = await parseRubricDocument(uploadedFile);

      // Helper function to ensure config has proper defaults based on rule type
      const normalizeRuleConfig = (rule: any) => {
        const type = rule.type || "keyword";
        const config = rule.config || {};

        switch (type) {
          case "keyword":
            return {
              ...config,
              required_keywords: config.required_keywords || [],
              scoring_mode: config.scoring_mode || "proportional",
            };
          case "numeric":
            return {
              ...config,
              expected_value: config.expected_value ?? 0,
              tolerance: config.tolerance ?? 0,
            };
          case "stepwise":
            return {
              ...config,
              step_description: config.step_description || "",
              expected_patterns: config.expected_patterns || [],
              allow_partial_credit: config.allow_partial_credit ?? true,
            };
          default:
            return config;
        }
      };

      // Ensure all rules have unique IDs and proper config defaults
      const questionsWithIds = (parsedData.questions || []).map(
        (question: any) => ({
          ...question,
          evaluation_rules: (question.evaluation_rules || []).map(
            (rule: any) => ({
              ...rule,
              id: rule.id || crypto.randomUUID(),
              type: rule.type || "keyword",
              marks: rule.marks || 0,
              config: normalizeRuleConfig(rule),
              feedback: {
                on_success: rule.feedback?.on_success || "Correct",
                on_partial: rule.feedback?.on_partial || null,
                on_failure: rule.feedback?.on_failure || "Incorrect",
              },
            }),
          ),
        }),
      );

      // Populate form with parsed data
      setFormData({
        title: parsedData.title || "",
        subject: parsedData.subject || "",
        total_marks: parsedData.total_marks || 0,
        metadata: parsedData.metadata || {},
        questions: questionsWithIds,
      });

      if (parsedData.questions && parsedData.questions.length > 0) {
        setSelectedQuestionIndex(0);
      }

      setShowUploadModal(false);
      setUploadedFile(null);
      setSuccess(
        "Document parsed successfully! Review and edit the extracted rubric data.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document");
    } finally {
      setIsParsingDocument(false);
    }
  };

  const selectedQuestion =
    selectedQuestionIndex !== null
      ? formData.questions[selectedQuestionIndex]
      : null;

  return (
    <div className="min-h-screen bg-[#F2EFE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#9ACBD0]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[#006A71]">
                {rubricSetId ? "Edit Rubric" : "Rubric Builder"}
              </h1>
              <p className="mt-1 text-sm text-[#48A6A7]">
                {rubricSetId
                  ? "Modify an existing assessment rubric"
                  : "Create assessments with multiple questions"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-[#9ACBD0] text-white rounded-lg hover:bg-[#48A6A7] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <FileUp className="w-4 h-4" />
                Upload Document
              </button>
              <Link
                href="/"
                className="text-[#48A6A7] hover:text-[#006A71] transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Loading State */}
        {isLoadingRubric && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-[#48A6A7]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading rubric...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {!isLoadingRubric && error && (
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
        {!isLoadingRubric && success && (
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

        {!isLoadingRubric && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Basic Info & Questions List */}
            <div className="lg:col-span-1 space-y-6">
              {/* Basic Information */}
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
                <h2 className="text-lg font-semibold text-[#006A71] mb-4">
                  Assessment Info
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      className="w-full px-3 py-2 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] text-sm"
                      placeholder="Assessment Title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => updateField("subject", e.target.value)}
                      className="w-full px-3 py-2 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] text-sm"
                      placeholder="e.g., Physics"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#006A71] mb-2">
                      Total Marks *
                    </label>
                    <input
                      type="number"
                      value={formData.total_marks}
                      onChange={(e) =>
                        updateField(
                          "total_marks",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-full px-3 py-2 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] text-sm"
                      min="0"
                      step="0.5"
                    />
                    <p className="mt-1 text-xs text-[#9ACBD0]">
                      Questions total: {calculateTotalMarks()} marks
                    </p>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#006A71]">
                    Questions ({formData.questions.length})
                  </h2>
                  <button
                    type="button"
                    onClick={addQuestion}
                    disabled={isPublished}
                    className="p-1.5 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {formData.questions.length === 0 ? (
                  <div className="text-center py-8 text-[#9ACBD0] text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2" />
                    No questions yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.questions.map((question, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedQuestionIndex === index
                            ? "border-[#006A71] bg-[#006A71]/5"
                            : "border-[#9ACBD0] hover:border-[#48A6A7]"
                        }`}
                        onClick={() => setSelectedQuestionIndex(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#006A71] text-sm">
                                Q{question.question_number}
                              </span>
                              <span className="text-xs text-[#48A6A7]">
                                {question.max_marks} marks
                              </span>
                            </div>
                            <p className="text-xs text-[#9ACBD0] mt-1 truncate">
                              {question.question_text || "No text"}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeQuestion(index);
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

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-[#F2EFE7] text-[#006A71] border border-[#9ACBD0] rounded-lg hover:bg-[#9ACBD0]/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handlePublishClick}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  {isSubmitting ? "Publishing..." : "Publish"}
                </button>
                {formData.questions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTester(!showTester)}
                    className="w-full px-4 py-2.5 bg-[#9ACBD0]/20 text-[#006A71] border border-[#9ACBD0] rounded-lg hover:bg-[#9ACBD0]/40 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    {showTester ? "Hide Tester" : "Test Rubric Set"}
                  </button>
                )}
              </div>
            </div>

            {/* Right Content - Question Editor or Tester */}
            <div className="lg:col-span-3 space-y-6">
              {showTester ? (
                <MultiQuestionTester questions={formData.questions} />
              ) : selectedQuestion ? (
                <>
                  {/* Question Details */}
                  <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
                    <h2 className="text-xl font-semibold text-[#006A71] mb-4">
                      Question {selectedQuestion.question_number}
                    </h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#006A71] mb-2">
                          Question Text *
                        </label>
                        <textarea
                          value={selectedQuestion.question_text}
                          onChange={(e) =>
                            updateQuestion(
                              selectedQuestionIndex!,
                              "question_text",
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71] resize-none"
                          rows={4}
                          placeholder="Enter the question text..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#006A71] mb-2">
                          Max Marks *
                        </label>
                        <input
                          type="number"
                          value={selectedQuestion.max_marks}
                          onChange={(e) =>
                            updateQuestion(
                              selectedQuestionIndex!,
                              "max_marks",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full px-4 py-2.5 border border-[#9ACBD0] rounded-lg focus:ring-2 focus:ring-[#48A6A7] focus:border-[#48A6A7] bg-white text-[#006A71]"
                          min="0"
                          step="0.5"
                        />
                        <p className="mt-1.5 text-xs text-[#9ACBD0]">
                          Rules total:{" "}
                          {calculateQuestionRuleMarks(selectedQuestionIndex!)}{" "}
                          marks
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Evaluation Rules */}
                  <div className="bg-white rounded-xl border border-[#9ACBD0] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-[#006A71]">
                        Evaluation Rules (
                        {selectedQuestion.evaluation_rules.length})
                      </h2>
                      <button
                        type="button"
                        onClick={addRuleToQuestion}
                        className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Rule
                      </button>
                    </div>

                    {selectedQuestion.evaluation_rules.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-[#9ACBD0] rounded-xl">
                        <FileText className="w-12 h-12 mx-auto text-[#9ACBD0] mb-4" />
                        <h3 className="text-lg font-medium text-[#006A71] mb-2">
                          No evaluation rules yet
                        </h3>
                        <p className="text-[#48A6A7] text-sm mb-4">
                          Add rules to define how this question should be graded
                        </p>
                        <button
                          type="button"
                          onClick={addRuleToQuestion}
                          className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
                        >
                          Add First Rule
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedQuestion.evaluation_rules.map(
                          (rule, ruleIndex) => (
                            <RuleEditor
                              key={rule.id || `rule-${ruleIndex}`}
                              rule={rule}
                              ruleNumber={ruleIndex + 1}
                              onChange={(updatedRule) =>
                                updateRuleInQuestion(ruleIndex, updatedRule)
                              }
                              onDelete={() => removeRuleFromQuestion(ruleIndex)}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl border border-[#9ACBD0] p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto text-[#9ACBD0] mb-4" />
                  <h3 className="text-xl font-medium text-[#006A71] mb-2">
                    No question selected
                  </h3>
                  <p className="text-[#48A6A7] mb-6">
                    Select a question from the list or add a new one to get
                    started
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="px-6 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors"
                    >
                      Add First Question
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="px-6 py-2 border border-[#48A6A7] text-[#48A6A7] rounded-lg hover:bg-[#48A6A7] hover:text-white transition-colors flex items-center gap-2"
                    >
                      <FileUp className="w-4 h-4" />
                      Upload Document
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-[#006A71]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#9ACBD0] max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-[#006A71] mb-4">
              Confirm Publish
            </h3>
            <p className="text-[#48A6A7] mb-6">
              Are you sure you want to publish this rubric set?
            </p>

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
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-[#006A71]/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#9ACBD0] max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#006A71]">
                Upload Rubric Document
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedFile(null);
                }}
                className="text-[#9ACBD0] hover:text-[#006A71] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-[#48A6A7] text-sm mb-4">
                Upload a PDF document containing questions and marking schemes.
                The system will automatically extract the rubric information.
              </p>

              <div className="border-2 border-dashed border-[#9ACBD0] rounded-lg p-8 text-center">
                <FileUp className="w-12 h-12 mx-auto text-[#9ACBD0] mb-3" />

                {uploadedFile ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#006A71]">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-[#9ACBD0]">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[#48A6A7] mb-2">
                      Drop your PDF file here or click to browse
                    </p>
                    <label className="inline-block cursor-pointer">
                      <span className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors text-sm">
                        Select PDF File
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedFile(null);
                }}
                className="px-4 py-2 text-[#48A6A7] hover:text-[#006A71] hover:bg-[#F2EFE7] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParseDocument}
                disabled={!uploadedFile || isParsingDocument}
                className="px-4 py-2 bg-[#48A6A7] text-white rounded-lg hover:bg-[#006A71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isParsingDocument ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Parse Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RubricSetBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#48A6A7]" />
        </div>
      }
    >
      <RubricSetBuilderContent />
    </Suspense>
  );
}
