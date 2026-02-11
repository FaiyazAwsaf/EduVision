/**
 * Content Request Form Component — Role-Aware
 *
 * Renders a completely different experience for teachers vs students:
 *
 * TEACHER:
 * - Content templates (quick presets for common tasks)
 * - 7 content types including Lesson Plan, Quiz, Worksheet, Topic Explanation
 * - Target class & section selectors (auto-suggests difficulty)
 * - Subject auto-filled from teacher profile department
 * - Output format selection (Text / PDF / Worksheet)
 *
 * STUDENT:
 * - 3 content types: Summary, Worked Examples, Formula Sheet
 * - Learning Context form for personalization
 * - Simpler, study-focused layout
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createContentRequest,
  submitLearningContext,
} from "@/api/contentRequests";
import {
  getTeacherProfile,
  getClasses,
  type SchoolClass,
  type SchoolSection,
  type TeacherProfile,
} from "@/api/school";
import ErrorMessage from "@/components/shared/ErrorMessage";
import LearningContextForm from "./LearningContextForm";
import {
  ContentType,
  Style,
  Difficulty,
  OutputFormat,
  type CreateContentRequestPayload,
  type LearningContextPayload,
} from "@/types/content";
import {
  Sparkles,
  GraduationCap,
  FileText,
  ClipboardList,
  BookOpen,
  Calculator,
  Lightbulb,
  LayoutList,
  Target,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  PenLine,
  BookMarked,
  Ruler,
  Pencil,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────────────────────── */

