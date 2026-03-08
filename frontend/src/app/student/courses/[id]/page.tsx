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
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Paperclip,
  ExternalLink,
  LinkIcon,
  BookOpenCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOutlineDetail,
  getCourseSummary,
  updateTopicProgress,
  flagTopicDifficult,
  unflagTopicDifficult,
  getTopicMaterials,
} from "@/api/curriculum";
import type {
  CourseOutlineDetail,
  CourseTopic,
  CourseWeek,
  CourseProgressSummary,
  TopicMaterial,
  ProgressStatus,
} from "@/types/curriculum";

const progressIcons: Record<
  ProgressStatus,
  { icon: React.ElementType; cls: string; label: string }
> = {
  NOT_STARTED: { icon: Circle, cls: "text-secondary/60", label: "Not started" },
  IN_PROGRESS: { icon: Clock, cls: "text-blue-500", label: "In progress" },
  COMPLETED: { icon: CheckCircle2, cls: "text-green-500", label: "Completed" },
};

const PROGRESS_CYCLE: ProgressStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
];

// ─── Topic Node (student view) ───────────────────────────────────────────────

function StudentTopicNode({
  topic,
  depth,
  onProgressChange,
  onToggleFlag,
}: {
  topic: CourseTopic;
  depth: number;
  onProgressChange: (topicId: string, status: ProgressStatus) => void;
  onToggleFlag: (topicId: string, currentlyFlagged: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [showMaterials, setShowMaterials] = useState(false);
  const [materials, setMaterials] = useState<TopicMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const hasChildren = topic.subtopics && topic.subtopics.length > 0;
  const status = topic.progress_status || "NOT_STARTED";
  const isFlagged = topic.is_flagged_difficult || false;
  const matCount = topic.materials_count || 0;
  const pi = progressIcons[status];
  const ProgressIcon = pi.icon;

  const cycleProgress = () => {
    const idx = PROGRESS_CYCLE.indexOf(status);
    const next = PROGRESS_CYCLE[(idx + 1) % PROGRESS_CYCLE.length];
    onProgressChange(topic.id, next);
  };

  const handleShowMaterials = async () => {
    if (showMaterials) {
      setShowMaterials(false);
      return;
    }
    if (materials.length === 0 && matCount > 0) {
      setLoadingMaterials(true);
      try {
        const mats = await getTopicMaterials(topic.id);
        setMaterials(mats);
      } catch {
        // silent
      } finally {
        setLoadingMaterials(false);
      }
    }
    setShowMaterials(true);
  };

  return (
    <div
      className={depth > 0 ? "ml-5 border-l-2 border-secondary/30 pl-4" : ""}
    >
      <div className="flex items-start gap-2 py-2 group">
        {/* Progress toggle (parent topics only) */}
        {depth === 0 ? (
          <button
            onClick={cycleProgress}
            className="shrink-0 mt-0.5"
            title={`${pi.label} — click to cycle`}
          >
            <ProgressIcon className={`w-5 h-5 ${pi.cls}`} />
          </button>
        ) : hasChildren ? null : (
          <span className="w-5" />
        )}

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
            <span
              className={`text-sm font-medium ${
                status === "COMPLETED"
                  ? "text-green-700 line-through"
                  : "text-primary-dark"
              }`}
            >
              {topic.title}
            </span>
          </button>
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

          {/* Materials toggle */}
          {matCount > 0 && (
            <button
              onClick={handleShowMaterials}
              className="ml-6 mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Paperclip className="w-3 h-3" />
              {matCount} material{matCount !== 1 ? "s" : ""}
              {loadingMaterials && (
                <Loader2 className="w-3 h-3 animate-spin ml-1" />
              )}
            </button>
          )}

          {showMaterials && materials.length > 0 && (
            <div className="ml-6 mt-2 space-y-1.5">
              {materials.map((m) => (
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
                    <a
                      href={`/content/history/${m.content_request_id}`}
                      className="text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : m.material_type === "LINK" && m.external_link ? (
                    <a
                      href={m.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : m.file_url ? (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                  ) : (
                    <span>{m.title}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Difficulty flag toggle (parent topics only) */}
        {depth === 0 && (
          <button
            onClick={() => onToggleFlag(topic.id, isFlagged)}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              isFlagged
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-muted hover:text-yellow-600 hover:bg-yellow-50 opacity-0 group-hover:opacity-100"
            }`}
            title={isFlagged ? "Unflag as difficult" : "Flag as difficult"}
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-1">
          {topic.subtopics!.map((sub) => (
            <StudentTopicNode
              key={sub.id}
              topic={sub}
              depth={depth + 1}
              onProgressChange={onProgressChange}
              onToggleFlag={onToggleFlag}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Week Accordion ──────────────────────────────────────────────────────────

function StudentWeekAccordion({
  week,
  onProgressChange,
  onToggleFlag,
}: {
  week: CourseWeek;
  onProgressChange: (topicId: string, status: ProgressStatus) => void;
  onToggleFlag: (topicId: string, currentlyFlagged: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const completedCount = (week.topics || []).filter(
    (t) => t.progress_status === "COMPLETED",
  ).length;
  const total = (week.topics || []).length;

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
          {total > 0 && (
            <span className="text-xs text-muted">
              {completedCount}/{total} topics done
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="w-16 h-1.5 bg-secondary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${total > 0 ? (completedCount / total) * 100 : 0}%`,
                }}
              />
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-secondary/20">
          {week.topics && week.topics.length > 0 ? (
            week.topics.map((topic) => (
              <StudentTopicNode
                key={topic.id}
                topic={topic}
                depth={0}
                onProgressChange={onProgressChange}
                onToggleFlag={onToggleFlag}
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StudentCourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const outlineId = params.id as string;
  const { isReady, isAuthenticated, user } = useAuth();

  const [outline, setOutline] = useState<CourseOutlineDetail | null>(null);
  const [topics, setTopics] = useState<CourseWeek[]>([]);
  const [summary, setSummary] = useState<CourseProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const detail = await getOutlineDetail(outlineId);
      setOutline(detail);
      setTopics(detail.weeks || []);
      setSummary(detail.progress_summary || null);
    } catch {
      setError("Failed to load course.");
    } finally {
      setIsLoading(false);
    }
  }, [outlineId]);

  useEffect(() => {
    if (isReady && isAuthenticated && outlineId) fetchAll();
  }, [isReady, isAuthenticated, outlineId, fetchAll]);

  const handleProgressChange = async (
    topicId: string,
    status: ProgressStatus,
  ) => {
    try {
      await updateTopicProgress(topicId, status);
      // Optimistic local update
      setTopics((prev) =>
        prev.map((week) => ({
          ...week,
          topics: updateTopicInList(week.topics || [], topicId, {
            progress_status: status,
          }),
        })),
      );
      // Refresh summary
      const newSummary = await getCourseSummary(outlineId);
      setSummary(newSummary);
    } catch {
      // revert by refetching
      fetchAll();
    }
  };

  const handleToggleFlag = async (
    topicId: string,
    currentlyFlagged: boolean,
  ) => {
    try {
      if (currentlyFlagged) {
        await unflagTopicDifficult(topicId);
      } else {
        await flagTopicDifficult(topicId);
      }
      setTopics((prev) =>
        prev.map((week) => ({
          ...week,
          topics: updateTopicInList(week.topics || [], topicId, {
            is_flagged_difficult: !currentlyFlagged,
          }),
        })),
      );
    } catch {
      fetchAll();
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
          <span className="text-sm">{error || "Course not found."}</span>
        </div>
      </div>
    );
  }

  const pct = summary?.percentage ?? 0;

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30 -mx-8 px-8 py-4 mb-6">
        <div className="max-w-6xl">
          <Link
            href="/student/courses"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Courses
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
                <span>•</span>
                <span>{outline.teacher_name}</span>
              </div>
            </div>
            {summary && (
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-dark">
                  {pct.toFixed(0)}%
                </div>
                <div className="text-xs text-muted">
                  {summary.completed}/{summary.total_topics} topics
                </div>
              </div>
            )}
          </div>

          {/* Overall progress bar */}
          {summary && (
            <div className="mt-3 w-full h-2 bg-secondary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
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

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Circle className="w-3.5 h-3.5 text-secondary/60" /> Not started
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> In progress
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Flagged
            difficult
          </span>
        </div>

        {/* Weekly Accordion */}
        {topics.length > 0 ? (
          <div className="space-y-3">
            {topics.map((week) => (
              <StudentWeekAccordion
                key={week.id}
                week={week}
                onProgressChange={handleProgressChange}
                onToggleFlag={handleToggleFlag}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-8 text-center">
            <BookOpenCheck className="w-12 h-12 text-secondary/40 mx-auto mb-3" />
            <p className="text-sm text-muted">
              This course outline is still being processed. Check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Utility: recursively update a topic in a nested list ────────────────────

function updateTopicInList(
  topics: CourseTopic[],
  targetId: string,
  patch: Partial<CourseTopic>,
): CourseTopic[] {
  return topics.map((t) => {
    if (t.id === targetId) return { ...t, ...patch };
    if (t.subtopics && t.subtopics.length > 0) {
      return {
        ...t,
        subtopics: updateTopicInList(t.subtopics, targetId, patch),
      };
    }
    return t;
  });
}
