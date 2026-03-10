"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  generatePractice,
  submitTypedAnswers,
  submitImageAnswer,
  type PracticeQuestion,
  type GeneratePracticeResponse,
  type PracticeResultsResponse,
  type TypedAnswer,
} from "@/api/practice";
import { getMySubjects } from "@/api/school";
import {
  BookOpen,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  Type,
  RotateCcw,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "setup" | "questions" | "results";
type AnswerMode = "typed" | "photo";

// ─── Main Page ────────────────────────────────────────────────────────────────

function PracticePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, isAuthenticated, user } = useAuth();

  const subjectParam = searchParams.get("subject") ?? "";
  const isFromAnalytics = subjectParam.length > 0;

  // Phase state
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup state
  const [subject, setSubject] = useState<string>(subjectParam);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [numQuestions, setNumQuestions] = useState<5 | 10 | 15>(5);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("typed");

  // Session state
  const [session, setSession] = useState<GeneratePracticeResponse | null>(null);
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({});

  // Photo mode
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Results
  const [results, setResults] = useState<PracticeResultsResponse | null>(null);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Load available subjects when visiting directly (no URL param)
  useEffect(() => {
    if (!isReady || !isAuthenticated || isFromAnalytics) return;
    setSubjectsLoading(true);
    getMySubjects()
      .then((subjects) => {
        setAvailableSubjects(subjects);
      })
      .catch(() => {
        // Non-fatal — student can still type a subject manually
      })
      .finally(() => setSubjectsLoading(false));
  }, [isReady, isAuthenticated, isFromAnalytics]);

  // Revoke object URL on unmount / change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isReady || !isAuthenticated || !user || user.role !== "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!subject.trim()) {
      setError("Please select or enter a subject.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const data = await generatePractice(subject, numQuestions);
      setSession(data);
      // Initialise empty typed answers
      const initial: Record<string, string> = {};
      data.questions.forEach((q) => {
        initial[q.id] = "";
      });
      setTypedAnswers(initial);
      if (answerMode === "photo" && data.questions.length > 0) {
        setSelectedQuestionId(data.questions[0].id);
      }
      setPhase("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmitTyped = async () => {
    if (!session) return;
    setIsGrading(true);
    setError(null);
    try {
      const answers: TypedAnswer[] = session.questions.map((q) => ({
        question_id: q.id,
        answer_text: typedAnswers[q.id] ?? "",
      }));
      const data = await submitTypedAnswers(session.session_id, answers);
      setResults(data);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade answers.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleSubmitImage = async () => {
    if (!session || !selectedFile || !selectedQuestionId) {
      setError("Please select a question and upload an image.");
      return;
    }
    setIsGrading(true);
    setError(null);
    try {
      const data = await submitImageAnswer(
        session.session_id,
        selectedQuestionId,
        selectedFile,
      );
      setResults(data);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade image.");
    } finally {
      setIsGrading(false);
    }
  };

  const handlePracticeAgain = () => {
    setSession(null);
    setTypedAnswers({});
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedQuestionId("");
    setResults(null);
    setError(null);
    // Keep subject so they can practise the same subject again,
    // but don't lock them in — they can change it in the setup form.
    setPhase("setup");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role="student" />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center gap-4 px-8 py-4">
            <button
              onClick={() => router.push(isFromAnalytics ? "/student/analytics" : "/student/dashboard")}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {isFromAnalytics ? "Analytics" : "Dashboard"}
            </button>
            <div className="h-4 w-px bg-secondary/40" />
            <div>
              <h1 className="text-xl font-bold text-primary-dark">
                Practice Quiz
                {subject && (
                  <span className="ml-2 text-sm font-semibold bg-primary/10 text-primary rounded-full px-3 py-0.5">
                    {subject}
                  </span>
                )}
              </h1>
              <p className="text-xs text-primary">AI-generated exam-style questions</p>
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 px-8 py-8 max-w-3xl mx-auto w-full">
          {phase === "setup" && (
            <SetupPhase
              subject={subject}
              setSubject={setSubject}
              isAutoSelected={isFromAnalytics}
              availableSubjects={availableSubjects}
              subjectsLoading={subjectsLoading}
              numQuestions={numQuestions}
              setNumQuestions={setNumQuestions}
              answerMode={answerMode}
              setAnswerMode={setAnswerMode}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              error={error}
            />
          )}

          {phase === "questions" && session && (
            <QuestionsPhase
              session={session}
              answerMode={answerMode}
              typedAnswers={typedAnswers}
              setTypedAnswers={setTypedAnswers}
              selectedQuestionId={selectedQuestionId}
              setSelectedQuestionId={setSelectedQuestionId}
              selectedFile={selectedFile}
              previewUrl={previewUrl}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onSubmitTyped={handleSubmitTyped}
              onSubmitImage={handleSubmitImage}
              isGrading={isGrading}
              error={error}
            />
          )}

          {phase === "results" && results && (
            <ResultsPhase
              results={results}
              onPracticeAgain={handlePracticeAgain}
              onBackToAnalytics={() => router.push("/student/analytics")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Setup Phase ──────────────────────────────────────────────────────────────

interface SetupPhaseProps {
  subject: string;
  setSubject: (s: string) => void;
  isAutoSelected: boolean;
  availableSubjects: string[];
  subjectsLoading: boolean;
  numQuestions: 5 | 10 | 15;
  setNumQuestions: (n: 5 | 10 | 15) => void;
  answerMode: AnswerMode;
  setAnswerMode: (m: AnswerMode) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

function SetupPhase({
  subject,
  setSubject,
  isAutoSelected,
  availableSubjects,
  subjectsLoading,
  numQuestions,
  setNumQuestions,
  answerMode,
  setAnswerMode,
  onGenerate,
  isGenerating,
  error,
}: SetupPhaseProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-secondary/30 p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-secondary/20">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-primary-dark">Set Up Your Practice</h2>
        </div>

        {/* Subject selector */}
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-3">Subject</label>

          {isAutoSelected ? (
            /* Read-only pill when redirected from analytics */
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold px-4 py-2 rounded-full text-sm">
              <BookOpen className="w-4 h-4" />
              {subject}
            </div>
          ) : subjectsLoading ? (
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your subjects…
            </div>
          ) : availableSubjects.length > 0 ? (
            /* Clickable subject pills from analytics history */
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      subject === s
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-primary border-secondary/50 hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary">Or enter a different subject:</p>
              <input
                type="text"
                value={availableSubjects.includes(subject) ? "" : subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Chemistry, History…"
                className="w-full text-sm text-primary-dark border border-secondary/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-secondary/50"
              />
            </div>
          ) : (
            /* No analytics history — just a text input */
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Biology…"
              className="w-full text-sm text-primary-dark border border-secondary/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-secondary/50"
            />
          )}
        </div>

        {/* Number of questions */}
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-3">
            Number of Questions
          </label>
          <div className="flex gap-3">
            {([5, 10, 15] as const).map((n) => (
              <button
                key={n}
                onClick={() => setNumQuestions(n)}
                className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-all ${
                  numQuestions === n
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-primary border-secondary/50 hover:border-primary/50"
                }`}
              >
                {n} Questions
              </button>
            ))}
          </div>
        </div>

        {/* Answer mode */}
        <div>
          <label className="block text-sm font-medium text-primary-dark mb-3">
            Answer Mode
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setAnswerMode("typed")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-semibold transition-all ${
                answerMode === "typed"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-primary border-secondary/50 hover:border-primary/50"
              }`}
            >
              <Type className="w-4 h-4" />
              Type Answers
            </button>
            <button
              onClick={() => setAnswerMode("photo")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-semibold transition-all ${
                answerMode === "photo"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-primary border-secondary/50 hover:border-primary/50"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Upload Photo
            </button>
          </div>
          {answerMode === "photo" && (
            <p className="mt-2 text-xs text-secondary">
              You&apos;ll upload one photo of your handwritten answer for a selected question.
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={isGenerating || !subject.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating questions…
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              Generate Questions
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Questions Phase ──────────────────────────────────────────────────────────

interface QuestionsPhaseProps {
  session: GeneratePracticeResponse;
  answerMode: AnswerMode;
  typedAnswers: Record<string, string>;
  setTypedAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedQuestionId: string;
  setSelectedQuestionId: (id: string) => void;
  selectedFile: File | null;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitTyped: () => void;
  onSubmitImage: () => void;
  isGrading: boolean;
  error: string | null;
}

function QuestionsPhase({
  session,
  answerMode,
  typedAnswers,
  setTypedAnswers,
  selectedQuestionId,
  setSelectedQuestionId,
  selectedFile,
  previewUrl,
  fileInputRef,
  onFileChange,
  onSubmitTyped,
  onSubmitImage,
  isGrading,
  error,
}: QuestionsPhaseProps) {
  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-secondary">
        <span>{session.questions.length} questions</span>
        <span>{session.total_marks} total marks</span>
      </div>

      {answerMode === "typed" ? (
        <>
          {session.questions.map((q) => (
            <TypedQuestionCard
              key={q.id}
              question={q}
              value={typedAnswers[q.id] ?? ""}
              onChange={(val) =>
                setTypedAnswers((prev) => ({ ...prev, [q.id]: val }))
              }
            />
          ))}
        </>
      ) : (
        <PhotoQuestionCard
          questions={session.questions}
          selectedQuestionId={selectedQuestionId}
          setSelectedQuestionId={setSelectedQuestionId}
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={answerMode === "typed" ? onSubmitTyped : onSubmitImage}
        disabled={isGrading}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isGrading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Grading answers…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Submit for Grading
          </>
        )}
      </button>
    </div>
  );
}

function TypedQuestionCard({
  question,
  value,
  onChange,
}: {
  question: PracticeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
            {question.number}
          </span>
          <p className="text-sm text-primary-dark leading-relaxed">{question.text}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-secondary bg-secondary/10 px-2 py-1 rounded-full">
          {question.marks} mark{question.marks !== 1 ? "s" : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here…"
        rows={4}
        className="w-full text-sm text-primary-dark border border-secondary/40 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-secondary/60"
      />
    </div>
  );
}

function PhotoQuestionCard({
  questions,
  selectedQuestionId,
  setSelectedQuestionId,
  selectedFile,
  previewUrl,
  fileInputRef,
  onFileChange,
}: {
  questions: PracticeQuestion[];
  selectedQuestionId: string;
  setSelectedQuestionId: (id: string) => void;
  selectedFile: File | null;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-secondary/30 p-6 shadow-sm space-y-5">
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-3">
          Which question are you answering?
        </label>
        <div className="space-y-2">
          {questions.map((q) => (
            <label
              key={q.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedQuestionId === q.id
                  ? "border-primary bg-primary/5"
                  : "border-secondary/30 hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="selected_question"
                value={q.id}
                checked={selectedQuestionId === q.id}
                onChange={() => setSelectedQuestionId(q.id)}
                className="mt-0.5 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-primary-dark font-medium">Q{q.number}. </span>
                <span className="text-sm text-primary-dark">{q.text}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold text-secondary">
                {q.marks}m
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div>
        <label className="block text-sm font-medium text-primary-dark mb-3">
          Upload your handwritten answer
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-secondary/40 rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Answer preview"
              className="max-h-60 rounded-lg object-contain"
            />
          ) : (
            <>
              <Upload className="w-8 h-8 text-secondary" />
              <p className="text-sm text-secondary text-center">
                Click to upload a photo of your handwritten answer
              </p>
              <p className="text-xs text-secondary/60">JPG, PNG, WEBP</p>
            </>
          )}
          {selectedFile && (
            <p className="text-xs text-primary font-medium">{selectedFile.name}</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}

// ─── Results Phase ────────────────────────────────────────────────────────────

function ResultsPhase({
  results,
  onPracticeAgain,
  onBackToAnalytics,
}: {
  results: PracticeResultsResponse;
  onPracticeAgain: () => void;
  onBackToAnalytics: () => void;
}) {
  const percentage = results.percentage;
  const scoreColor =
    percentage >= 75 ? "text-green-600" : percentage >= 50 ? "text-yellow-600" : "text-red-600";
  const scoreRing =
    percentage >= 75 ? "border-green-400" : percentage >= 50 ? "border-yellow-400" : "border-red-400";

  return (
    <div className="space-y-6">
      {/* Score card */}
      <div className="bg-white rounded-xl border border-secondary/30 p-8 shadow-sm text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-primary-dark">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Your Results</h2>
        </div>
        <div
          className={`mx-auto w-28 h-28 rounded-full border-4 ${scoreRing} flex flex-col items-center justify-center`}
        >
          <span className={`text-2xl font-bold ${scoreColor}`}>{percentage}%</span>
          <span className="text-xs text-secondary">
            {results.total_score}/{results.max_score}
          </span>
        </div>
        <p className="text-sm text-secondary">
          {results.subject} &middot; {results.results.length} question
          {results.results.length !== 1 ? "s" : ""}
        </p>
        <p className="text-sm font-medium text-primary-dark">
          {percentage >= 75
            ? "Great work! Keep it up."
            : percentage >= 50
              ? "Good effort — review the model answers below."
              : "Keep studying — check the feedback to improve."}
        </p>
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-4">
        {results.results.map((r) => {
          const pct = r.max_marks > 0 ? r.marks_awarded / r.max_marks : 0;
          const passed = pct >= 0.5;
          return (
            <div
              key={r.question_id}
              className="bg-white rounded-xl border border-secondary/30 p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-secondary mb-1">
                      Question {r.number}
                    </p>
                    <p className="text-sm text-primary-dark leading-relaxed">{r.text}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold px-3 py-1 rounded-full ${
                    passed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {r.marks_awarded}/{r.max_marks}
                </span>
              </div>

              {/* Feedback */}
              {r.feedback && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-xs text-blue-800">
                  <span className="font-semibold">Feedback: </span>
                  {r.feedback}
                </div>
              )}

              {/* Model answer */}
              {r.model_answer && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-primary hover:text-primary-dark transition-colors select-none">
                    View model answer
                  </summary>
                  <div className="mt-2 bg-gray-50 border border-secondary/30 rounded-lg px-4 py-2 text-xs text-primary-dark leading-relaxed whitespace-pre-wrap">
                    {r.model_answer}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onPracticeAgain}
          className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Practice Again
        </button>
        <button
          onClick={onBackToAnalytics}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-secondary/40 hover:bg-gray-50 text-primary-dark font-semibold py-3 rounded-xl transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          Back to Analytics
        </button>
      </div>
    </div>
  );
}

// ─── Export with Suspense (useSearchParams needs it) ──────────────────────────

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
        </div>
      }
    >
      <PracticePageContent />
    </Suspense>
  );
}