interface ContentTypeOption {
  value: ContentType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const STUDENT_CONTENT_TYPES: ContentTypeOption[] = [
  {
    value: ContentType.SUMMARY,
    label: "Summary",
    description: "Concise overview of a topic with key concepts",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    value: ContentType.WORKED_EXAMPLES,
    label: "Worked Examples",
    description: "Step-by-step solved problems to learn from",
    icon: <Calculator className="w-5 h-5" />,
  },
  {
    value: ContentType.FORMULA_SHEET,
    label: "Formula Sheet",
    description: "Quick-reference sheet of formulas and equations",
    icon: <LayoutList className="w-5 h-5" />,
  },
];

const TEACHER_CONTENT_TYPES: ContentTypeOption[] = [
  {
    value: ContentType.LESSON_PLAN,
    label: "Lesson Plan",
    description: "Structured teaching plan with objectives and activities",
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    value: ContentType.QUIZ_GENERATOR,
    label: "Quiz Generator",
    description: "Auto-generated quiz with answer key and marking scheme",
    icon: <ClipboardList className="w-5 h-5" />,
  },
  {
    value: ContentType.WORKSHEET_BUILDER,
    label: "Worksheet Builder",
    description: "Printable worksheet with exercises and activities",
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    value: ContentType.TOPIC_EXPLANATION,
    label: "Topic Explanation",
    description: "In-depth explanation suitable for classroom delivery",
    icon: <Lightbulb className="w-5 h-5" />,
  },
  {
    value: ContentType.SUMMARY,
    label: "Summary",
    description: "Concise overview with key takeaways",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    value: ContentType.WORKED_EXAMPLES,
    label: "Worked Examples",
    description: "Solved problems with detailed workings",
    icon: <Calculator className="w-5 h-5" />,
  },
  {
    value: ContentType.FORMULA_SHEET,
    label: "Formula Sheet",
    description: "Quick-reference formula compilation",
    icon: <LayoutList className="w-5 h-5" />,
  },
];

interface ContentTemplate {
  label: string;
  topic: string;
  content_type: ContentType;
  style: Style;
  difficulty?: Difficulty;
  notes?: string;
}

interface TemplateWithIcon extends ContentTemplate {
  icon: React.ReactNode;
}

const TEACHER_TEMPLATES: TemplateWithIcon[] = [
  {
    label: "Quick Quiz",
    icon: <PenLine className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.QUIZ_GENERATOR,
    style: Style.DETAILED,
    difficulty: Difficulty.MEDIUM,
    notes:
      "Generate a 10-question quiz with mix of MCQ and short answer. Include answer key.",
  },
  {
    label: "Worksheet",
    icon: <ClipboardList className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.WORKSHEET_BUILDER,
    style: Style.STEP_BY_STEP,
    difficulty: Difficulty.MEDIUM,
    notes:
      "Create a printable worksheet with progressive difficulty. Include space for student work.",
  },
  {
    label: "Lesson Plan",
    icon: <BookOpen className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.LESSON_PLAN,
    style: Style.DETAILED,
    notes:
      "Include learning objectives, warm-up activity, main instruction, practice, and assessment.",
  },
  {
    label: "Explain Topic",
    icon: <Lightbulb className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.TOPIC_EXPLANATION,
    style: Style.STEP_BY_STEP,
    notes:
      "Break down the concept from basics. Include real-world examples and common misconceptions.",
  },
];

const STUDENT_TEMPLATES: TemplateWithIcon[] = [
  {
    label: "Exam Summary",
    icon: <BookMarked className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.SUMMARY,
    style: Style.BRIEF,
    notes:
      "Focus on exam-relevant points, key definitions, and important formulas.",
  },
  {
    label: "Practice Problems",
    icon: <Pencil className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.WORKED_EXAMPLES,
    style: Style.STEP_BY_STEP,
    difficulty: Difficulty.MEDIUM,
    notes:
      "Show step-by-step solutions. Include similar practice problems at the end.",
  },
  {
    label: "Formula Reference",
    icon: <Ruler className="w-4 h-4" />,
    topic: "",
    content_type: ContentType.FORMULA_SHEET,
    style: Style.BRIEF,
    notes:
      "Organize formulas by category. Include units and variable descriptions.",
  },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

interface ContentRequestFormProps {
  onSuccess: (requestId: string) => void;
  userRole?: "student" | "teacher";
  userId?: string;
}

export default function ContentRequestForm({
  onSuccess,
  userRole = "student",
  userId,
}: ContentRequestFormProps) {
  const isTeacher = userRole === "teacher";
  const contentTypes = isTeacher
    ? TEACHER_CONTENT_TYPES
    : STUDENT_CONTENT_TYPES;
  const templates = isTeacher ? TEACHER_TEMPLATES : STUDENT_TEMPLATES;

  // ─── Form state ───────────────────────────────────────────────────────
  const [formData, setFormData] = useState<CreateContentRequestPayload>({
    topic: "",
    content_type: isTeacher ? ContentType.LESSON_PLAN : ContentType.SUMMARY,
    style: Style.DETAILED,
    output_format: OutputFormat.TEXT,
    difficulty: Difficulty.MEDIUM,
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learningContext, setLearningContext] =
    useState<LearningContextPayload | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ─── Teacher-specific state ───────────────────────────────────────────
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(
    null,
  );
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    null,
  );
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // ─── Load teacher profile & classes ───────────────────────────────────
  useEffect(() => {
    if (!isTeacher || !userId) return;

    async function loadTeacherData() {
      setLoadingProfile(true);
      try {
        const profile = await getTeacherProfile(userId!);
        setTeacherProfile(profile);
        // Auto-fill subject from department if not already set
        if (profile.department && !formData.subject) {
          setFormData((prev) => ({ ...prev, subject: profile.department }));
        }
      } catch (err) {
        console.warn("Could not load teacher profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    async function loadClasses() {
      setLoadingClasses(true);
      try {
        const data = await getClasses();
        setClasses(data);
      } catch (err) {
        console.warn("Could not load classes:", err);
      } finally {
        setLoadingClasses(false);
      }
    }

    loadTeacherData();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, userId]);

  // ─── Auto-suggest difficulty from selected class ──────────────────────
  const suggestDifficulty = useCallback((className: string) => {
    const num = parseInt(className, 10);
    if (isNaN(num)) return;
    if (num <= 5) return Difficulty.EASY;
    if (num <= 8) return Difficulty.MEDIUM;
    return Difficulty.HARD;
  }, []);

  const handleClassChange = (classId: number | null) => {
    setSelectedClassId(classId);
    setSelectedSectionId(null);
    if (classId) {
      const cls = classes.find((c) => c.id === classId);
      if (cls) {
        const suggested = suggestDifficulty(cls.name);
        if (suggested) {
          setFormData((prev) => ({ ...prev, difficulty: suggested }));
        }
      }
      setFormData((prev) => ({ ...prev, target_class_id: String(classId) }));
    } else {
      setFormData((prev) => {
        const next = { ...prev };
        delete next.target_class_id;
        delete next.target_section_id;
        return next;
      });
    }
  };

  const handleSectionChange = (sectionId: number | null) => {
    setSelectedSectionId(sectionId);
    if (sectionId) {
      setFormData((prev) => ({
        ...prev,
        target_section_id: String(sectionId),
      }));
    } else {
      setFormData((prev) => {
        const next = { ...prev };
        delete next.target_section_id;
        return next;
      });
    }
  };

  // ─── Sections for the selected class ──────────────────────────────────
  const availableSections: SchoolSection[] = selectedClassId
    ? classes.find((c) => c.id === selectedClassId)?.sections || []
    : [];

  // ─── Template selection ───────────────────────────────────────────────
  const applyTemplate = (template: ContentTemplate) => {
    setFormData((prev) => ({
      ...prev,
      content_type: template.content_type,
      style: template.style,
      difficulty: template.difficulty || prev.difficulty,
      notes: template.notes || "",
    }));
  };

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.topic.trim()) {
      setError("Topic is required");
      return;
    }
    if (formData.topic.trim().length < 3) {
      setError("Topic must be at least 3 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateContentRequestPayload = {
        ...formData,
        topic: formData.topic.trim(),
      };
      if (!payload.notes?.trim()) delete payload.notes;
      if (!payload.subject?.trim()) delete payload.subject;

      const response = await createContentRequest(payload);

      // Submit learning context if provided (student flow)
      if (learningContext) {
        try {
          await submitLearningContext(response.id, learningContext);
        } catch (contextError) {
          console.warn("Failed to submit learning context:", contextError);
        }
      }

      onSuccess(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      topic: "",
      content_type: isTeacher ? ContentType.LESSON_PLAN : ContentType.SUMMARY,
      style: Style.DETAILED,
      output_format: OutputFormat.TEXT,
      difficulty: Difficulty.MEDIUM,
      notes: "",
      subject: teacherProfile?.department || "",
    });
    setSelectedClassId(null);
    setSelectedSectionId(null);
    setError(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ── Templates ──────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-primary-dark mb-3">
          <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Quick Templates
        </label>
        <div
          className={`grid gap-2 ${isTeacher ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}
        >
          {templates.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              disabled={isSubmitting}
              className="text-left px-3 py-2.5 rounded-lg border border-secondary/60 hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-primary-dark disabled:opacity-50 flex items-center gap-2"
            >
              <span className="text-primary">{tpl.icon}</span>
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Type Cards ─────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-primary-dark mb-3">
          Content Type <span className="text-red-500">*</span>
        </label>
        <div
          className={`grid gap-2 ${isTeacher ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}
        >
          {contentTypes.map((ct) => {
            const isSelected = formData.content_type === ct.value;
            return (
              <button
                key={ct.value + ct.label}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, content_type: ct.value }))
                }
                disabled={isSubmitting}
                className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-secondary/40 hover:border-primary/40 hover:bg-background"
                } disabled:opacity-50`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 ${
                      isSelected ? "text-primary" : "text-secondary"
                    }`}
                  >
                    {ct.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-dark">
                      {ct.label}
                    </p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {ct.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Topic ──────────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="topic"
          className="block text-sm font-semibold text-primary-dark mb-1.5"
        >
          <Target className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="topic"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder={
            isTeacher
              ? "e.g., Pythagorean Theorem, Photosynthesis, World War II"
              : "e.g., Quadratic Equations, Newton's Laws"
          }
          disabled={isSubmitting}
          className="block w-full rounded-lg border border-secondary px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 placeholder:text-secondary"
          required
        />
      </div>

      {/* ── Subject + Class/Section (Teacher) ──────────────────────────── */}
      {isTeacher ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Subject */}
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-semibold text-primary-dark mb-1.5"
            >
              Subject
              {teacherProfile?.department && (
                <span className="ml-1.5 text-xs font-normal text-primary">
                  (auto-filled)
                </span>
              )}
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject || ""}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder={loadingProfile ? "Loading..." : "e.g., Mathematics"}
              disabled={isSubmitting}
              className="block w-full rounded-lg border border-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 placeholder:text-secondary"
            />
          </div>

          {/* Target Class */}
          <div>
            <label
              htmlFor="target_class"
              className="block text-sm font-semibold text-primary-dark mb-1.5"
            >
              <Users className="w-4 h-4 inline mr-1 -mt-0.5" />
              Target Class
            </label>
            <select
              id="target_class"
              value={selectedClassId || ""}
              onChange={(e) =>
                handleClassChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              disabled={isSubmitting || loadingClasses}
              className="block w-full rounded-lg border border-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 text-primary-dark"
            >
              <option value="">
                {loadingClasses ? "Loading..." : "All classes"}
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.name}
                  {cls.stream ? ` (${cls.stream})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Target Section */}
          <div>
            <label
              htmlFor="target_section"
              className="block text-sm font-semibold text-primary-dark mb-1.5"
            >
              Section
            </label>
            <select
              id="target_section"
              value={selectedSectionId || ""}
              onChange={(e) =>
                handleSectionChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              disabled={
                isSubmitting ||
                !selectedClassId ||
                availableSections.length === 0
              }
              className="block w-full rounded-lg border border-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 text-primary-dark"
            >
              <option value="">
                {!selectedClassId
                  ? "Select a class first"
                  : availableSections.length === 0
                    ? "No sections"
                    : "All sections"}
              </option>
              {availableSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Section {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* Student: just Subject */
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-semibold text-primary-dark mb-1.5"
          >
            Subject
            <span className="ml-1.5 text-xs font-normal text-muted">
              (optional)
            </span>
          </label>
          <input
            type="text"
            id="subject"
            value={formData.subject || ""}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
            placeholder="e.g., Mathematics, Physics"
            disabled={isSubmitting}
            className="block w-full rounded-lg border border-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 placeholder:text-secondary"
          />
        </div>
      )}

      {/* ── Style + Difficulty Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Style */}
        <div>
          <label
            htmlFor="style"
            className="block text-sm font-semibold text-primary-dark mb-1.5"
          >
            Style
          </label>
          <div className="flex rounded-lg border border-secondary overflow-hidden">
            {[
              { value: Style.BRIEF, label: "Brief" },
              { value: Style.DETAILED, label: "Detailed" },
              { value: Style.STEP_BY_STEP, label: "Step by Step" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, style: opt.value }))
                }
                disabled={isSubmitting}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  formData.style === opt.value
                    ? "bg-primary text-white"
                    : "bg-white text-primary-dark hover:bg-background"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label
            htmlFor="difficulty"
            className="block text-sm font-semibold text-primary-dark mb-1.5"
          >
            Difficulty
            {isTeacher && selectedClassId && (
              <span className="ml-1.5 text-xs font-normal text-primary">
                (auto-suggested)
              </span>
            )}
          </label>
          <div className="flex rounded-lg border border-secondary overflow-hidden">
            {[
              { value: Difficulty.EASY, label: "Easy" },
              { value: Difficulty.MEDIUM, label: "Medium" },
              { value: Difficulty.HARD, label: "Hard" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, difficulty: opt.value }))
                }
                disabled={isSubmitting}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  formData.difficulty === opt.value
                    ? "bg-primary text-white"
                    : "bg-white text-primary-dark hover:bg-background"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Output Format (Teacher only) ───────────────────────────────── */}
      {isTeacher && (
        <div>
          <label className="block text-sm font-semibold text-primary-dark mb-1.5">
            Output Format
          </label>
          <div className="flex rounded-lg border border-secondary overflow-hidden">
            {[
              { value: OutputFormat.TEXT, label: "Text" },
              { value: OutputFormat.PDF, label: "PDF" },
              { value: OutputFormat.WORKSHEET, label: "Worksheet" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    output_format: opt.value,
                  }))
                }
                disabled={isSubmitting}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  formData.output_format === opt.value
                    ? "bg-primary text-white"
                    : "bg-white text-primary-dark hover:bg-background"
                } disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Advanced / Notes ────────────────────────────────────────────── */}
      <div className="border border-secondary/40 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-background/50 hover:bg-background transition-colors"
        >
          <span className="text-sm font-medium text-primary-dark flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            {isTeacher
              ? "Additional Instructions"
              : "Additional Notes & Learning Context"}
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-primary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-primary" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-4 space-y-4 border-t border-secondary/30">
            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-primary-dark mb-1"
              >
                {isTeacher ? "Special Instructions" : "Additional Notes"}
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder={
                  isTeacher
                    ? "e.g., Include 5 MCQs and 3 short-answer questions. Focus on application-level thinking..."
                    : "e.g., I want to focus on specific subtopics, or need extra examples..."
                }
                rows={3}
                disabled={isSubmitting}
                className="block w-full rounded-lg border border-secondary px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 placeholder:text-secondary"
              />
              <p className="mt-1 text-xs text-muted">Maximum 2000 characters</p>
            </div>

            {/* Learning Context (Student only) */}
            {!isTeacher && (
              <LearningContextForm
                onContextChange={setLearningContext}
                disabled={isSubmitting}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Content
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isSubmitting}
          className="rounded-xl border border-secondary bg-white px-5 py-3 text-sm font-semibold text-primary-dark hover:bg-background disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
