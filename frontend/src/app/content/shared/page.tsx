"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  FileText,
  BookOpen,
  User,
  Sparkles,
  GraduationCap,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  listSharedContent,
  listCurriculumMaterials,
  type SharedContentFilters,
  type SharedContentListResponse,
  type SharedContentItem,
  type CurriculumMaterialsResponse,
  type CurriculumCourseGroup,
  type CurriculumMaterialItem,
} from "@/api/contentRequests";

const PAGE_SIZE = 20;

const CONTENT_TYPE_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  WORKED_EXAMPLES: "Worked Examples",
  FORMULA_SHEET: "Formula Sheet",
  LESSON_PLAN: "Lesson Plan",
  QUIZ_GENERATOR: "Quiz",
  WORKSHEET_BUILDER: "Worksheet",
  TOPIC_EXPLANATION: "Topic Explanation",
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  SUMMARY: "bg-blue-100 text-blue-800",
  WORKED_EXAMPLES: "bg-purple-100 text-purple-800",
  FORMULA_SHEET: "bg-green-100 text-green-800",
  LESSON_PLAN: "bg-amber-100 text-amber-800",
  QUIZ_GENERATOR: "bg-red-100 text-red-800",
  WORKSHEET_BUILDER: "bg-orange-100 text-orange-800",
  TOPIC_EXPLANATION: "bg-teal-100 text-teal-800",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type TabKey = "curriculum" | "shared";

