"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Trash2,
  BookOpenCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listMyOutlines,
  uploadCourseOutline,
  reparseOutline,
  deleteOutline,
} from "@/api/curriculum";
import {
  getMyTeachingAssignments,
  type TeachingAssignment,
} from "@/api/school";
import type { CourseOutlineListItem, ParsingStatus } from "@/types/curriculum";

const statusConfig: Record<
  ParsingStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600 bg-yellow-50",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    color: "text-blue-600 bg-blue-50",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-600 bg-green-50",
  },
  FAILED: { label: "Failed", icon: XCircle, color: "text-red-600 bg-red-50" },
};

export default function TeacherCurriculumPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [outlines, setOutlines] = useState<CourseOutlineListItem[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace(
        user?.role === "student" ? "/student/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, user, router]);

  // Fetch outlines + assignments
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [outlineList, assignmentList] = await Promise.all([
        listMyOutlines(),
        getMyTeachingAssignments(),
      ]);
      setOutlines(outlineList);
      setAssignments(assignmentList);
    } catch {
      setError("Failed to load curriculum data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "teacher") {
      fetchData();
    }
  }, [isReady, isAuthenticated, user, fetchData]);

  // Poll for processing outlines
  useEffect(() => {
    const hasProcessing = outlines.some(
      (o) =>
        o.parsing_status === "PENDING" || o.parsing_status === "PROCESSING",
    );
    if (!hasProcessing) return;
    const timer = setInterval(fetchData, 5000);
    return () => clearInterval(timer);
  }, [outlines, fetchData]);

  // Upload handler
  const handleUpload = async () => {
    if (!selectedAssignment || !selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadCourseOutline(selectedAssignment, selectedFile);
      setShowUpload(false);
      setSelectedAssignment("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReparse = async (id: string) => {
    try {
      await reparseOutline(id);
      fetchData();
    } catch {
      // Silently fail — outline will show current status
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course outline? This cannot be undone.")) return;
    try {
      await deleteOutline(id);
      fetchData();
    } catch {
      // Silently fail
    }
  };

  // Filter out assignments that already have outlines
  const availableAssignments = assignments.filter(
    (a) =>
      !outlines.some(
        (o) =>
          o.subject_name === a.subject_name &&
          o.section_name === `${a.class_name}-${a.section_name}`,
      ),
  );

  if (!isReady || !isAuthenticated || user?.role !== "teacher") {
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
        <div className="flex items-center justify-between max-w-6xl">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              Course Outlines
            </h1>
            <p className="text-sm text-muted mt-1">
              Upload and manage course outlines for your subjects
            </p>
          </div>
          <button
            onClick={() => setShowUpload((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Outline
          </button>
        </div>
      </header>

      <div className="max-w-6xl space-y-6">
        {/* Upload Panel */}
        {showUpload && (
          <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-6">
            <h3 className="font-semibold text-primary-dark mb-4">
              Upload Course Outline PDF
            </h3>

            {uploadError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4 text-sm">
                <AlertCircle className="w-4 h-4" />
                {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1.5">
                  Subject & Section
                </label>
                <select
                  value={selectedAssignment}
                  onChange={(e) => setSelectedAssignment(e.target.value)}
                  className="w-full border border-secondary/40 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select a subject…</option>
                  {availableAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_name} – {a.class_name} {a.section_name}
                    </option>
                  ))}
                </select>
                {assignments.length > 0 &&
                  availableAssignments.length === 0 && (
                    <p className="text-xs text-muted mt-1">
                      All your subjects already have outlines uploaded.
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-dark mb-1.5">
                  PDF File
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full border border-secondary/40 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded-md file:bg-primary/10 file:text-primary file:text-sm file:font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-sm text-muted hover:text-primary-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedAssignment || !selectedFile || isUploading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? "Uploading…" : "Upload & Parse"}
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 text-red-700 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && outlines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpenCheck className="w-16 h-16 text-secondary/60 mb-4" />
            <h3 className="text-lg font-semibold text-primary-dark mb-2">
              No Course Outlines Yet
            </h3>
            <p className="text-sm text-muted max-w-md">
              Upload a course outline PDF to get started. The AI will
              automatically extract weeks, topics, and learning outcomes.
            </p>
          </div>
        )}

        {/* Outlines List */}
        {!isLoading && outlines.length > 0 && (
          <div className="space-y-3">
            {outlines.map((outline) => {
              const st = statusConfig[outline.parsing_status];
              const StatusIcon = st.icon;
              return (
                <div
                  key={outline.id}
                  className="bg-white rounded-2xl border border-secondary/30 shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="p-2.5 bg-primary/10 rounded-xl">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/teacher/curriculum/${outline.id}`}
                          className="text-base font-semibold text-primary-dark hover:text-primary transition-colors"
                        >
                          {outline.title || outline.subject_name}
                        </Link>
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
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <span
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${st.color}`}
                      >
                        <StatusIcon
                          className={`w-3.5 h-3.5 ${
                            outline.parsing_status === "PROCESSING"
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                        {st.label}
                      </span>
                      {outline.parsing_status === "FAILED" && (
                        <button
                          onClick={() => handleReparse(outline.id)}
                          className="p-1.5 text-muted hover:text-primary transition-colors"
                          title="Retry parsing"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(outline.id)}
                        className="p-1.5 text-muted hover:text-red-500 transition-colors"
                        title="Delete outline"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
