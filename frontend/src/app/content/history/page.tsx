/**
 * Content History Page
 *
 * Displays a paginated, filterable list of the user's content requests.
 * Allows filtering by status, content type, subject, and search text.
 * Clicking a row navigates to the request detail/status view.
 */

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
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  listContentRequests,
  type ContentRequestFilters,
  type ContentRequestListResponse,
} from "@/api/contentRequests";
import type {
  ContentRequest,
  ContentType,
  RequestStatus,
} from "@/types/content";

const PAGE_SIZE = 20;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  PROCESSING: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  WORKED_EXAMPLES: "Worked Examples",
  FORMULA_SHEET: "Formula Sheet",
  LESSON_PLAN: "Lesson Plan",
  QUIZ_GENERATOR: "Quiz Generator",
  WORKSHEET_BUILDER: "Worksheet Builder",
  TOPIC_EXPLANATION: "Topic Explanation",
};

const TEACHER_CONTENT_TYPES = [
  "SUMMARY",
  "WORKED_EXAMPLES",
  "FORMULA_SHEET",
  "LESSON_PLAN",
  "QUIZ_GENERATOR",
  "WORKSHEET_BUILDER",
  "TOPIC_EXPLANATION",
];
const STUDENT_CONTENT_TYPES = ["SUMMARY", "WORKED_EXAMPLES", "FORMULA_SHEET"];

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: "bg-gray-100 text-gray-800",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContentHistoryPage() {
  const { isReady, isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ContentRequestListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Auth guard
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isReady, isAuthenticated, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ContentRequestFilters = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (statusFilter) filters.status = statusFilter;
      if (contentTypeFilter) filters.content_type = contentTypeFilter;
      if (searchText.trim()) filters.search = searchText.trim();

      const result = await listContentRequests(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, contentTypeFilter, searchText]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      fetchData();
    }
  }, [isReady, isAuthenticated, fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, contentTypeFilter, searchText]);

  if (!isReady || !isAuthenticated || !user) {
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
                {user.role === "teacher"
                  ? "Generated Content"
                  : "My Study Content"}
              </h1>
              <p className="text-sm text-primary">
                {user.role === "teacher"
                  ? "Manage lesson plans, quizzes, worksheets, and other teaching materials"
                  : "View your summaries, worked examples, and study aids"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/content"
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {user.role === "teacher" ? "Create Content" : "New Study Aid"}
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
                {/* Search */}
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

                {/* Toggle Filters */}
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
                  {(statusFilter || contentTypeFilter) && (
                    <span className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </button>

                {/* Refresh */}
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

              {/* Expanded Filters */}
              {showFilters && (
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-secondary">
                  <div>
                    <label className="block text-xs font-medium text-primary mb-1">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="border border-secondary rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>
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
                      {(user.role === "teacher"
                        ? TEACHER_CONTENT_TYPES
                        : STUDENT_CONTENT_TYPES
                      ).map((val) => (
                        <option key={val} value={val}>
                          {CONTENT_TYPE_LABELS[val]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(statusFilter || contentTypeFilter) && (
                    <button
                      onClick={() => {
                        setStatusFilter("");
                        setContentTypeFilter("");
                      }}
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

            {/* Table */}
            <div className="bg-white rounded-lg border border-secondary overflow-hidden">
              {loading && !data ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-primary">Loading...</span>
                </div>
              ) : data && data.results.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-background border-b border-secondary">
                          <th className="text-left text-xs font-semibold text-primary uppercase tracking-wider px-4 py-3">
                            Topic
                          </th>
                          <th className="text-left text-xs font-semibold text-primary uppercase tracking-wider px-4 py-3">
                            Type
                          </th>
                          <th className="text-left text-xs font-semibold text-primary uppercase tracking-wider px-4 py-3">
                            Subject
                          </th>
                          <th className="text-left text-xs font-semibold text-primary uppercase tracking-wider px-4 py-3">
                            Status
                          </th>
                          <th className="text-left text-xs font-semibold text-primary uppercase tracking-wider px-4 py-3">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary">
                        {data.results.map((req: ContentRequest) => (
                          <tr
                            key={req.id}
                            onClick={() =>
                              router.push(`/content/history/${req.id}`)
                            }
                            className="hover:bg-background/50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-sm font-medium text-primary-dark truncate max-w-[300px]">
                                  {req.topic}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-primary">
                              {CONTENT_TYPE_LABELS[req.content_type] ||
                                req.content_type}
                            </td>
                            <td className="px-4 py-3 text-sm text-primary">
                              {req.subject || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-primary whitespace-nowrap">
                              {formatDate(req.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-secondary">
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
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="w-12 h-12 text-primary/30 mb-3" />
                  <p className="text-primary-dark font-medium">
                    {user.role === "teacher"
                      ? "No teaching materials yet"
                      : "No study content yet"}
                  </p>
                  <p className="text-sm text-primary mt-1">
                    {statusFilter || contentTypeFilter || searchText
                      ? "Try adjusting your filters"
                      : user.role === "teacher"
                        ? "Generate lesson plans, quizzes, and worksheets for your classes"
                        : "Create summaries and worked examples to study smarter"}
                  </p>
                  {!statusFilter && !contentTypeFilter && !searchText && (
                    <Link
                      href="/content"
                      className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {user.role === "teacher"
                        ? "Create Teaching Material"
                        : "Create Study Aid"}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