/* ── Collapsible Course Card ────────────────────────────────────────────── */
function CourseCard({ course }: { course: CurriculumCourseGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-lg border border-secondary overflow-hidden">
      {/* Course header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-primary-dark text-sm">
              {course.course_title}
            </h3>
            {course.course_code && (
              <p className="text-xs text-primary">{course.course_code}</p>
            )}
          </div>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {course.materials.length} material
            {course.materials.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-primary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-primary" />
        )}
      </button>

      {/* Materials */}
      {expanded && (
        <div className="border-t border-secondary/50">
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {course.materials.map((item: CurriculumMaterialItem) => (
              <Link
                key={item.id}
                href={`/content/history/${item.id}`}
                className="bg-background/50 rounded-lg border border-secondary/70 p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONTENT_TYPE_COLORS[item.content_type] || "bg-gray-100 text-gray-800"}`}
                  >
                    {CONTENT_TYPE_LABELS[item.content_type] ||
                      item.content_type}
                  </span>
                  {item.week_number && (
                    <span className="text-xs text-primary/70 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Week {item.week_number}
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-primary-dark mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {item.topic}
                </h4>

                <p className="text-xs text-primary/70 mb-3 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {item.curriculum_topic_title}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-secondary/40">
                  <span className="text-xs text-primary flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {item.teacher_name || "Teacher"}
                  </span>
                  <span className="text-xs text-primary/60">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function SharedContentPage() {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("curriculum");

  // Curriculum materials state
  const [curriculumData, setCurriculumData] =
    useState<CurriculumMaterialsResponse | null>(null);
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

  // Shared content state
  const [sharedData, setSharedData] =
    useState<SharedContentListResponse | null>(null);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters (for shared tab)
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Auth + role guard
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    }
    if (isReady && isAuthenticated && user?.role !== "student") {
      router.replace("/content/history");
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch curriculum materials
  const fetchCurriculum = useCallback(async () => {
    setCurriculumLoading(true);
    setCurriculumError(null);
    try {
      const result = await listCurriculumMaterials();
      setCurriculumData(result);
    } catch (err) {
      setCurriculumError(
        err instanceof Error
          ? err.message
          : "Failed to load curriculum materials",
      );
    } finally {
      setCurriculumLoading(false);
    }
  }, []);

  // Fetch shared content
  const fetchShared = useCallback(async () => {
    setSharedLoading(true);
    setSharedError(null);
    try {
      const filters: SharedContentFilters = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (contentTypeFilter) filters.content_type = contentTypeFilter;
      if (searchText.trim()) filters.search = searchText.trim();
      const result = await listSharedContent(filters);
      setSharedData(result);
    } catch (err) {
      setSharedError(
        err instanceof Error ? err.message : "Failed to load shared content",
      );
    } finally {
      setSharedLoading(false);
    }
  }, [page, contentTypeFilter, searchText]);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      fetchCurriculum();
      fetchShared();
    }
  }, [isReady, isAuthenticated, user, fetchCurriculum, fetchShared]);

  useEffect(() => {
    setPage(0);
  }, [contentTypeFilter, searchText]);

  if (!isReady || !isAuthenticated || !user || user.role !== "student") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  const totalPages = sharedData ? Math.ceil(sharedData.total / PAGE_SIZE) : 0;
  const totalCurriculumMaterials = curriculumData
    ? curriculumData.courses.reduce((sum, c) => sum + c.materials.length, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-secondary/30">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                Class Materials
              </h1>
              <p className="text-sm text-primary">
                Content shared by your teachers for your class
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/content"
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Create My Own
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-8 gap-1">
            <button
              onClick={() => setActiveTab("curriculum")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "curriculum"
                  ? "border-primary text-primary"
                  : "border-transparent text-primary/60 hover:text-primary hover:border-primary/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Course Materials
                {totalCurriculumMaterials > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {totalCurriculumMaterials}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("shared")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "shared"
                  ? "border-primary text-primary"
                  : "border-transparent text-primary/60 hover:text-primary hover:border-primary/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Teacher Shared
                {sharedData && sharedData.total > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {sharedData.total}
                  </span>
                )}
              </span>
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-6xl">
            {/* ── Curriculum Tab ───────────────────────────────────── */}
            {activeTab === "curriculum" && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-primary">
                    AI-generated content for your enrolled courses, grouped by
                    course
                  </p>
                  <button
                    onClick={fetchCurriculum}
                    disabled={curriculumLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-secondary text-sm font-medium text-primary hover:bg-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${curriculumLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>

                {curriculumError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                    {curriculumError}
                  </div>
                )}

                {curriculumLoading && !curriculumData ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-primary">Loading...</span>
                  </div>
                ) : curriculumData && curriculumData.courses.length > 0 ? (
                  <div className="space-y-4">
                    {curriculumData.courses.map(
                      (course: CurriculumCourseGroup) => (
                        <CourseCard key={course.course_id} course={course} />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border border-secondary">
                    <GraduationCap className="w-12 h-12 text-primary/30 mb-3" />
                    <p className="text-primary-dark font-medium">
                      No curriculum materials yet
                    </p>
                    <p className="text-sm text-primary mt-1">
                      Your teachers haven&apos;t generated any content for your
                      course topics yet
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Shared Tab ──────────────────────────────────────── */}
            {activeTab === "shared" && (
              <>
                {/* Filter Bar */}
                <div className="bg-white rounded-lg border border-secondary p-4 mb-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <input
                        type="text"
                        placeholder="Search by topic..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-secondary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        showFilters
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-secondary text-primary hover:bg-background"
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {contentTypeFilter && (
                        <span className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </button>

                    <button
                      onClick={fetchShared}
                      disabled={sharedLoading}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-secondary text-sm font-medium text-primary hover:bg-background transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${sharedLoading ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>

                  {showFilters && (
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-secondary">
                      <div>
                        <label className="block text-xs font-medium text-primary mb-1">
                          Content Type
                        </label>
                        <select
                          value={contentTypeFilter}
                          onChange={(e) => setContentTypeFilter(e.target.value)}
                          className="border border-secondary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">All Types</option>
                          {Object.entries(CONTENT_TYPE_LABELS).map(
                            ([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      {contentTypeFilter && (
                        <button
                          onClick={() => setContentTypeFilter("")}
                          className="text-xs text-primary hover:text-primary-dark underline mt-4"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Error */}
                {sharedError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                    {sharedError}
                  </div>
                )}

                {/* Content Cards */}
                {sharedLoading && !sharedData ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-primary">Loading...</span>
                  </div>
                ) : sharedData && sharedData.results.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {sharedData.results.map((item: SharedContentItem) => (
                        <Link
                          key={item.id}
                          href={`/content/history/${item.id}`}
                          className="bg-white rounded-lg border border-secondary p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-full ${CONTENT_TYPE_COLORS[item.content_type] || "bg-gray-100 text-gray-800"}`}
                            >
                              {CONTENT_TYPE_LABELS[item.content_type] ||
                                item.content_type}
                            </span>
                            {item.difficulty && (
                              <span className="text-xs text-primary bg-background px-2 py-0.5 rounded">
                                {item.difficulty}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-primary-dark mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {item.topic}
                          </h3>

                          {item.subject && (
                            <p className="text-xs text-primary mb-3">
                              <BookOpen className="w-3 h-3 inline mr-1" />
                              {item.subject}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-secondary/50">
                            <span className="text-xs text-primary flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.teacher_name || "Teacher"}
                            </span>
                            <span className="text-xs text-primary/70">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6">
                        <p className="text-sm text-primary">
                          Showing {page * PAGE_SIZE + 1}–
                          {Math.min((page + 1) * PAGE_SIZE, sharedData.total)}{" "}
                          of {sharedData.total}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-1.5 rounded-md border border-secondary text-primary hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-primary font-medium">
                            Page {page + 1} of {totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setPage((p) => Math.min(totalPages - 1, p + 1))
                            }
                            disabled={page >= totalPages - 1}
                            className="p-1.5 rounded-md border border-secondary text-primary hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-lg border border-secondary">
                    <BookOpen className="w-12 h-12 text-primary/30 mb-3" />
                    <p className="text-primary-dark font-medium">
                      No shared materials yet
                    </p>
                    <p className="text-sm text-primary mt-1">
                      {contentTypeFilter || searchText
                        ? "Try adjusting your filters"
                        : "Your teachers haven't shared any content with your class yet"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
