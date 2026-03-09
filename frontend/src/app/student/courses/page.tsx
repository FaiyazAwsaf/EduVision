"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMyCourses } from "@/api/curriculum";
import type {
  CourseOutlineListItem,
  CourseProgressSummary,
} from "@/types/curriculum";

interface CourseWithProgress extends CourseOutlineListItem {
  summary?: CourseProgressSummary;
}

export default function StudentCoursesPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "student") {
      router.replace(
        user?.role === "teacher" ? "/teacher/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, user, router]);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getMyCourses();
      // Backend already attaches progress summary to each item
      const withSummaries = list.map((course) => ({
        ...course,
        summary: course.progress,
      }));
      setCourses(withSummaries);
    } catch {
      setError("Failed to load your courses.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      fetchCourses();
    }
  }, [isReady, isAuthenticated, user, fetchCourses]);

  if (!isReady || !isAuthenticated || user?.role !== "student") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30 -mx-8 px-8 py-4 mb-6">
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-primary-dark">My Courses</h1>
          <p className="text-sm text-muted mt-1">
            Track your progress across all enrolled courses
          </p>
        </div>
      </header>

      <div className="max-w-6xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 text-red-700 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpenCheck className="w-16 h-16 text-secondary/60 mb-4" />
            <h3 className="text-lg font-semibold text-primary-dark mb-2">
              No Courses Available
            </h3>
            <p className="text-sm text-muted max-w-md">
              Your teachers haven&apos;t uploaded course outlines yet. Check
              back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {courses.map((course) => {
              const pct = course.summary?.percentage ?? 0;
              return (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}`}
                  className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-5 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                      <BookOpenCheck className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                  </div>

                  <h3 className="text-base font-semibold text-primary-dark mb-1">
                    {course.title || course.subject_name}
                  </h3>
                  <div className="text-xs text-muted mb-4">
                    {course.subject_name} &middot; {course.section_name}
                    {course.course_code && (
                      <span className="ml-1 font-mono">
                        ({course.course_code})
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {course.summary && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted">Progress</span>
                        <span className="font-semibold text-primary-dark">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-secondary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                        <span>
                          {course.summary.completed} /{" "}
                          {course.summary.total_topics} done
                        </span>
                        {course.summary.in_progress > 0 && (
                          <span>{course.summary.in_progress} in progress</span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
