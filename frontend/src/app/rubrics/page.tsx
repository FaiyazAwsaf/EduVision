"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileUp,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import Sidebar from "@/components/shared/Sidebar";
import { MultiQuestionTester } from "@/components/rubrics";
import type { EvaluationRule } from "@/types/rubrics";
import RubricInfoForm from "@/components/rubrics/RubricInfoForm";
import QuestionsList from "@/components/rubrics/QuestionsList";
import RubricActions from "@/components/rubrics/RubricActions";
import {
  QuestionEditorPanel,
  EmptyStatePanel,
} from "@/components/rubrics/QuestionEditor";
import {
  ConfirmPublishModal,
  UploadDocumentModal,
} from "@/components/rubrics/RubricModals";
import {
  createRubricSet,
  updateRubricSet,
  publishRubricSet,
  getRubricSet,
  parseRubricDocument,
} from "@/api/rubrics";
import type { QuestionRubric } from "@/types/rubrics";

interface RubricSetFormData {
  title: string;
  subject: string;
  total_marks: number;
  metadata: Record<string, unknown>;
  questions: QuestionRubric[];
}

export default function RubricSetBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
        </div>
      }
    >
      <RubricSetBuilderContent />
    </Suspense>
  );
}

function RubricSetBuilderContent() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const searchParams = useSearchParams();
  const rubricIdParam = searchParams.get("id");

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // ─── State ────────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState<RubricSetFormData>({
    title: "",
    subject: "",
    total_marks: 0,
    metadata: {},
    questions: [],
  });
  const [rubricSetId, setRubricSetId] = useState<string | null>(null);
  const [rubricVersion, setRubricVersion] = useState<number>(1);
  const [isPublished, setIsPublished] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRubric, setIsLoadingRubric] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // ─── Load existing rubric ─────────────────────────────────────────────────

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

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const updateField = <K extends keyof RubricSetFormData>(
    field: K,
    value: RubricSetFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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

  const removeQuestion = (index: number) => {
    setFormData((prev) => {
      const newQuestions = prev.questions.filter((_, i) => i !== index);
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
    } else if (selectedQuestionIndex !== null && selectedQuestionIndex > index) {
      setSelectedQuestionIndex(selectedQuestionIndex - 1);
    }
  };

  const updateQuestion = (
    index: number,
    field: keyof QuestionRubric,
    value: string | number | EvaluationRule[],
  ) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q,
      ),
    }));
  };

  // ─── Rule operations ──────────────────────────────────────────────────────

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

  const removeRuleFromQuestion = (ruleIndex: number) => {
    if (selectedQuestionIndex === null) return;
    const question = formData.questions[selectedQuestionIndex];
    const newRules = question.evaluation_rules.filter((_, i) => i !== ruleIndex);
    updateQuestion(selectedQuestionIndex, "evaluation_rules", newRules);
  };

  const updateRuleInQuestion = (ruleIndex: number, updatedRule: EvaluationRule) => {
    if (selectedQuestionIndex === null) return;
    const question = formData.questions[selectedQuestionIndex];
    const newRules = question.evaluation_rules.map((rule, i) =>
      i === ruleIndex ? updatedRule : rule,
    );
    updateQuestion(selectedQuestionIndex, "evaluation_rules", newRules);
  };

  // ─── Calculations ─────────────────────────────────────────────────────────

  const calculateTotalMarks = () =>
    formData.questions.reduce((sum, q) => sum + (Number(q.max_marks) || 0), 0);

  const calculateQuestionRuleMarks = (questionIndex: number) =>
    formData.questions[questionIndex].evaluation_rules.reduce(
      (sum, rule) => sum + (Number(rule.marks) || 0),
      0,
    );

  // ─── Validation ───────────────────────────────────────────────────────────

  const validateForPublish = (): string[] => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.subject.trim()) errors.push("Subject is required");
    if (formData.total_marks <= 0) errors.push("Total marks must be greater than 0");
    if (formData.questions.length === 0) errors.push("At least one question is required");

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
        errors.push(`Question ${question.question_number}: Marks must be greater than 0`);
      }
      if (question.evaluation_rules.length === 0) {
        errors.push(`Question ${question.question_number}: At least one rule is required`);
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

  // ─── Handlers ─────────────────────────────────────────────────────────────

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
        const result = await updateRubricSet(rubricSetId, formData);
        setRubricVersion(result.version);
        setSuccess(`Rubric set updated successfully! (Version ${result.version})`);
      } else {
        const result = await createRubricSet(formData);
        setRubricSetId(result.id);
        setRubricVersion(result.version);
        setSuccess("Rubric set created successfully!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rubric set");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishClick = () => {
    const errors = validateForPublish();
    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }
    setShowPublishModal(true);
  };

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
      setSuccess(`Rubric set published successfully! (Version ${result.version})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish rubric set");
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

      const normalizeRuleConfig = (rule: Record<string, unknown>) => {
        const type = (rule.type as string) || "keyword";
        const config = (rule.config as Record<string, unknown>) || {};

        switch (type) {
          case "keyword":
            return {
              ...config,
              required_keywords: (config.required_keywords as string[]) || [],
              scoring_mode: (config.scoring_mode as string) || "proportional",
            };
          case "numeric":
            return {
              ...config,
              expected_value: (config.expected_value as number) ?? 0,
              tolerance: (config.tolerance as number) ?? 0,
            };
          case "stepwise":
            return {
              ...config,
              step_description: (config.step_description as string) || "",
              expected_patterns: (config.expected_patterns as string[]) || [],
              allow_partial_credit: (config.allow_partial_credit as boolean) ?? true,
            };
          default:
            return config;
        }
      };

      const questionsWithIds = (parsedData.questions || []).map(
        (question: QuestionRubric) => ({
          ...question,
          evaluation_rules: ((question.evaluation_rules || []) as unknown as Record<string, unknown>[]).map(
            (rule) => ({
              ...rule,
              id: (rule.id as string) || crypto.randomUUID(),
              type: (rule.type as string) || "keyword",
              marks: (rule.marks as number) || 0,
              config: normalizeRuleConfig(rule),
              feedback: {
                on_success: ((rule.feedback as Record<string, unknown>)?.on_success as string) || "Correct",
                on_partial: ((rule.feedback as Record<string, unknown>)?.on_partial as string) || null,
                on_failure: ((rule.feedback as Record<string, unknown>)?.on_failure as string) || "Incorrect",
              },
            }),
          ) as unknown as EvaluationRule[],
        }),
      );

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
      setSuccess("Document parsed successfully! Review and edit the extracted rubric data.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document");
    } finally {
      setIsParsingDocument(false);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const selectedQuestion =
    selectedQuestionIndex !== null ? formData.questions[selectedQuestionIndex] : null;

  // ─── Auth loading guard ───────────────────────────────────────────────────

  if (!isReady || !isAuthenticated || !user || user.role !== "teacher") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="teacher" />
      <div className="ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                {rubricSetId ? "Edit Rubric" : "Rubric Builder"}
              </h1>
              <p className="text-sm text-primary">
                {rubricSetId
                  ? "Modify an existing assessment rubric"
                  : "Create assessments with multiple questions"}
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-primary transition-colors text-sm font-medium flex items-center gap-2"
            >
              <FileUp className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-8 py-8">
          {isLoadingRubric && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-primary">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading rubric...</span>
              </div>
            </div>
          )}

          {!isLoadingRubric && error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isLoadingRubric && success && (
            <div className="mb-6 bg-primary/10 border border-primary rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary-dark shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-primary-dark">{success}</p>
              <button onClick={() => setSuccess(null)} className="text-primary hover:text-primary-dark transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isLoadingRubric && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <RubricInfoForm
                  title={formData.title}
                  subject={formData.subject}
                  totalMarks={formData.total_marks}
                  questionsTotalMarks={calculateTotalMarks()}
                  onTitleChange={(v) => updateField("title", v)}
                  onSubjectChange={(v) => updateField("subject", v)}
                  onTotalMarksChange={(v) => updateField("total_marks", v)}
                />

                <QuestionsList
                  questions={formData.questions}
                  selectedIndex={selectedQuestionIndex}
                  isPublished={isPublished}
                  onSelect={setSelectedQuestionIndex}
                  onAdd={addQuestion}
                  onRemove={removeQuestion}
                />

                <RubricActions
                  isSubmitting={isSubmitting}
                  showTester={showTester}
                  hasQuestions={formData.questions.length > 0}
                  onSaveDraft={handleSaveDraft}
                  onPublishClick={handlePublishClick}
                  onToggleTester={() => setShowTester(!showTester)}
                />
              </div>

              {/* Right Content */}
              <div className="lg:col-span-3 space-y-6">
                {showTester ? (
                  <MultiQuestionTester questions={formData.questions} />
                ) : selectedQuestion ? (
                  <QuestionEditorPanel
                    question={selectedQuestion}
                    questionIndex={selectedQuestionIndex!}
                    questionRuleMarks={calculateQuestionRuleMarks(selectedQuestionIndex!)}
                    onUpdateField={(field, value) =>
                      updateQuestion(selectedQuestionIndex!, field, value)
                    }
                    onAddRule={addRuleToQuestion}
                    onRemoveRule={removeRuleFromQuestion}
                    onUpdateRule={updateRuleInQuestion}
                  />
                ) : (
                  <EmptyStatePanel
                    onAddQuestion={addQuestion}
                    onUploadDocument={() => setShowUploadModal(true)}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {showPublishModal && (
        <ConfirmPublishModal
          onConfirm={confirmPublish}
          onCancel={() => setShowPublishModal(false)}
        />
      )}

      {showUploadModal && (
        <UploadDocumentModal
          uploadedFile={uploadedFile}
          isParsing={isParsingDocument}
          onFileSelect={handleFileUpload}
          onRemoveFile={() => setUploadedFile(null)}
          onParse={handleParseDocument}
          onClose={() => {
            setShowUploadModal(false);
            setUploadedFile(null);
          }}
        />
      )}
    </div>
  );
}
