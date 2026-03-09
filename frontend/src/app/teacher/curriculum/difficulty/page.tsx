"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Loader2,
  AlertCircle,
  ChevronDown,
  Users,
  BookOpenCheck,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listMyOutlines, getDifficultyReport } from "@/api/curriculum";
import type {
  CourseOutlineListItem,
  DifficultyReportItem,
} from "@/types/curriculum";

export default function DifficultyReportsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const [outlines, setOutlines] = useState<CourseOutlineListItem[]>([]);
  const [selectedOutline, setSelectedOutline] = useState<string>("");
  const [report, setReport] = useState<DifficultyReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch outlines
  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    (async () => {
      setIsLoading(true);
      try {
        const list = await listMyOutlines();
        const completed = list.filter((o) => o.parsing_status === "COMPLETED");
        setOutlines(completed);
        if (completed.length > 0) {
          setSelectedOutline(completed[0].id);
        }
      } catch {
        setError("Failed to load outlines.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isReady, isAuthenticated]);

  // Fetch report when outline changes
  const fetchReport = useCallback(async () => {
    if (!selectedOutline) return;
    setIsLoadingReport(true);
    try {
      const data = await getDifficultyReport(selectedOutline);
      setReport(data);
    } catch {
      setReport([]);
    } finally {
      setIsLoadingReport(false);
    }
  }, [selectedOutline]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (!isReady || !isAuthenticated || user?.role !== "teacher") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const aboveThreshold = report.filter((r) => r.above_threshold);
  const belowThreshold = report.filter(
    (r) => !r.above_threshold && r.flag_count > 0,
  );

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30 -mx-8 px-8 py-4 mb-6">
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-primary-dark">
            Difficulty Reports
          </h1>
          <p className="text-sm text-muted mt-1">
            Topics flagged as difficult by students. Alerts trigger when 40% or
            more students flag a topic.
          </p>
        </div>
      </header>

      <div className="max-w-6xl space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 text-red-700 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : outlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpenCheck className="w-16 h-16 text-secondary/60 mb-4" />
            <h3 className="text-lg font-semibold text-primary-dark mb-2">
              No Parsed Outlines
            </h3>
            <p className="text-sm text-muted max-w-md">
              Upload and parse a course outline first to see difficulty reports.
            </p>
            <Link
              href="/teacher/curriculum"
              className="mt-4 text-sm text-primary hover:underline"
            >
              Go to Course Outlines
            </Link>
          </div>
        ) : (
          <>
            {/* Outline selector */}
            <div>
              <label className="block text-sm font-medium text-primary-dark mb-1.5">
                Select Course
              </label>
              <select
                value={selectedOutline}
                onChange={(e) => setSelectedOutline(e.target.value)}
                className="w-full max-w-md border border-secondary/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {outlines.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title || o.subject_name} – {o.section_name}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingReport ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : report.length === 0 ? (
              <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-secondary/40 mx-auto mb-3" />
                <p className="text-sm text-muted">
                  No topics have been flagged as difficult yet.
                </p>
              </div>
            ) : (
              <>
                {/* Above threshold */}
                {aboveThreshold.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      Critical — 40%+ Students Struggling (
                      {aboveThreshold.length})
                    </h3>
                    <div className="space-y-3">
                      {aboveThreshold.map((item) => (
                        <DifficultyCard
                          key={item.topic_id}
                          item={item}
                          critical
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Below threshold */}
                {belowThreshold.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-primary-dark mb-3">
                      Other Flagged Topics ({belowThreshold.length})
                    </h3>
                    <div className="space-y-3">
                      {belowThreshold.map((item) => (
                        <DifficultyCard key={item.topic_id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Difficulty Card Component ───────────────────────────────────────────────

function DifficultyCard({
  item,
  critical = false,
}: {
  item: DifficultyReportItem;
  critical?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
        critical ? "border-red-200" : "border-secondary/30"
      }`}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-background/40 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-2 rounded-xl ${
              critical ? "bg-red-50" : "bg-yellow-50"
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 ${critical ? "text-red-500" : "text-yellow-600"}`}
            />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-primary-dark">
              {item.topic_title}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {item.flag_count} / {item.total_students} students
              </span>
              <span
                className={`font-semibold ${
                  critical ? "text-red-600" : "text-yellow-600"
                }`}
              >
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-2 bg-secondary/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                critical ? "bg-red-500" : "bg-yellow-500"
              }`}
              style={{ width: `${Math.min(item.percentage, 100)}%` }}
            />
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {expanded && item.students.length > 0 && (
        <div className="border-t border-secondary/20 px-5 py-3">
          <p className="text-xs font-medium text-muted mb-2">
            Students who flagged this topic:
          </p>
          <div className="space-y-2">
            {item.students.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-primary-dark">{s.name}</span>
                {s.note && (
                  <span className="text-xs text-muted italic max-w-xs truncate">
                    &ldquo;{s.note}&rdquo;
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
