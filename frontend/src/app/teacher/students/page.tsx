"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Loader2,
  AlertCircle,
  ArrowRight,
  Phone,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/shared/Sidebar";
import {
  getMyClass,
  getMyStudents,
  type MyClassInfo,
  type StudentProfile,
} from "@/api/school";

export default function TeacherStudentsPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, user } = useAuth();

  const [myClass, setMyClass] = useState<MyClassInfo | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated || !user || user.role !== "teacher") {
      router.replace(
        user?.role === "student" ? "/student/dashboard" : "/signin",
      );
    }
  }, [isReady, isAuthenticated, user, router]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch class info + students
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [classInfo, studentList] = await Promise.all([
        getMyClass().catch(() => null),
        getMyStudents(debouncedSearch || undefined),
      ]);
      setMyClass(classInfo);
      setStudents(studentList);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load students.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (isReady && isAuthenticated && user?.role === "teacher") {
      fetchData();
    }
  }, [isReady, isAuthenticated, user, fetchData]);

  if (!isReady || !isAuthenticated || !user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="teacher" />

      <main className="flex-1 ml-60 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-dark">My Students</h1>
          {myClass ? (
            <p className="text-sm text-muted mt-1">
              Class {myClass.class_name}
              {myClass.stream && ` — ${myClass.stream}`}, Section{" "}
              {myClass.name} &middot; {myClass.academic_year}
            </p>
          ) : (
            <p className="text-sm text-muted mt-1">
              Students in your assigned section
            </p>
          )}
        </div>

        {/* Search bar + count */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-secondary/60 bg-white text-sm text-primary-dark placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
          {!isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Users className="w-4 h-4" />
              <span>
                {students.length} student{students.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Could not load students
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* No section assigned */}
        {!isLoading && !error && !myClass && (
          <div className="bg-white rounded-2xl border border-secondary/30 p-12 text-center">
            <GraduationCap className="w-12 h-12 text-secondary mx-auto mb-4" />
            <p className="text-base font-medium text-primary-dark mb-1">
              No section assigned
            </p>
            <p className="text-sm text-muted">
              You are not currently assigned as a class teacher to any section.
            </p>
          </div>
        )}

        {/* Empty search */}
        {!isLoading && !error && myClass && students.length === 0 && (
          <div className="bg-white rounded-2xl border border-secondary/30 p-12 text-center">
            <Users className="w-12 h-12 text-secondary mx-auto mb-4" />
            <p className="text-base font-medium text-primary-dark mb-1">
              {search ? "No students found" : "No students yet"}
            </p>
            <p className="text-sm text-muted">
              {search
                ? `No students match "${search}"`
                : "There are no students enrolled in this section yet."}
            </p>
          </div>
        )}

        {/* Student list */}
        {!isLoading && !error && students.length > 0 && (
          <div className="bg-white rounded-2xl border border-secondary/30 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-background/50 border-b border-secondary/20 text-xs font-semibold text-muted uppercase tracking-wide">
              <span className="col-span-4">Student</span>
              <span className="col-span-2">Roll Number</span>
              <span className="col-span-3">Parent Contact</span>
              <span className="col-span-2">Blood Group</span>
              <span className="col-span-1"></span>
            </div>

            {/* Rows */}
            {students.map((student) => (
              <Link
                key={student.user_id}
                href={`/teacher/students/${student.user_id}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-secondary/10 last:border-b-0 items-center hover:bg-background/40 transition-colors group"
              >
                {/* Name + email */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: avatarColor(
                        `${student.first_name} ${student.last_name}`,
                      ),
                    }}
                  >
                    {student.first_name[0]}
                    {student.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-dark truncate">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {student.email}
                    </p>
                  </div>
                </div>

                {/* Roll number */}
                <div className="col-span-2">
                  <span className="text-sm text-primary-dark font-mono">
                    {student.roll_number}
                  </span>
                </div>

                {/* Parent contact */}
                <div className="col-span-3 min-w-0">
                  {student.father_name ? (
                    <div>
                      <p className="text-sm text-primary-dark truncate">
                        {student.father_name}
                      </p>
                      {student.father_phone && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {student.father_phone}
                        </p>
                      )}
                    </div>
                  ) : student.mother_name ? (
                    <div>
                      <p className="text-sm text-primary-dark truncate">
                        {student.mother_name}
                      </p>
                      {student.mother_phone && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {student.mother_phone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>

                {/* Blood group */}
                <div className="col-span-2">
                  <span className="text-sm text-muted">
                    {student.blood_group || "—"}
                  </span>
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex justify-end">
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  "#9ACBD0",
  "#48A6A7",
  "#006A71",
  "#D4C5A9",
  "#B39DDB",
  "#F0C987",
  "#FFD6A5",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
