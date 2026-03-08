"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  FileText,
  BookOpen,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  listSharedContent,
  type SharedContentFilters,
  type SharedContentListResponse,
  type SharedContentItem,
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

export default function SharedContentPage() {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<SharedContentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: SharedContentFilters = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (contentTypeFilter) filters.content_type = contentTypeFilter;
      if (searchText.trim()) filters.search = searchText.trim();

      const result = await listSharedContent(filters);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shared content",
      );
    } finally {
      setLoading(false);
    }
  }, [page, contentTypeFilter, searchText]);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "student") {
      fetchData();
    }
  }, [isReady, isAuthenticated, user, fetchData]);

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

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

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
        </header>

        {/* Main */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-6xl">
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
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-secondary text-sm font-medium text-primary hover:bg-background transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
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
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                {error}
              </div>
            )}

            {/* Content Cards */}
            {loading && !data ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-primary">Loading...</span>
              </div>
            ) : data && data.results.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.results.map((item: SharedContentItem) => (
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
                      {Math.min((page + 1) * PAGE_SIZE, data.total)} of{" "}
                      {data.total}
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
          </div>
        </main>
      </div>
    </div>
  );
}
