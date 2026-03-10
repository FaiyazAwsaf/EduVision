"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronDown,
  BookOpen,
  Target,
  Paperclip,
  Upload,
  Trash2,
  ExternalLink,
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  LinkIcon,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOutlineDetail,
  reparseOutline,
  uploadTopicMaterial,
  deleteTopicMaterial,
} from "@/api/curriculum";
import type {
  CourseOutlineDetail,
  CourseTopic,
  CourseWeek,
  TopicMaterial,
} from "@/types/curriculum";

// ─── Topic Tree Node ─────────────────────────────────────────────────────────

function TopicNode({
  topic,
  depth,
  onUploadMaterial,
  onDeleteMaterial,
}: {
  topic: CourseTopic;
  depth: number;
  onUploadMaterial: (topicId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = topic.subtopics && topic.subtopics.length > 0;

  return (
    <div
      className={depth > 0 ? "ml-5 border-l-2 border-secondary/30 pl-4" : ""}
    >
      <div className="flex items-start gap-2 py-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => hasChildren && setExpanded((p) => !p)}
            className={`flex items-center gap-2 text-left ${hasChildren ? "cursor-pointer" : "cursor-default"}`}
          >
            {hasChildren && (
              <ChevronDown
                className={`w-4 h-4 text-muted shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
              />
            )}
            <span className="text-sm font-medium text-primary-dark">
              {topic.title}
            </span>
          </button>
          {topic.description && (
            <p className="text-xs text-muted mt-0.5 ml-6">
              {topic.description}
            </p>
          )}
          {topic.course_outcomes && topic.course_outcomes.length > 0 && (
            <div className="ml-6 mt-1 flex flex-wrap gap-1.5">
              {topic.course_outcomes.map((co: string, i: number) => (
                <span
                  key={i}
                  className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                >
                  {co}
                </span>
              ))}
            </div>
          )}
          {/* Materials */}
          {topic.materials && topic.materials.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              {topic.materials.map((m: TopicMaterial) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs text-muted"
                >
                  {m.material_type === "FILE" ? (
                    <Paperclip className="w-3.5 h-3.5" />
                  ) : m.material_type === "GENERATED" ? (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <LinkIcon className="w-3.5 h-3.5" />
                  )}
                  {m.material_type === "GENERATED" && m.content_request_id ? (
                    <Link
                      href={`/content/history/${m.content_request_id}`}
                      className="text-primary hover:underline"
                    >
                      {m.title}
                    </Link>
                  ) : m.material_type === "LINK" && m.external_link ? (
                    <a
                      href={m.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : (
                    <span>{m.title}</span>
                  )}
                  <button
                    onClick={() => onDeleteMaterial(m.id)}
                    className="text-red-400 hover:text-red-600 ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Upload material button — only for parent topics */}
        {depth === 0 && (
          <button
            onClick={() => onUploadMaterial(topic.id)}
            className="shrink-0 p-1.5 text-muted hover:text-primary transition-colors"
            title="Add material"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="mt-1">
          {topic.subtopics!.map((sub) => (
            <TopicNode
              key={sub.id}
              topic={sub}
              depth={depth + 1}
              onUploadMaterial={onUploadMaterial}
              onDeleteMaterial={onDeleteMaterial}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Week Accordion ──────────────────────────────────────────────────────────

function WeekAccordion({
  week,
  onUploadMaterial,
  onDeleteMaterial,
}: {
  week: CourseWeek;
  onUploadMaterial: (topicId: string) => void;
  onDeleteMaterial: (materialId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-background/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary-dark">
            Week {week.week_number}
          </span>
          {week.is_exam_week && (
            <span className="text-[11px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
              {week.exam_label || "Exam Week"}
            </span>
          )}
          <span className="text-xs text-muted">
            {week.topics?.length || 0} topic
            {(week.topics?.length || 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-secondary/20">
          {week.topics && week.topics.length > 0 ? (
            week.topics.map((topic) => (
              <TopicNode
                key={topic.id}
                topic={topic}
                depth={0}
                onUploadMaterial={onUploadMaterial}
                onDeleteMaterial={onDeleteMaterial}
              />
            ))
          ) : (
            <p className="text-sm text-muted py-3">
              {week.is_exam_week
                ? "Examination period — no topics."
                : "No topics for this week."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Material Upload Modal ───────────────────────────────────────────────────

function MaterialUploadModal({
  topicId,
  onClose,
  onUploaded,
}: {
  topicId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"FILE" | "LINK">("FILE");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadTopicMaterial(topicId, {
        title: title.trim(),
        material_type: type,
        description: description.trim() || undefined,
        file: type === "FILE" ? file || undefined : undefined,
        external_link: type === "LINK" ? link.trim() : undefined,
      });
      onUploaded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-primary-dark mb-4">
          Add Material
        </h3>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 Slides"
              className="w-full border border-secondary/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setType("FILE")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  type === "FILE"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-secondary/40 text-muted hover:border-primary/30"
                }`}
              >
                <FileText className="w-4 h-4" /> File
              </button>
              <button
                onClick={() => setType("LINK")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  type === "LINK"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-secondary/40 text-muted hover:border-primary/30"
                }`}
              >
                <ExternalLink className="w-4 h-4" /> Link
              </button>
            </div>
          </div>
          {type === "FILE" ? (
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                File
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full border border-secondary/40 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded-md file:bg-primary/10 file:text-primary file:text-sm file:font-medium"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1">
                URL
              </label>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                className="w-full border border-secondary/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-primary-dark mb-1">
              Description{" "}
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-secondary/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-primary-dark"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !title.trim() ||
              (type === "FILE" && !file) ||
              (type === "LINK" && !link.trim()) ||
              isUploading
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OutlineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const outlineId = params.id as string;
  const { isReady, isAuthenticated, user } = useAuth();

  const [outline, setOutline] = useState<CourseOutlineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialTopicId, setMaterialTopicId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const fetchOutline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOutlineDetail(outlineId);
      setOutline(data);
    } catch {
      setError("Failed to load outline.");
    } finally {
      setIsLoading(false);
    }
  }, [outlineId]);

  useEffect(() => {
    if (isReady && isAuthenticated && outlineId) fetchOutline();
  }, [isReady, isAuthenticated, outlineId, fetchOutline]);

  // Poll while processing
  useEffect(() => {
    if (!outline) return;
    if (
      outline.parsing_status !== "PENDING" &&
      outline.parsing_status !== "PROCESSING"
    )
      return;
    const timer = setInterval(fetchOutline, 5000);
    return () => clearInterval(timer);
  }, [outline, fetchOutline]);

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await deleteTopicMaterial(materialId);
      fetchOutline();
    } catch {
      // silent
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !outline) {
    return (
      <div className="px-8 py-12">
        <div className="flex items-center gap-3 bg-red-50 text-red-700 rounded-xl px-5 py-4 max-w-2xl">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error || "Outline not found."}</span>
        </div>
      </div>
    );
  }

  const statusMap: Record<
    string,
    { label: string; icon: React.ElementType; cls: string }
  > = {
    PENDING: {
      label: "Pending",
      icon: Clock,
      cls: "text-yellow-600 bg-yellow-50",
    },
    PROCESSING: {
      label: "Processing",
      icon: Loader2,
      cls: "text-blue-600 bg-blue-50",
    },
    COMPLETED: {
      label: "Completed",
      icon: CheckCircle2,
      cls: "text-green-600 bg-green-50",
    },
    FAILED: { label: "Failed", icon: XCircle, cls: "text-red-600 bg-red-50" },
  };
  const st = statusMap[outline.parsing_status] || statusMap.PENDING;
  const StatusIcon = st.icon;

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30 -mx-8 px-8 py-4 mb-6">
        <div className="max-w-6xl">
          <Link
            href="/teacher/curriculum"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Outlines
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                {outline.title || outline.subject_name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                <span>{outline.subject_name}</span>
                <span>•</span>
                <span>{outline.section_name}</span>
                {outline.course_code && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-xs">
                      {outline.course_code}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${st.cls}`}
              >
                <StatusIcon
                  className={`w-3.5 h-3.5 ${outline.parsing_status === "PROCESSING" ? "animate-spin" : ""}`}
                />
                {st.label}
              </span>
              {outline.parsing_status === "FAILED" && (
                <button
                  onClick={() => reparseOutline(outlineId).then(fetchOutline)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl space-y-6">
        {/* Course objectives */}
        {outline.course_objectives && outline.course_objectives.length > 0 && (
          <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary-dark">
                Course Objectives
              </h3>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted">
              {outline.course_objectives.map((obj: string, i: number) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Parsing error */}
        {outline.parsing_status === "FAILED" && outline.parsing_error && (
          <div className="flex items-center gap-3 bg-red-50 text-red-700 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{outline.parsing_error}</span>
          </div>
        )}

        {/* Parsing in progress */}
        {(outline.parsing_status === "PENDING" ||
          outline.parsing_status === "PROCESSING") && (
          <div className="flex items-center gap-3 bg-blue-50 text-blue-700 rounded-xl px-5 py-4">
            <Loader2 className="w-5 h-5 animate-spin shrink-0" />
            <span className="text-sm">
              Parsing your course outline… This page will update automatically.
            </span>
          </div>
        )}

        {/* Weekly Accordion */}
        {outline.parsing_status === "COMPLETED" && outline.weeks && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-primary-dark">
                Weekly Plan ({outline.weeks.length} weeks)
              </h3>
            </div>
            {outline.weeks.map((week) => (
              <WeekAccordion
                key={week.id}
                week={week}
                onUploadMaterial={(topicId) => setMaterialTopicId(topicId)}
                onDeleteMaterial={handleDeleteMaterial}
              />
            ))}
          </div>
        )}
      </div>

      {/* Material Upload Modal */}
      {materialTopicId && (
        <MaterialUploadModal
          topicId={materialTopicId}
          onClose={() => setMaterialTopicId(null)}
          onUploaded={() => {
            setMaterialTopicId(null);
            fetchOutline();
          }}
        />
      )}
    </div>
  );
}
